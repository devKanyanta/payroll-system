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
}
