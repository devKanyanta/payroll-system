package com.payroll.service.impl;

import com.payroll.entity.Expense;
import com.payroll.entity.ExpenseStatus;
import com.payroll.entity.User;
import com.payroll.exception.BusinessRuleException;
import com.payroll.exception.ResourceNotFoundException;
import com.payroll.repository.ExpenseRepository;
import com.payroll.repository.UserRepository;
import com.payroll.service.AuditService;
import com.payroll.service.EmailService;
import com.payroll.service.ExpenseService;
import com.payroll.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ExpenseServiceImpl implements ExpenseService {

    private final ExpenseRepository expenseRepository;
    private final UserRepository userRepository;
    private final AuditService auditService;
    private final NotificationService notificationService;
    private final EmailService emailService;

    @Value("${app.admin-email}")
    private String adminEmail;

    @Override
    public Page<Expense> getAllExpenses(LocalDate start, LocalDate end, ExpenseStatus status,
                                         UUID userId, boolean isAdmin, Pageable pageable) {
        if (start == null) start = LocalDate.of(2000, 1, 1);
        if (end == null) end = LocalDate.now().plusYears(10);

        // Admin sees all expenses; others see only their own
        if (isAdmin) {
            if (status != null) {
                return expenseRepository.findByExpenseDateBetweenAndStatus(start, end, status, pageable);
            }
            return expenseRepository.findByExpenseDateBetween(start, end, pageable);
        } else {
            if (status != null) {
                return expenseRepository.findByExpenseDateBetweenAndStatusAndCreatedById(start, end, status, userId, pageable);
            }
            return expenseRepository.findByExpenseDateBetweenAndCreatedById(start, end, userId, pageable);
        }
    }

    @Override
    public Expense getExpenseById(UUID id) {
        return expenseRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Expense", id));
    }

    @Override
    @Transactional
    public Expense createExpense(Expense expense, UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));

        expense.setCreatedBy(user);
        expense.setStatus(ExpenseStatus.PENDING);
        Expense saved = expenseRepository.save(expense);

        auditService.logEvent(userId, "CREATE", "Expense", saved.getId().toString(),
                null, String.format("Expense created: %s — ZMW %.2f", expense.getItem(), expense.getAmount()), null);

        // Notify all ADMIN users about the new expense requiring approval
        List<User> admins = userRepository.findByRole(com.payroll.entity.Role.ADMIN);
        String title = "Expense Requires Approval";
        String message = user.getFirstName() + " " + user.getLastName()
                + " submitted an expense: " + expense.getItem()
                + " (ZMW " + String.format("%,.2f", expense.getAmount()) + ")";
        String link = "/expenses";

        for (User admin : admins) {
            notificationService.createNotification(admin.getId(), title, message, "EXPENSE", link);
        }

        // Send email notification to admin
        try {
            emailService.sendSimpleMessage(
                adminEmail,
                title,
                message + "\n\nPlease log in to the system to review and approve or reject this expense.\n\n" + link
            );
        } catch (Exception e) {
            // Log but don't fail — in-app notification was already sent
            log.warn("Failed to send admin email notification for expense: {}", e.getMessage());
        }

        return saved;
    }

    @Override
    @Transactional
    public Expense updateExpense(UUID id, Expense expense, UUID userId) {
        Expense existing = expenseRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Expense", id));

        // Only the creator can update, and only PENDING expenses
        if (!existing.getCreatedBy().getId().equals(userId)) {
            throw new BusinessRuleException("You can only update your own expenses.");
        }
        if (existing.getStatus() != ExpenseStatus.PENDING) {
            throw new BusinessRuleException("Only PENDING expenses can be edited.");
        }

        existing.setItem(expense.getItem());
        existing.setAmount(expense.getAmount());
        existing.setRemarks(expense.getRemarks());
        existing.setExpenseDate(expense.getExpenseDate());

        Expense saved = expenseRepository.save(existing);

        auditService.logEvent(userId, "UPDATE", "Expense", saved.getId().toString(),
                null, "Expense details updated", null);

        return saved;
    }

    @Override
    @Transactional
    public void deleteExpense(UUID id, UUID userId) {
        Expense expense = expenseRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Expense", id));

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));

        // Admin can delete any expense; others can only delete their own PENDING ones
        if (user.getRole() == com.payroll.entity.Role.ADMIN) {
            // Admin can delete any expense
        } else if (!expense.getCreatedBy().getId().equals(userId)) {
            throw new BusinessRuleException("You can only delete your own expenses.");
        } else if (expense.getStatus() != ExpenseStatus.PENDING) {
            throw new BusinessRuleException("Only PENDING expenses can be deleted.");
        }

        expenseRepository.delete(expense);

        auditService.logEvent(userId, "DELETE", "Expense", expense.getId().toString(),
                expense.getStatus().name(), null,
                "Expense deleted: " + expense.getItem());
    }

    @Override
    @Transactional
    public Expense approveExpense(UUID id, UUID userId) {
        Expense expense = expenseRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Expense", id));

        if (expense.getStatus() != ExpenseStatus.PENDING) {
            throw new BusinessRuleException("Only PENDING expenses can be approved.");
        }

        User approver = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));

        // Prevent users from approving their own expenses
        if (expense.getCreatedBy().getId().equals(userId)) {
            throw new BusinessRuleException("You cannot approve your own expense.");
        }

        expense.setStatus(ExpenseStatus.APPROVED);
        expense.setApprovedBy(approver);
        expense.setApprovedAt(LocalDateTime.now());
        Expense saved = expenseRepository.save(expense);

        auditService.logEvent(userId, "APPROVE", "Expense", saved.getId().toString(),
                "PENDING", "Expense approved", null);

        // Notify the creator
        String title = "Expense Approved";
        String message = "Your expense '" + expense.getItem() + "' has been approved by "
                + approver.getFirstName() + " " + approver.getLastName();
        notificationService.createNotification(expense.getCreatedBy().getId(), title, message, "EXPENSE", "/expenses");

        return saved;
    }

    @Override
    @Transactional
    public Expense rejectExpense(UUID id, UUID userId, String reason) {
        Expense expense = expenseRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Expense", id));

        if (expense.getStatus() != ExpenseStatus.PENDING) {
            throw new BusinessRuleException("Only PENDING expenses can be rejected.");
        }

        User rejector = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));

        // Prevent users from rejecting their own expenses
        if (expense.getCreatedBy().getId().equals(userId)) {
            throw new BusinessRuleException("You cannot reject your own expense.");
        }

        expense.setStatus(ExpenseStatus.REJECTED);
        expense.setRejectedBy(rejector);
        expense.setRejectedAt(LocalDateTime.now());
        expense.setRejectionReason(reason);
        Expense saved = expenseRepository.save(expense);

        auditService.logEvent(userId, "REJECT", "Expense", saved.getId().toString(),
                "PENDING", "Expense rejected" + (reason != null ? ": " + reason : ""), null);

        // Notify the creator
        String title = "Expense Rejected";
        String message = "Your expense '" + expense.getItem() + "' has been rejected by "
                + rejector.getFirstName() + " " + rejector.getLastName()
                + (reason != null ? ". Reason: " + reason : "");
        notificationService.createNotification(expense.getCreatedBy().getId(), title, message, "EXPENSE", "/expenses");

        return saved;
    }

    @Override
    public byte[] exportApprovedExpensesToExcel() {
        List<Expense> approvedExpenses = expenseRepository.findByStatus(ExpenseStatus.APPROVED);

        try (Workbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream bos = new ByteArrayOutputStream()) {

            Sheet sheet = workbook.createSheet("Approved Expenses");

            // --- Styles ---
            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerFont.setColor(IndexedColors.WHITE.getIndex());
            headerFont.setFontHeightInPoints((short) 11);
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            headerStyle.setBorderBottom(BorderStyle.THIN);
            headerStyle.setBorderTop(BorderStyle.THIN);
            headerStyle.setBorderLeft(BorderStyle.THIN);
            headerStyle.setBorderRight(BorderStyle.THIN);
            headerStyle.setAlignment(HorizontalAlignment.CENTER);
            headerStyle.setVerticalAlignment(VerticalAlignment.CENTER);

            CellStyle textStyle = workbook.createCellStyle();
            textStyle.setBorderBottom(BorderStyle.THIN);
            textStyle.setBorderTop(BorderStyle.THIN);
            textStyle.setBorderLeft(BorderStyle.THIN);
            textStyle.setBorderRight(BorderStyle.THIN);
            textStyle.setVerticalAlignment(VerticalAlignment.CENTER);

            CellStyle currencyStyle = workbook.createCellStyle();
            currencyStyle.setDataFormat(workbook.createDataFormat().getFormat("#,##0.00"));
            currencyStyle.setBorderBottom(BorderStyle.THIN);
            currencyStyle.setBorderTop(BorderStyle.THIN);
            currencyStyle.setBorderLeft(BorderStyle.THIN);
            currencyStyle.setBorderRight(BorderStyle.THIN);
            currencyStyle.setAlignment(HorizontalAlignment.RIGHT);
            currencyStyle.setVerticalAlignment(VerticalAlignment.CENTER);

            CellStyle dateStyle = workbook.createCellStyle();
            dateStyle.setDataFormat(workbook.createDataFormat().getFormat("dd-mmm-yyyy"));
            dateStyle.setBorderBottom(BorderStyle.THIN);
            dateStyle.setBorderTop(BorderStyle.THIN);
            dateStyle.setBorderLeft(BorderStyle.THIN);
            dateStyle.setBorderRight(BorderStyle.THIN);
            dateStyle.setAlignment(HorizontalAlignment.CENTER);
            dateStyle.setVerticalAlignment(VerticalAlignment.CENTER);

            // --- Title row ---
            Row titleRow = sheet.createRow(0);
            titleRow.setHeightInPoints(24);
            Cell titleCell = titleRow.createCell(0);
            titleCell.setCellValue("Approved Expenses Report");
            CellStyle titleStyle = workbook.createCellStyle();
            Font titleFont = workbook.createFont();
            titleFont.setBold(true);
            titleFont.setFontHeightInPoints((short) 14);
            titleFont.setColor(IndexedColors.WHITE.getIndex());
            titleStyle.setFont(titleFont);
            titleStyle.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
            titleStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            titleStyle.setAlignment(HorizontalAlignment.CENTER);
            titleStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            titleCell.setCellStyle(titleStyle);
            sheet.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(0, 0, 0, 6));

            // --- Header row ---
            String[] headers = {"S/N", "Item", "Amount (ZMW)", "Expense Date", "Submitted By", "Approved By", "Approved At"};
            Row headerRow = sheet.createRow(2);
            headerRow.setHeightInPoints(20);
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }

            // --- Data rows ---
            int rowNum = 3;
            for (int i = 0; i < approvedExpenses.size(); i++) {
                Expense exp = approvedExpenses.get(i);
                Row row = sheet.createRow(rowNum++);

                // S/N
                Cell snCell = row.createCell(0);
                snCell.setCellValue(i + 1);
                snCell.setCellStyle(textStyle);

                // Item
                Cell itemCell = row.createCell(1);
                itemCell.setCellValue(exp.getItem());
                itemCell.setCellStyle(textStyle);

                // Amount
                Cell amtCell = row.createCell(2);
                amtCell.setCellValue(exp.getAmount().doubleValue());
                amtCell.setCellStyle(currencyStyle);

                // Expense Date
                Cell dateCell = row.createCell(3);
                dateCell.setCellValue(exp.getExpenseDate());
                dateCell.setCellStyle(dateStyle);

                // Submitted By
                Cell submitterCell = row.createCell(4);
                String submitterName = exp.getCreatedBy().getFirstName() + " " + exp.getCreatedBy().getLastName();
                submitterCell.setCellValue(submitterName);
                submitterCell.setCellStyle(textStyle);

                // Approved By
                Cell approverCell = row.createCell(5);
                if (exp.getApprovedBy() != null) {
                    approverCell.setCellValue(exp.getApprovedBy().getFirstName() + " " + exp.getApprovedBy().getLastName());
                } else {
                    approverCell.setCellValue("");
                }
                approverCell.setCellStyle(textStyle);

                // Approved At
                Cell approvedAtCell = row.createCell(6);
                if (exp.getApprovedAt() != null) {
                    approvedAtCell.setCellValue(exp.getApprovedAt());
                    CellStyle dateTimeStyle = workbook.createCellStyle();
                    dateTimeStyle.setDataFormat(workbook.createDataFormat().getFormat("dd-mmm-yyyy hh:mm"));
                    dateTimeStyle.setBorderBottom(BorderStyle.THIN);
                    dateTimeStyle.setBorderTop(BorderStyle.THIN);
                    dateTimeStyle.setBorderLeft(BorderStyle.THIN);
                    dateTimeStyle.setBorderRight(BorderStyle.THIN);
                    dateTimeStyle.setAlignment(HorizontalAlignment.CENTER);
                    dateTimeStyle.setVerticalAlignment(VerticalAlignment.CENTER);
                    approvedAtCell.setCellStyle(dateTimeStyle);
                } else {
                    approvedAtCell.setCellValue("");
                    approvedAtCell.setCellStyle(textStyle);
                }
            }

            // --- Summary row ---
            if (!approvedExpenses.isEmpty()) {
                Row summaryRow = sheet.createRow(rowNum + 1);
                Cell totalLabel = summaryRow.createCell(0);
                totalLabel.setCellValue("TOTAL");
                CellStyle totalLabelStyle = workbook.createCellStyle();
                Font boldFont = workbook.createFont();
                boldFont.setBold(true);
                boldFont.setFontHeightInPoints((short) 11);
                totalLabelStyle.setFont(boldFont);
                totalLabelStyle.setBorderTop(BorderStyle.DOUBLE);
                totalLabelStyle.setAlignment(HorizontalAlignment.RIGHT);
                totalLabelStyle.setVerticalAlignment(VerticalAlignment.CENTER);
                totalLabel.setCellStyle(totalLabelStyle);

                summaryRow.createCell(1).setCellStyle(totalLabelStyle);

                double totalAmount = approvedExpenses.stream()
                        .mapToDouble(e -> e.getAmount().doubleValue())
                        .sum();
                Cell totalValue = summaryRow.createCell(2);
                totalValue.setCellValue(totalAmount);
                CellStyle totalValueStyle = workbook.createCellStyle();
                Font boldCurrencyFont = workbook.createFont();
                boldCurrencyFont.setBold(true);
                boldCurrencyFont.setFontHeightInPoints((short) 11);
                totalValueStyle.setFont(boldCurrencyFont);
                totalValueStyle.setBorderTop(BorderStyle.DOUBLE);
                totalValueStyle.setDataFormat(workbook.createDataFormat().getFormat("#,##0.00"));
                totalValueStyle.setAlignment(HorizontalAlignment.RIGHT);
                totalValueStyle.setVerticalAlignment(VerticalAlignment.CENTER);
                totalValue.setCellStyle(totalValueStyle);

                // Count row
                Row countRow = sheet.createRow(rowNum + 2);
                Cell countLabel = countRow.createCell(0);
                countLabel.setCellValue("Total Items:");
                countLabel.setCellStyle(totalLabelStyle);
                countRow.createCell(1).setCellStyle(totalLabelStyle);
                Cell countValue = countRow.createCell(2);
                countValue.setCellValue(approvedExpenses.size());
                CellStyle intBoldStyle = workbook.createCellStyle();
                intBoldStyle.setFont(boldCurrencyFont);
                intBoldStyle.setBorderTop(BorderStyle.DOUBLE);
                intBoldStyle.setAlignment(HorizontalAlignment.RIGHT);
                intBoldStyle.setVerticalAlignment(VerticalAlignment.CENTER);
                countValue.setCellStyle(intBoldStyle);
            }

            // Auto-size columns
            for (int i = 0; i < 7; i++) {
                sheet.autoSizeColumn(i);
            }
            sheet.setColumnWidth(1, Math.max(sheet.getColumnWidth(1), 5000));

            workbook.write(bos);
            return bos.toByteArray();

        } catch (Exception e) {
            throw new RuntimeException("Failed to export approved expenses to Excel", e);
        }
    }
}
