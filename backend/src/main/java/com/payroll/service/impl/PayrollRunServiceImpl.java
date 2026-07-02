package com.payroll.service.impl;

import com.payroll.dto.CashflowSummaryResponse;
import com.payroll.dto.PagedResponse;
import com.payroll.entity.*;
import com.payroll.exception.BadRequestException;
import com.payroll.exception.BusinessRuleException;
import com.payroll.exception.ResourceNotFoundException;
import com.payroll.repository.*;
import com.payroll.service.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class PayrollRunServiceImpl implements PayrollRunService {

    private final PayrollRunRepository payrollRunRepository;
    private final UserRepository userRepository;
    private final EmployeeRepository employeeRepository;
    private final PayrollEntryRepository payrollEntryRepository;
    private final PayrollSettingsRepository payrollSettingsRepository;
    private final LoanRepository loanRepository;
    private final PayrollCalculationService payrollCalculationService;
    private final PayslipService payslipService;
    private final NotificationService notificationService;
    private final AuditService auditService;
    private final EmployeeDeductionRepository employeeDeductionRepository;
    private final DeductionTypeRepository deductionTypeRepository;
    private final PayslipRepository payslipRepository;
    private final PayrollImportRepository payrollImportRepository;
    private final EmailService emailService;
    private final CashflowService cashflowService;

    @Value("${app.admin-email}")
    private String adminEmail;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    // ====================== Validation ======================

    @Override
    public List<Map<String, String>> validateBeforeSubmit(UUID runId) {
        PayrollRun payrollRun = payrollRunRepository.findById(runId)
                .orElseThrow(() -> new ResourceNotFoundException("PayrollRun", runId));

        List<PayrollEntry> entries = payrollEntryRepository.findByPayrollRunId(runId);
        List<Map<String, String>> errors = new ArrayList<>();

        // Rule 1: At least 1 employee entry
        if (entries.isEmpty()) {
            errors.add(Map.of(
                    "field", "entries",
                    "message", "Cannot submit an empty payroll run. Add at least one employee."
            ));
            return errors; // No point checking further
        }

        for (PayrollEntry entry : entries) {
            Employee emp = entry.getEmployee();
            String empName = emp.getFirstName() + " " + emp.getLastName();

            // Rule 2: All employees are active
            if (emp.getStatus() != EmployeeStatus.ACTIVE) {
                errors.add(Map.of(
                        "employeeName", empName,
                        "field", "status",
                        "message", empName + " is no longer active. Remove or update before submitting."
                ));
            }

            // Rule 3: Present days > 0
            if (entry.getPresentDays() == null || entry.getPresentDays().compareTo(BigDecimal.ZERO) <= 0) {
                errors.add(Map.of(
                        "employeeName", empName,
                        "field", "presentDays",
                        "message", empName + " has 0 present days. All employees must have present days > 0."
                ));
            }

            // Rule 4: Overtime hours ≥ 0
            if (entry.getOvertimeHours() != null && entry.getOvertimeHours().compareTo(BigDecimal.ZERO) < 0) {
                errors.add(Map.of(
                        "employeeName", empName,
                        "field", "overtimeHours",
                        "message", "Overtime hours cannot be negative for " + empName + "."
                ));
            }

            // Rule 5: Holiday hours ≥ 0
            if (entry.getHolidayHours() != null && entry.getHolidayHours().compareTo(BigDecimal.ZERO) < 0) {
                errors.add(Map.of(
                        "employeeName", empName,
                        "field", "holidayHours",
                        "message", "Holiday hours cannot be negative for " + empName + "."
                ));
            }

            // Rule 6: Net salary ≥ 0
            if (entry.getNetSalary() != null && entry.getNetSalary().compareTo(BigDecimal.ZERO) < 0) {
                errors.add(Map.of(
                        "employeeName", empName,
                        "field", "netSalary",
                        "message", "Net salary for " + empName + " is negative. Verify deductions."
                ));
            }
        }

        return errors;
    }

    // ====================== CRUD ======================

    @Override
    public PagedResponse<PayrollRun> getAllPayrollRuns(Integer month, Integer year, PayrollRunStatus status, Pageable pageable) {
        var page = payrollRunRepository.searchPayrollRuns(month, year, status, pageable);

        // Populate transient fields: entryCount and totalNetPay
        for (PayrollRun run : page.getContent()) {
            List<PayrollEntry> entries = payrollEntryRepository.findByPayrollRunId(run.getId());
            run.setEntryCount(entries.size());
            BigDecimal totalNetPay = BigDecimal.ZERO;
            for (PayrollEntry entry : entries) {
                if (entry.getNetSalary() != null) {
                    totalNetPay = totalNetPay.add(entry.getNetSalary());
                }
            }
            run.setTotalNetPay(totalNetPay);
        }

        return PagedResponse.from(page);
    }

    @Override
    public PayrollRun getPayrollRunById(UUID id) {
        PayrollRun run = payrollRunRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("PayrollRun", id));

        // Fetch and populate entries for the detail view
        List<PayrollEntry> entries = payrollEntryRepository.findByPayrollRunId(id);
        // Eagerly load employeeDeductions for each entry
        for (PayrollEntry entry : entries) {
            List<EmployeeDeduction> deductions = employeeDeductionRepository.findByPayrollEntryId(entry.getId());
            entry.setEmployeeDeductions(deductions);
        }
        run.setPayrollEntries(entries);

        return run;
    }

    @Override
    @Transactional
    public PayrollRun createPayrollRun(Integer month, Integer year, UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));

        if (payrollRunRepository.existsByMonthAndYear(month, year)) {
            throw new BadRequestException("Payroll run already exists for " + month + "/" + year);
        }

        PayrollRun payrollRun = PayrollRun.builder()
                .month(month)
                .year(year)
                .status(PayrollRunStatus.DRAFT)
                .createdBy(user)
                .build();

        PayrollRun saved = payrollRunRepository.save(payrollRun);

        auditService.logEvent(userId, "CREATE", "PayrollRun", saved.getId().toString(),
                null, String.format("Payroll run created for %d/%d", month, year), null);

        return saved;
    }

    // ====================== Status Transitions ======================

    @Override
    @Transactional
    public PayrollRun submitPayrollRun(UUID id, UUID userId) {
        PayrollRun payrollRun = payrollRunRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("PayrollRun", id));

        if (payrollRun.getStatus() != PayrollRunStatus.DRAFT) {
            throw new BusinessRuleException("Only DRAFT payroll runs can be submitted");
        }

        // Run validation
        List<Map<String, String>> validationErrors = validateBeforeSubmit(id);
        if (!validationErrors.isEmpty()) {
            throw new BusinessRuleException("Validation failed: " + validationErrors.size() + " error(s) found. Fix before submitting.");
        }

        User submitter = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));

        payrollRun.setStatus(PayrollRunStatus.SUBMITTED);
        PayrollRun saved = payrollRunRepository.save(payrollRun);

        auditService.logEvent(userId, "SUBMIT", "PayrollRun", saved.getId().toString(),
                "DRAFT", "SUBMITTED", null);

        // Notify all MANAGER users
        List<User> managers = userRepository.findByRole(Role.MANAGER);
        String monthName = getMonthName(payrollRun.getMonth());
        String title = "Payroll Submitted";
        String message = submitter.getFirstName() + " " + submitter.getLastName()
                + " submitted " + monthName + " " + payrollRun.getYear() + " payroll for approval.";
        String link = frontendUrl + "/payroll-runs/" + saved.getId();

        for (User manager : managers) {
            notificationService.createNotification(manager.getId(), title, message, "PAYROLL", link);
        }

        // Also notify ADMIN users
        List<User> admins = userRepository.findByRole(Role.ADMIN);
        for (User admin : admins) {
            if (!admin.getId().equals(userId)) { // Don't notify self
                notificationService.createNotification(admin.getId(), title, message, "PAYROLL", link);
            }
        }

        // Send email notification to admin
        try {
            emailService.sendSimpleMessage(
                adminEmail,
                title,
                message + "\n\nPlease log in to the system to review and approve or reject this payroll run.\n\n" + link
            );
        } catch (Exception e) {
            log.warn("Failed to send admin email notification for payroll submission: {}", e.getMessage());
        }

        return saved;
    }

    @Override
    @Transactional
    public PayrollRun approvePayrollRun(UUID id, UUID userId) {
        PayrollRun payrollRun = payrollRunRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("PayrollRun", id));

        if (payrollRun.getStatus() != PayrollRunStatus.SUBMITTED) {
            throw new BusinessRuleException("Only SUBMITTED payroll runs can be approved");
        }

        User approver = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));

        // Separation of duties: submitter cannot approve
        if (payrollRun.getCreatedBy().getId().equals(userId)) {
            throw new BusinessRuleException("You cannot approve a payroll run that you submitted.");
        }

        payrollRun.setStatus(PayrollRunStatus.APPROVED);
        payrollRun.setApprovedBy(approver);
        payrollRun.setApprovedAt(LocalDateTime.now());
        PayrollRun saved = payrollRunRepository.save(payrollRun);

        auditService.logEvent(userId, "APPROVE", "PayrollRun", saved.getId().toString(),
                "SUBMITTED", "APPROVED", null);

        // Auto-generate payslips
        try {
            payslipService.generatePayslips(id);
        } catch (Exception e) {
            // Log but don't fail the approval — payslips can be regenerated manually
            auditService.logEvent(userId, "ERROR", "PayslipGeneration", id.toString(),
                    null, "Failed to auto-generate payslips: " + e.getMessage(), null);
        }

        // Notify the submitter
        String monthName = getMonthName(payrollRun.getMonth());
        String title = "Payroll Approved";
        String message = approver.getFirstName() + " " + approver.getLastName()
                + " approved " + monthName + " " + payrollRun.getYear() + " payroll.";
        String link = "/payroll-runs/" + saved.getId();

        User submitter = payrollRun.getCreatedBy();
        notificationService.createNotification(submitter.getId(), title, message, "PAYROLL", link);

        // Notify HR users
        List<User> hrUsers = userRepository.findByRole(Role.HR);
        for (User hr : hrUsers) {
            if (!hr.getId().equals(submitter.getId())) {
                notificationService.createNotification(hr.getId(), title,
                        "Payroll for " + monthName + " " + payrollRun.getYear() + " has been approved. Payslips are being generated.",
                        "PAYROLL", link);
            }
        }

        return saved;
    }

    @Override
    @Transactional
    public PayrollRun rejectPayrollRun(UUID id, UUID userId, String reason) {
        PayrollRun payrollRun = payrollRunRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("PayrollRun", id));

        if (payrollRun.getStatus() != PayrollRunStatus.SUBMITTED) {
            throw new BusinessRuleException("Only SUBMITTED payroll runs can be rejected");
        }

        User rejector = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));

        payrollRun.setStatus(PayrollRunStatus.REJECTED);
        payrollRun.setRejectedBy(rejector);
        payrollRun.setRejectedAt(LocalDateTime.now());
        payrollRun.setRejectionReason(reason);
        PayrollRun saved = payrollRunRepository.save(payrollRun);

        auditService.logEvent(userId, "REJECT", "PayrollRun", saved.getId().toString(),
                "SUBMITTED", "REJECTED: " + reason, null);

        // Notify the submitter
        String monthName = getMonthName(payrollRun.getMonth());
        String title = "Payroll Rejected";
        String message = rejector.getFirstName() + " " + rejector.getLastName()
                + " rejected " + monthName + " " + payrollRun.getYear()
                + " payroll. Reason: " + reason;
        String link = "/payroll-runs/" + saved.getId();

        User submitter = payrollRun.getCreatedBy();
        notificationService.createNotification(submitter.getId(), title, message, "PAYROLL", link);

        return saved;
    }

    @Override
    @Transactional
    public PayrollRun reopenPayrollRun(UUID id, UUID userId) {
        PayrollRun payrollRun = payrollRunRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("PayrollRun", id));

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));

        // REJECTED runs can be reopened by HR/ADMIN; APPROVED runs can only be reopened by ADMIN
        if (payrollRun.getStatus() == PayrollRunStatus.APPROVED && user.getRole() != Role.ADMIN) {
            throw new BusinessRuleException("Only ADMIN users can reopen approved payroll runs.");
        }

        if (payrollRun.getStatus() != PayrollRunStatus.REJECTED && payrollRun.getStatus() != PayrollRunStatus.APPROVED) {
            throw new BusinessRuleException("Only REJECTED or APPROVED payroll runs can be reopened.");
        }

        String oldStatus = payrollRun.getStatus().name();

        payrollRun.setStatus(PayrollRunStatus.DRAFT);
        payrollRun.setRejectedBy(null);
        payrollRun.setRejectedAt(null);
        payrollRun.setRejectionReason(null);
        payrollRun.setApprovedBy(null);
        payrollRun.setApprovedAt(null);
        PayrollRun saved = payrollRunRepository.save(payrollRun);

        auditService.logEvent(userId, "REOPEN", "PayrollRun", saved.getId().toString(),
                oldStatus, "DRAFT", null);

        // If reopening from APPROVED, invalidate existing payslips
        if ("APPROVED".equals(oldStatus)) {
            payslipService.invalidatePayslipsForRun(id);
        }

        return saved;
    }

    // ====================== Employee Management ======================

    @Override
    @Transactional
    public List<PayrollEntry> addEmployeesToPayrollRun(UUID runId, List<UUID> employeeIds, UUID userId) {
        PayrollRun payrollRun = payrollRunRepository.findById(runId)
                .orElseThrow(() -> new ResourceNotFoundException("PayrollRun", runId));

        if (payrollRun.getStatus() != PayrollRunStatus.DRAFT) {
            throw new BusinessRuleException("Can only add employees to DRAFT payroll runs");
        }

        PayrollSettings settings = payrollSettingsRepository
                .findTopByEffectiveDateLessThanEqualOrderByEffectiveDateDesc(LocalDate.now())
                .orElseGet(() -> PayrollSettings.builder()
                        .effectiveDate(LocalDate.now())
                        .nhimaEmployeePercent(new BigDecimal("1.00"))
                        .nhimaEmployerPercent(new BigDecimal("1.00"))
                        .napsaEmployeePercent(new BigDecimal("5.00"))
                        .napsaEmployerPercent(new BigDecimal("5.00"))
                        .overtimeRate(new BigDecimal("1.50"))
                        .holidayRate(new BigDecimal("2.00"))
                        .workingDaysPerMonth(22)
                        .hoursPerDay(8)
                        .napsaMaxEarnings(new BigDecimal("5000.00"))
                        .softLoanInterestRate(new BigDecimal("0.300"))
                        .build());

        List<PayrollEntry> createdEntries = new ArrayList<>();
        List<Employee> employees = employeeRepository.findAllById(employeeIds);

        for (Employee employee : employees) {
            if (payrollEntryRepository.findByPayrollRunIdAndEmployeeId(runId, employee.getId()).isPresent()) {
                continue; // Skip if already in the run
            }

            // Get active loans for this employee
            List<Loan> activeLoans = loanRepository.findByEmployeeIdAndStatus(employee.getId(), LoanStatus.ACTIVE);

            PayrollEntry entry = payrollCalculationService.calculatePayrollEntry(
                    employee, settings,
                    BigDecimal.ZERO, BigDecimal.ZERO,
                    activeLoans, BigDecimal.ZERO,
                    BigDecimal.valueOf(settings.getWorkingDaysPerMonth()));

            entry.setPayrollRun(payrollRun);
            entry.setEmployee(employee);

            PayrollEntry saved = payrollEntryRepository.save(entry);

            // Copy over any existing employee deductions (from EmployeeDeduction template? No, only per-entry deductions exist.)
            createdEntries.add(saved);
        }

        return createdEntries;
    }

    @Override
    @Transactional
    public void removeEmployeeFromPayrollRun(UUID runId, UUID entryId, UUID userId) {
        PayrollRun payrollRun = payrollRunRepository.findById(runId)
                .orElseThrow(() -> new ResourceNotFoundException("PayrollRun", runId));

        if (payrollRun.getStatus() != PayrollRunStatus.DRAFT) {
            throw new BusinessRuleException("Can only remove employees from DRAFT payroll runs");
        }

        PayrollEntry entry = payrollEntryRepository.findById(entryId)
                .orElseThrow(() -> new ResourceNotFoundException("PayrollEntry", entryId));

        if (!entry.getPayrollRun().getId().equals(runId)) {
            throw new BadRequestException("Entry does not belong to this payroll run");
        }

        // Remove associated deductions first
        List<EmployeeDeduction> deductions = employeeDeductionRepository.findByPayrollEntryId(entryId);
        employeeDeductionRepository.deleteAll(deductions);

        payrollEntryRepository.delete(entry);
    }

    // ====================== Entry Management ======================

    @Override
    @Transactional
    public PayrollEntry updatePayrollEntry(UUID runId, UUID entryId,
                                            BigDecimal presentDays,
                                            BigDecimal overtimeHours,
                                            BigDecimal holidayHours) {
        PayrollRun payrollRun = payrollRunRepository.findById(runId)
                .orElseThrow(() -> new ResourceNotFoundException("PayrollRun", runId));

        if (payrollRun.getStatus() != PayrollRunStatus.DRAFT) {
            throw new BusinessRuleException("Can only edit entries in DRAFT payroll runs");
        }

        PayrollEntry entry = payrollEntryRepository.findById(entryId)
                .orElseThrow(() -> new ResourceNotFoundException("PayrollEntry", entryId));

        if (!entry.getPayrollRun().getId().equals(runId)) {
            throw new BadRequestException("Entry does not belong to this payroll run");
        }

        PayrollSettings settings = payrollSettingsRepository
                .findTopByEffectiveDateLessThanEqualOrderByEffectiveDateDesc(LocalDate.now())
                .orElseThrow(() -> new ResourceNotFoundException("PayrollSettings", "effective_date", LocalDate.now().toString()));

        List<Loan> activeLoans = loanRepository.findByEmployeeIdAndStatus(
                entry.getEmployee().getId(), LoanStatus.ACTIVE);

        PayrollEntry recalculated = payrollCalculationService.calculatePayrollEntry(
                entry.getEmployee(), settings,
                overtimeHours != null ? overtimeHours : entry.getOvertimeHours(),
                holidayHours != null ? holidayHours : entry.getHolidayHours(),
                activeLoans,
                entry.getOtherDeductions(),
                presentDays != null ? presentDays : entry.getPresentDays());

        recalculated.setId(entry.getId());
        recalculated.setPayrollRun(payrollRun);
        recalculated.setEmployee(entry.getEmployee());

        return payrollEntryRepository.save(recalculated);
    }

    @Override
    @Transactional
    public void recalculateLoanDeductions(UUID runId) {
        PayrollRun payrollRun = payrollRunRepository.findById(runId)
                .orElseThrow(() -> new ResourceNotFoundException("PayrollRun", runId));

        if (payrollRun.getStatus() != PayrollRunStatus.DRAFT) {
            throw new BusinessRuleException("Can only recalculate deductions in DRAFT payroll runs");
        }

        PayrollSettings settings = payrollSettingsRepository
                .findTopByEffectiveDateLessThanEqualOrderByEffectiveDateDesc(LocalDate.now())
                .orElseThrow(() -> new ResourceNotFoundException("PayrollSettings", "effective_date", LocalDate.now().toString()));

        List<PayrollEntry> entries = payrollEntryRepository.findByPayrollRunId(runId);

        for (PayrollEntry entry : entries) {
            List<Loan> activeLoans = loanRepository.findByEmployeeIdAndStatus(
                    entry.getEmployee().getId(), LoanStatus.ACTIVE);

            BigDecimal softloanDeduction = payrollCalculationService.calculateLoanDeduction(
                    activeLoans, settings.getSoftLoanInterestRate());
            BigDecimal loanBalance = payrollCalculationService.calculateTotalLoanBalance(activeLoans);

            entry.setLoanDeduction(softloanDeduction);
            entry.setLoanBalance(loanBalance);

            // Recalculate net salary: gross - nhima - napsa - loanDeduction
            BigDecimal netSalary = payrollCalculationService.calculateNetSalary(
                    entry.getGrossSalary(),
                    entry.getNhima() != null ? entry.getNhima() : BigDecimal.ZERO,
                    entry.getNapsa() != null ? entry.getNapsa() : BigDecimal.ZERO,
                    softloanDeduction);
            entry.setNetSalary(netSalary);

            payrollEntryRepository.save(entry);
        }
    }

    // ====================== Deduction Management ======================

    @Override
    @Transactional
    public EmployeeDeduction addDeductionToEntry(UUID runId, UUID entryId, UUID deductionTypeId, BigDecimal amount) {
        PayrollRun payrollRun = payrollRunRepository.findById(runId)
                .orElseThrow(() -> new ResourceNotFoundException("PayrollRun", runId));

        if (payrollRun.getStatus() != PayrollRunStatus.DRAFT) {
            throw new BusinessRuleException("Can only edit deductions in DRAFT payroll runs");
        }

        PayrollEntry entry = payrollEntryRepository.findById(entryId)
                .orElseThrow(() -> new ResourceNotFoundException("PayrollEntry", entryId));

        if (!entry.getPayrollRun().getId().equals(runId)) {
            throw new BadRequestException("Entry does not belong to this payroll run");
        }

        DeductionType deductionType = deductionTypeRepository.findById(deductionTypeId)
                .orElseThrow(() -> new ResourceNotFoundException("DeductionType", deductionTypeId));

        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BadRequestException("Deduction amount must be greater than zero");
        }

        EmployeeDeduction employeeDeduction = EmployeeDeduction.builder()
                .payrollEntry(entry)
                .deductionType(deductionType)
                .amount(amount)
                .build();

        EmployeeDeduction saved = employeeDeductionRepository.save(employeeDeduction);

        // Recalculate otherDeductions sum and net salary
        recalculateOtherDeductions(entry);

        return saved;
    }

    @Override
    @Transactional
    public void removeDeductionFromEntry(UUID runId, UUID entryId, UUID deductionId) {
        PayrollRun payrollRun = payrollRunRepository.findById(runId)
                .orElseThrow(() -> new ResourceNotFoundException("PayrollRun", runId));

        if (payrollRun.getStatus() != PayrollRunStatus.DRAFT) {
            throw new BusinessRuleException("Can only edit deductions in DRAFT payroll runs");
        }

        PayrollEntry entry = payrollEntryRepository.findById(entryId)
                .orElseThrow(() -> new ResourceNotFoundException("PayrollEntry", entryId));

        if (!entry.getPayrollRun().getId().equals(runId)) {
            throw new BadRequestException("Entry does not belong to this payroll run");
        }

        EmployeeDeduction deduction = employeeDeductionRepository.findById(deductionId)
                .orElseThrow(() -> new ResourceNotFoundException("EmployeeDeduction", deductionId));

        if (!deduction.getPayrollEntry().getId().equals(entryId)) {
            throw new BadRequestException("Deduction does not belong to this entry");
        }

        employeeDeductionRepository.delete(deduction);

        // Recalculate otherDeductions sum
        recalculateOtherDeductions(entry);
    }

    private void recalculateOtherDeductions(PayrollEntry entry) {
        List<EmployeeDeduction> deductions = employeeDeductionRepository.findByPayrollEntryId(entry.getId());
        BigDecimal totalOtherDeductions = BigDecimal.ZERO;
        for (EmployeeDeduction ed : deductions) {
            totalOtherDeductions = totalOtherDeductions.add(ed.getAmount());
        }
        entry.setOtherDeductions(totalOtherDeductions);

        // Net salary already calculated, other deductions don't affect net pay
        payrollEntryRepository.save(entry);
    }

    // ====================== Bulk Email ======================

    @Override
    @Transactional
    public Map<String, Object> emailAllPayslips(UUID runId) {
        PayrollRun payrollRun = payrollRunRepository.findById(runId)
                .orElseThrow(() -> new ResourceNotFoundException("PayrollRun", runId));

        if (payrollRun.getStatus() != PayrollRunStatus.APPROVED) {
            throw new BusinessRuleException("Payslips can only be emailed for APPROVED payroll runs");
        }

        return payslipService.emailAllPayslipsForRun(runId);
    }

    // ====================== Excel Export ======================

    @Override
    public byte[] exportPayrollRunToExcel(UUID runId) {
        PayrollRun payrollRun = payrollRunRepository.findById(runId)
                .orElseThrow(() -> new ResourceNotFoundException("PayrollRun", runId));

        // Export only available from SUBMITTED status onwards
        if (payrollRun.getStatus() == PayrollRunStatus.DRAFT) {
            throw new BusinessRuleException("Excel export is only available after submitting the payroll run.");
        }

        List<PayrollEntry> entries = payrollEntryRepository.findByPayrollRunId(runId);

        try (InputStream templateStream = new ClassPathResource("PAYROLL TEMPLATE.xlsx").getInputStream();
             Workbook workbook = new XSSFWorkbook(templateStream)) {

            PayrollSettings settings = payrollSettingsRepository
                    .findTopByEffectiveDateLessThanEqualOrderByEffectiveDateDesc(LocalDate.now())
                    .orElse(null);

            // ============================================================
            // SHARED STYLES
            // ============================================================

            CellStyle navyHeaderStyle = workbook.createCellStyle();
            Font navyFont = workbook.createFont();
            navyFont.setBold(true);
            navyFont.setColor(IndexedColors.WHITE.getIndex());
            navyFont.setFontHeightInPoints((short) 10);
            navyHeaderStyle.setFont(navyFont);
            navyHeaderStyle.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
            navyHeaderStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            navyHeaderStyle.setBorderBottom(BorderStyle.THIN);
            navyHeaderStyle.setBorderTop(BorderStyle.THIN);
            navyHeaderStyle.setBorderLeft(BorderStyle.THIN);
            navyHeaderStyle.setBorderRight(BorderStyle.THIN);
            navyHeaderStyle.setAlignment(HorizontalAlignment.CENTER);
            navyHeaderStyle.setVerticalAlignment(VerticalAlignment.CENTER);

            CellStyle currencyStyle = workbook.createCellStyle();
            currencyStyle.setDataFormat(workbook.createDataFormat().getFormat("#,##0.00"));
            currencyStyle.setBorderBottom(BorderStyle.THIN);
            currencyStyle.setBorderTop(BorderStyle.THIN);
            currencyStyle.setBorderLeft(BorderStyle.THIN);
            currencyStyle.setBorderRight(BorderStyle.THIN);
            currencyStyle.setAlignment(HorizontalAlignment.RIGHT);
            currencyStyle.setVerticalAlignment(VerticalAlignment.CENTER);

            CellStyle intStyle = workbook.createCellStyle();
            intStyle.setDataFormat(workbook.createDataFormat().getFormat("#,##0"));
            intStyle.setBorderBottom(BorderStyle.THIN);
            intStyle.setBorderTop(BorderStyle.THIN);
            intStyle.setBorderLeft(BorderStyle.THIN);
            intStyle.setBorderRight(BorderStyle.THIN);
            intStyle.setAlignment(HorizontalAlignment.RIGHT);
            intStyle.setVerticalAlignment(VerticalAlignment.CENTER);

            CellStyle textStyle = workbook.createCellStyle();
            textStyle.setBorderBottom(BorderStyle.THIN);
            textStyle.setBorderTop(BorderStyle.THIN);
            textStyle.setBorderLeft(BorderStyle.THIN);
            textStyle.setBorderRight(BorderStyle.THIN);
            textStyle.setAlignment(HorizontalAlignment.LEFT);
            textStyle.setVerticalAlignment(VerticalAlignment.CENTER);

            CellStyle totalLabelStyle = workbook.createCellStyle();
            Font boldFont = workbook.createFont();
            boldFont.setBold(true);
            boldFont.setFontHeightInPoints((short) 10);
            totalLabelStyle.setFont(boldFont);
            totalLabelStyle.setBorderTop(BorderStyle.DOUBLE);
            totalLabelStyle.setAlignment(HorizontalAlignment.RIGHT);
            totalLabelStyle.setVerticalAlignment(VerticalAlignment.CENTER);

            CellStyle totalValueStyle = workbook.createCellStyle();
            Font boldCurrencyFont = workbook.createFont();
            boldCurrencyFont.setBold(true);
            boldCurrencyFont.setFontHeightInPoints((short) 11);
            totalValueStyle.setFont(boldCurrencyFont);
            totalValueStyle.setBorderTop(BorderStyle.DOUBLE);
            totalValueStyle.setDataFormat(workbook.createDataFormat().getFormat("#,##0.00"));
            totalValueStyle.setAlignment(HorizontalAlignment.RIGHT);
            totalValueStyle.setVerticalAlignment(VerticalAlignment.CENTER);

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

            CellStyle subtitleStyle = workbook.createCellStyle();
            Font subtitleFont = workbook.createFont();
            subtitleFont.setFontHeightInPoints((short) 10);
            subtitleFont.setColor(IndexedColors.GREY_80_PERCENT.getIndex());
            subtitleStyle.setFont(subtitleFont);
            subtitleStyle.setAlignment(HorizontalAlignment.CENTER);

            CellStyle totalRowLabelStyle = workbook.createCellStyle();
            totalRowLabelStyle.setFont(boldFont);
            totalRowLabelStyle.setBorderBottom(BorderStyle.THIN);
            totalRowLabelStyle.setBorderTop(BorderStyle.DOUBLE);
            totalRowLabelStyle.setFillForegroundColor(IndexedColors.LIGHT_CORNFLOWER_BLUE.getIndex());
            totalRowLabelStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            totalRowLabelStyle.setAlignment(HorizontalAlignment.RIGHT);
            totalRowLabelStyle.setVerticalAlignment(VerticalAlignment.CENTER);

            CellStyle totalRowValueStyle = workbook.createCellStyle();
            totalRowValueStyle.setFont(boldCurrencyFont);
            totalRowValueStyle.setBorderBottom(BorderStyle.THIN);
            totalRowValueStyle.setBorderTop(BorderStyle.DOUBLE);
            totalRowValueStyle.setDataFormat(workbook.createDataFormat().getFormat("#,##0.00"));
            totalRowValueStyle.setFillForegroundColor(IndexedColors.LIGHT_CORNFLOWER_BLUE.getIndex());
            totalRowValueStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            totalRowValueStyle.setAlignment(HorizontalAlignment.RIGHT);
            totalRowValueStyle.setVerticalAlignment(VerticalAlignment.CENTER);

            CellStyle altRowStyle = workbook.createCellStyle();
            altRowStyle.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            altRowStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            altRowStyle.setBorderBottom(BorderStyle.THIN);
            altRowStyle.setBorderLeft(BorderStyle.THIN);
            altRowStyle.setBorderRight(BorderStyle.THIN);
            altRowStyle.setVerticalAlignment(VerticalAlignment.CENTER);

            String[] monthNames = {
                "January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"
            };
            String periodStr = monthNames[payrollRun.getMonth() - 1] + " " + payrollRun.getYear();
            int normalWorkingHrs = settings != null ? settings.getHoursPerDay() : 8;

            // ============================================================
            // SHEET 1: PAYROLL SUMMARY
            // ============================================================
            Sheet sheet = workbook.getSheet("PAYROLL");
            if (sheet == null) {
                sheet = workbook.createSheet("PAYROLL");
            }

            // Clear all existing rows
            for (int i = sheet.getLastRowNum(); i >= 0; i--) {
                Row row = sheet.getRow(i);
                if (row != null) {
                    sheet.removeRow(row);
                }
            }

            // --- Title row ---
            Row titleRow = sheet.createRow(0);
            titleRow.setHeightInPoints(24);
            Cell titleCell = titleRow.createCell(0);
            titleCell.setCellValue("Musunga Engineering Services Ltd — PAYROLL SUMMARY " + periodStr);
            titleCell.setCellStyle(titleStyle);
            // Merge title across all columns
            sheet.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(0, 0, 0, 21));

            // --- Subtitle row ---
            Row subtitleRow = sheet.createRow(1);
            subtitleRow.setHeightInPoints(18);
            Cell subtitleCell = subtitleRow.createCell(0);
            subtitleCell.setCellValue("Payroll Department  |  " + periodStr);
            subtitleCell.setCellStyle(subtitleStyle);
            sheet.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(1, 1, 0, 21));

            // --- Header row (row 3, 0-indexed = 2 after title rows) ---
            Row headerRow = sheet.createRow(3);
            headerRow.setHeightInPoints(22);
            String[] headers = {"S/N", "NAMES", "NRC", "JOB TITLE", "SITE", "RATE/HRS",
                    "NORMAL HRS", "OT RATE", "HOL RATE",
                    "PRESENT DAYS", "PRESENT AMT", "OT HRS", "OT AMT",
                    "HOL HRS", "HOL AMT", "GROSS",
                    "NHIMA", "NAPSA", "LOAN BAL", "LOAN DED",
                    "OTHER DED", "NET PAY"};
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(navyHeaderStyle);
            }

            // --- Data rows starting from row 4 ---
            int rowNum = 4;
            for (int i = 0; i < entries.size(); i++) {
                PayrollEntry entry = entries.get(i);
                Row row = sheet.createRow(rowNum++);
                row.setHeightInPoints(18);

                Cell snCell = row.createCell(0);
                snCell.setCellValue(i + 1);
                snCell.setCellStyle(i % 2 == 0 ? textStyle : altRowStyle);

                Cell nameCell = row.createCell(1);
                nameCell.setCellValue(entry.getEmployee().getFirstName() + " " + entry.getEmployee().getLastName());
                nameCell.setCellStyle(i % 2 == 0 ? textStyle : altRowStyle);

                Cell nrcCell = row.createCell(2);
                nrcCell.setCellValue(entry.getEmployee().getNrc());
                nrcCell.setCellStyle(i % 2 == 0 ? textStyle : altRowStyle);

                Cell posCell = row.createCell(3);
                posCell.setCellValue(entry.getEmployee().getPosition() != null ? entry.getEmployee().getPosition() : "");
                posCell.setCellStyle(i % 2 == 0 ? textStyle : altRowStyle);

                Cell siteCell = row.createCell(4);
                siteCell.setCellValue(entry.getSite() != null ? entry.getSite() : "");
                siteCell.setCellStyle(i % 2 == 0 ? textStyle : altRowStyle);

                Cell rateCell = row.createCell(5);
                rateCell.setCellValue(entry.getHourlyRate() != null ? entry.getHourlyRate().doubleValue() : 0);
                rateCell.setCellStyle(i % 2 == 0 ? currencyStyle : cloneStyle(workbook, altRowStyle));

                Cell hrsCell = row.createCell(6);
                hrsCell.setCellValue(normalWorkingHrs);
                hrsCell.setCellStyle(i % 2 == 0 ? intStyle : cloneStyle(workbook, altRowStyle));

                // Overtime rate
                BigDecimal overtimeRateSetting = settings != null ? settings.getOvertimeRate() : new BigDecimal("1.5");
                BigDecimal otRateVal = entry.getHourlyRate() != null
                        ? entry.getHourlyRate().multiply(overtimeRateSetting)
                        : BigDecimal.ZERO;
                Cell otRateCell = row.createCell(7);
                otRateCell.setCellValue(otRateVal.doubleValue());
                otRateCell.setCellStyle(i % 2 == 0 ? currencyStyle : cloneStyle(workbook, altRowStyle));

                // Holiday rate
                BigDecimal holidayRateSetting = settings != null ? settings.getHolidayRate() : new BigDecimal("2.0");
                BigDecimal holRateVal = entry.getHourlyRate() != null
                        ? entry.getHourlyRate().multiply(holidayRateSetting)
                        : BigDecimal.ZERO;
                Cell holRateCell = row.createCell(8);
                holRateCell.setCellValue(holRateVal.doubleValue());
                holRateCell.setCellStyle(i % 2 == 0 ? currencyStyle : cloneStyle(workbook, altRowStyle));

                // Present days
                Cell presentDaysCell = row.createCell(9);
                presentDaysCell.setCellValue(entry.getPresentDays() != null ? entry.getPresentDays().doubleValue() : 0);
                presentDaysCell.setCellStyle(i % 2 == 0 ? intStyle : cloneStyle(workbook, altRowStyle));

                // Present amount
                Cell presentAmtCell = row.createCell(10);
                presentAmtCell.setCellValue(entry.getRegularAmount() != null ? entry.getRegularAmount().doubleValue() : 0);
                presentAmtCell.setCellStyle(i % 2 == 0 ? currencyStyle : cloneStyle(workbook, altRowStyle));

                // OT hours
                Cell otHrsCell = row.createCell(11);
                otHrsCell.setCellValue(entry.getOvertimeHours() != null ? entry.getOvertimeHours().doubleValue() : 0);
                otHrsCell.setCellStyle(i % 2 == 0 ? intStyle : cloneStyle(workbook, altRowStyle));

                // OT amount
                Cell otAmtCell = row.createCell(12);
                otAmtCell.setCellValue(entry.getOvertimeAmount() != null ? entry.getOvertimeAmount().doubleValue() : 0);
                otAmtCell.setCellStyle(i % 2 == 0 ? currencyStyle : cloneStyle(workbook, altRowStyle));

                // Holiday hours
                Cell holHrsCell = row.createCell(13);
                holHrsCell.setCellValue(entry.getHolidayHours() != null ? entry.getHolidayHours().doubleValue() : 0);
                holHrsCell.setCellStyle(i % 2 == 0 ? intStyle : cloneStyle(workbook, altRowStyle));

                // Holiday amount
                Cell holAmtCell = row.createCell(14);
                holAmtCell.setCellValue(entry.getHolidayAmount() != null ? entry.getHolidayAmount().doubleValue() : 0);
                holAmtCell.setCellStyle(i % 2 == 0 ? currencyStyle : cloneStyle(workbook, altRowStyle));

                // Gross salary
                Cell grossCell = row.createCell(15);
                grossCell.setCellValue(entry.getGrossSalary() != null ? entry.getGrossSalary().doubleValue() : 0);
                grossCell.setCellStyle(i % 2 == 0 ? currencyStyle : cloneStyle(workbook, altRowStyle));

                // NHIMA
                Cell nhimaCell = row.createCell(16);
                nhimaCell.setCellValue(entry.getNhima() != null ? entry.getNhima().doubleValue() : 0);
                nhimaCell.setCellStyle(i % 2 == 0 ? currencyStyle : cloneStyle(workbook, altRowStyle));

                // NAPSA
                Cell napsaCell = row.createCell(17);
                napsaCell.setCellValue(entry.getNapsa() != null ? entry.getNapsa().doubleValue() : 0);
                napsaCell.setCellStyle(i % 2 == 0 ? currencyStyle : cloneStyle(workbook, altRowStyle));

                // Loan balance
                Cell loanBalCell = row.createCell(18);
                loanBalCell.setCellValue(entry.getLoanBalance() != null ? entry.getLoanBalance().doubleValue() : 0);
                loanBalCell.setCellStyle(i % 2 == 0 ? currencyStyle : cloneStyle(workbook, altRowStyle));

                // Loan deduction
                Cell loanDedCell = row.createCell(19);
                loanDedCell.setCellValue(entry.getLoanDeduction() != null ? entry.getLoanDeduction().doubleValue() : 0);
                loanDedCell.setCellStyle(i % 2 == 0 ? currencyStyle : cloneStyle(workbook, altRowStyle));

                // Other deductions
                Cell otherDedCell = row.createCell(20);
                otherDedCell.setCellValue(entry.getOtherDeductions() != null ? entry.getOtherDeductions().doubleValue() : 0);
                otherDedCell.setCellStyle(i % 2 == 0 ? currencyStyle : cloneStyle(workbook, altRowStyle));

                // Net pay
                Cell netCell = row.createCell(21);
                netCell.setCellValue(entry.getNetSalary() != null ? entry.getNetSalary().doubleValue() : 0);
                netCell.setCellStyle(i % 2 == 0 ? currencyStyle : cloneStyle(workbook, altRowStyle));
            }

            // --- Totals row ---
            if (!entries.isEmpty()) {
                Row summaryRow = sheet.createRow(rowNum);
                summaryRow.setHeightInPoints(20);

                Cell totalLabel = summaryRow.createCell(0);
                totalLabel.setCellValue("TOTALS");
                totalLabel.setCellStyle(totalRowLabelStyle);

                // Merge "TOTALS" across first few columns
                for (int i = 1; i <= 8; i++) {
                    Cell emptyCell = summaryRow.createCell(i);
                    emptyCell.setCellStyle(totalRowLabelStyle);
                }

                // Sum numeric columns
                int[] sumCols = {9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21};
                for (int col : sumCols) {
                    double sum = 0;
                    for (int r = 4; r < rowNum; r++) {
                        Row dataRow = sheet.getRow(r);
                        if (dataRow != null) {
                            Cell cell = dataRow.getCell(col);
                            if (cell != null) {
                                sum += cell.getNumericCellValue();
                            }
                        }
                    }
                    Cell sumCell = summaryRow.createCell(col);
                    sumCell.setCellValue(sum);
                    sumCell.setCellStyle(totalRowValueStyle);
                }
            }

            // ────────────────────────────────────────────────────────────
            // COMPANY CASHFLOW SECTION
            // ────────────────────────────────────────────────────────────
            int cashflowStartRow = rowNum + 2; // Leave a blank row after totals

            try {
                int month = payrollRun.getMonth();
                int year = payrollRun.getYear();
                CashflowSummaryResponse cashflow = cashflowService.getCashflowSummary(month, year);

                if (cashflow != null && cashflow.getSites() != null && cashflow.getSites().stream().anyMatch(s -> s.getSubTotal().compareTo(BigDecimal.ZERO) > 0)) {
                    // Cashflow section header
                    CellStyle cashflowSectionStyle = workbook.createCellStyle();
                    Font cfsFont = workbook.createFont();
                    cfsFont.setBold(true);
                    cfsFont.setFontHeightInPoints((short) 12);
                    cfsFont.setColor(IndexedColors.WHITE.getIndex());
                    cashflowSectionStyle.setFont(cfsFont);
                    cashflowSectionStyle.setFillForegroundColor(IndexedColors.DARK_GREEN.getIndex());
                    cashflowSectionStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
                    cashflowSectionStyle.setAlignment(HorizontalAlignment.CENTER);
                    cashflowSectionStyle.setVerticalAlignment(VerticalAlignment.CENTER);

                    // Cashflow header row
                    Row cfHeaderRow = sheet.createRow(cashflowStartRow);
                    cfHeaderRow.setHeightInPoints(22);
                    Cell cfTitleCell = cfHeaderRow.createCell(0);
                    cfTitleCell.setCellValue("COMPANY CASH FLOW — " + periodStr);
                    cfTitleCell.setCellStyle(cashflowSectionStyle);
                    // Merge across first 4 columns
                    sheet.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(cashflowStartRow, cashflowStartRow, 0, 4));

                    // Cashflow headers (row below the title)
                    String[] cfHeaders = {"Site", "Sub Total", "VAT @ 16%", "Total"};
                    Row cfHeaderRow2 = sheet.createRow(cashflowStartRow + 1);
                    cfHeaderRow2.setHeightInPoints(20);
                    for (int i = 0; i < cfHeaders.length; i++) {
                        Cell cell = cfHeaderRow2.createCell(i);
                        cell.setCellValue(cfHeaders[i]);
                        cell.setCellStyle(navyHeaderStyle);
                    }

                    int cfRowNum = cashflowStartRow + 2;
                    BigDecimal grandTotal = BigDecimal.ZERO;

                    for (CashflowSummaryResponse.SiteRevenue site : cashflow.getSites()) {
                        Row row = sheet.createRow(cfRowNum++);
                        row.setHeightInPoints(18);

                        Cell siteCell = row.createCell(0);
                        siteCell.setCellValue(site.getSite());
                        siteCell.setCellStyle(textStyle);

                        Cell subTotalCell = row.createCell(1);
                        subTotalCell.setCellValue(site.getSubTotal().doubleValue());
                        subTotalCell.setCellStyle(currencyStyle);

                        Cell vatCell = row.createCell(2);
                        vatCell.setCellValue(site.getVatAmount().doubleValue());
                        vatCell.setCellStyle(currencyStyle);

                        Cell totalCell = row.createCell(3);
                        totalCell.setCellValue(site.getTotal().doubleValue());
                        totalCell.setCellStyle(currencyStyle);

                        grandTotal = grandTotal.add(site.getTotal());
                    }

                    // Grand total row
                    Row cfTotalRow = sheet.createRow(cfRowNum);
                    cfTotalRow.setHeightInPoints(20);

                    Cell cfTotalLabel = cfTotalRow.createCell(0);
                    cfTotalLabel.setCellValue("Total Sub Monthly Accumulated");
                    cfTotalLabel.setCellStyle(totalRowLabelStyle);

                    cfTotalRow.createCell(1).setCellStyle(totalRowLabelStyle);
                    cfTotalRow.createCell(2).setCellStyle(totalRowLabelStyle);

                    Cell cfTotalValue = cfTotalRow.createCell(3);
                    cfTotalValue.setCellValue(grandTotal.doubleValue());
                    cfTotalValue.setCellStyle(totalRowValueStyle);

                    CellStyle boldLabelStyle = workbook.createCellStyle();
                    Font boldLabelFont = workbook.createFont();
                    boldLabelFont.setBold(true);
                    boldLabelFont.setFontHeightInPoints((short) 10);
                    boldLabelStyle.setFont(boldLabelFont);
                    boldLabelStyle.setBorderBottom(BorderStyle.THIN);
                    boldLabelStyle.setBorderTop(BorderStyle.THIN);
                    boldLabelStyle.setBorderLeft(BorderStyle.THIN);
                    boldLabelStyle.setBorderRight(BorderStyle.THIN);
                    boldLabelStyle.setAlignment(HorizontalAlignment.LEFT);
                    boldLabelStyle.setVerticalAlignment(VerticalAlignment.CENTER);

                    // Employee Gross Pay row
                    cfRowNum++;
                    Row grossPayRow = sheet.createRow(cfRowNum);
                    grossPayRow.setHeightInPoints(18);

                    Cell grossPayLabel = grossPayRow.createCell(0);
                    grossPayLabel.setCellValue("Employee Gross Pay:");
                    grossPayLabel.setCellStyle(boldLabelStyle);

                    grossPayRow.createCell(1).setCellStyle(boldLabelStyle);
                    grossPayRow.createCell(2).setCellStyle(boldLabelStyle);

                    Cell grossPayValue = grossPayRow.createCell(3);
                    grossPayValue.setCellValue(cashflow.getEmployeeGrossPay().doubleValue());
                    grossPayValue.setCellStyle(currencyStyle);

                    // Company Profit row
                    cfRowNum++;
                    Row profitRow = sheet.createRow(cfRowNum);
                    profitRow.setHeightInPoints(20);

                    Cell profitLabel = profitRow.createCell(0);
                    profitLabel.setCellValue("Company Profit:");
                    profitLabel.setCellStyle(totalRowLabelStyle);

                    profitRow.createCell(1).setCellStyle(totalRowLabelStyle);
                    profitRow.createCell(2).setCellStyle(totalRowLabelStyle);

                    Cell profitValue = profitRow.createCell(3);
                    profitValue.setCellValue(cashflow.getCompanyProfit().doubleValue());
                    CellStyle profitValueStyle = workbook.createCellStyle();
                    Font profitFont = workbook.createFont();
                    profitFont.setBold(true);
                    profitFont.setFontHeightInPoints((short) 11);
                    profitFont.setColor(IndexedColors.DARK_GREEN.getIndex());
                    profitValueStyle.setFont(profitFont);
                    profitValueStyle.setBorderTop(BorderStyle.DOUBLE);
                    profitValueStyle.setDataFormat(workbook.createDataFormat().getFormat("#,##0.00"));
                    profitValueStyle.setAlignment(HorizontalAlignment.RIGHT);
                    profitValueStyle.setVerticalAlignment(VerticalAlignment.CENTER);
                    profitValue.setCellStyle(profitValueStyle);
                }
            } catch (Exception e) {
                // Don't fail the export if cashflow data isn't available
                log.warn("Could not include cashflow section in payroll export: {}", e.getMessage());
            }

            // Auto-size columns for better readability
            for (int i = 0; i < 22; i++) {
                sheet.autoSizeColumn(i);
            }
            // Set minimum column widths
            sheet.setColumnWidth(0, Math.max(sheet.getColumnWidth(0), 1200));
            sheet.setColumnWidth(1, Math.max(sheet.getColumnWidth(1), 7000));

            // Remove the original PAYSLIP template sheet — we won't clone it since we have individual PDF payslips instead
            int payslipTemplateIdx = workbook.getSheetIndex("PAYSLIP");
            if (payslipTemplateIdx >= 0 && payslipTemplateIdx < workbook.getNumberOfSheets()) {
                workbook.removeSheetAt(payslipTemplateIdx);
            }

            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            workbook.write(bos);
            return bos.toByteArray();

        } catch (Exception e) {
            throw new RuntimeException("Failed to export payroll run to Excel", e);
        }
    }

    private CellStyle cloneStyle(Workbook workbook, CellStyle base) {
        CellStyle cloned = workbook.createCellStyle();
        cloned.cloneStyleFrom(base);
        return cloned;
    }

    private void setCellValue(Cell cell, BigDecimal value, CellStyle style) {
        if (value != null) {
            cell.setCellValue(value.doubleValue());
            if (style != null) {
                cell.setCellStyle(style);
            }
        } else {
            cell.setCellValue(0);
        }
    }

    private CellStyle getHeaderCellStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        Font font = workbook.createFont();
        font.setBold(true);
        style.setFont(font);
        style.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        return style;
    }

    private CellStyle getCurrencyCellStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        style.setDataFormat(workbook.createDataFormat().getFormat("#,##0.00"));
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        return style;
    }

    private CellStyle getIntegerCellStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        style.setDataFormat(workbook.createDataFormat().getFormat("#,##0"));
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        return style;
    }

    private CellStyle getLabelCellStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        Font font = workbook.createFont();
        font.setBold(true);
        font.setFontHeightInPoints((short) 10);
        style.setFont(font);
        return style;
    }

    private CellStyle getValueCellStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        Font font = workbook.createFont();
        font.setFontHeightInPoints((short) 10);
        style.setFont(font);
        return style;
    }

    private CellStyle getSectionHeaderStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        Font font = workbook.createFont();
        font.setBold(true);
        font.setFontHeightInPoints((short) 10);
        style.setFont(font);
        style.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        return style;
    }

    private CellStyle getTotalLabelStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        Font font = workbook.createFont();
        font.setBold(true);
        font.setFontHeightInPoints((short) 10);
        style.setFont(font);
        style.setBorderTop(BorderStyle.DOUBLE);
        return style;
    }

    private CellStyle getTotalValueStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        Font font = workbook.createFont();
        font.setBold(true);
        font.setFontHeightInPoints((short) 11);
        style.setFont(font);
        style.setBorderTop(BorderStyle.DOUBLE);
        style.setDataFormat(workbook.createDataFormat().getFormat("#,##0.00"));
        return style;
    }

    private CellStyle getTitleStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        Font font = workbook.createFont();
        font.setBold(true);
        font.setFontHeightInPoints((short) 14);
        style.setFont(font);
        return style;
    }

    // ====================== Delete ======================

    @Override
    @Transactional
    public void deletePayrollRun(UUID id, UUID userId) {
        PayrollRun payrollRun = payrollRunRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("PayrollRun", id));

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));

        if (user.getRole() != Role.ADMIN) {
            throw new BusinessRuleException("Only ADMIN users can delete payroll runs.");
        }

        // Delete associated payroll imports first
        List<PayrollImport> payrollImports = payrollImportRepository.findByPayrollRunIdOrderByCreatedAtDesc(id);
        payrollImportRepository.deleteAll(payrollImports);

        // Cascade delete in order: payslips → employee deductions → payroll entries → payroll run
        List<PayrollEntry> entries = payrollEntryRepository.findByPayrollRunId(id);
        for (PayrollEntry entry : entries) {
            // Delete payslips for this entry
            List<Payslip> payslips = payslipRepository.findByPayrollEntryId(entry.getId());
            payslipRepository.deleteAll(payslips);

            // Delete employee deductions for this entry
            List<EmployeeDeduction> deductions = employeeDeductionRepository.findByPayrollEntryId(entry.getId());
            employeeDeductionRepository.deleteAll(deductions);
        }

        // Delete all payroll entries
        payrollEntryRepository.deleteAll(entries);

        // Delete the payroll run itself
        payrollRunRepository.delete(payrollRun);

        auditService.logEvent(userId, "DELETE", "PayrollRun", payrollRun.getId().toString(),
                payrollRun.getStatus().name(), null,
                String.format("Payroll run for %d/%d deleted by admin", payrollRun.getMonth(), payrollRun.getYear()));
    }

    // ====================== Bank Payment Export ======================

    @Override
    public byte[] exportPayrollRunForBankPayment(UUID runId) {
        PayrollRun payrollRun = payrollRunRepository.findById(runId)
                .orElseThrow(() -> new ResourceNotFoundException("PayrollRun", runId));

        if (payrollRun.getStatus() != PayrollRunStatus.APPROVED) {
            throw new BusinessRuleException("Bank payment export is only available for APPROVED payroll runs.");
        }

        List<PayrollEntry> entries = payrollEntryRepository.findByPayrollRunId(runId);

        String reference = getMonthName(payrollRun.getMonth()) + " pay " + payrollRun.getYear();

        try (InputStream templateStream = new ClassPathResource("BANK_PAYMENT_TEMPLATE.xlsx").getInputStream();
             Workbook workbook = new XSSFWorkbook(templateStream);
             ByteArrayOutputStream bos = new ByteArrayOutputStream()) {

            Sheet sheet = workbook.getSheetAt(0);

            // Clear existing data rows (rows 2+, 0-indexed)
            for (int i = sheet.getLastRowNum(); i >= 1; i--) {
                Row row = sheet.getRow(i);
                if (row != null) {
                    sheet.removeRow(row);
                }
            }

            // Data rows starting from row 2 (0-indexed = 1)
            int rowNum = 1;
            for (PayrollEntry entry : entries) {
                Employee employee = entry.getEmployee();
                Row row = sheet.createRow(rowNum++);

                // A: Payee - full name
                Cell payeeCell = row.createCell(0);
                String fullName = employee.getFirstName() + " " + employee.getLastName();
                payeeCell.setCellValue(fullName.toUpperCase());

                // B: Account Number
                Cell accCell = row.createCell(1);
                accCell.setCellValue(employee.getAccountNumber() != null ? employee.getAccountNumber() : "");

                // C: Sort Code
                Cell sortCell = row.createCell(2);
                sortCell.setCellValue(employee.getSortCode() != null ? employee.getSortCode() : "");

                // D: Amount (Net Salary, rounded up to whole number)
                Cell amountCell = row.createCell(3);
                BigDecimal netSalary = entry.getNetSalary() != null ? entry.getNetSalary() : BigDecimal.ZERO;
                int roundedAmount = netSalary.setScale(0, RoundingMode.FLOOR).intValue();
                amountCell.setCellValue(roundedAmount);

                // E: Reference
                Cell refCell = row.createCell(4);
                refCell.setCellValue(reference);
            }

            workbook.write(bos);
            return bos.toByteArray();

        } catch (Exception e) {
            throw new RuntimeException("Failed to export bank payment file", e);
        }
    }

    private String getMonthName(int month) {
        String[] monthNames = {
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        };
        return monthNames[month - 1];
    }
}
