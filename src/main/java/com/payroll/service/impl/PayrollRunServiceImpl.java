package com.payroll.service.impl;

import com.payroll.dto.PagedResponse;
import com.payroll.entity.*;
import com.payroll.exception.BadRequestException;
import com.payroll.exception.BusinessRuleException;
import com.payroll.exception.ResourceNotFoundException;
import com.payroll.repository.*;
import com.payroll.service.PayrollCalculationService;
import com.payroll.service.PayrollRunService;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class PayrollRunServiceImpl implements PayrollRunService {

    private final PayrollRunRepository payrollRunRepository;
    private final UserRepository userRepository;
    private final EmployeeRepository employeeRepository;
    private final PayrollEntryRepository payrollEntryRepository;
    private final PayrollSettingsRepository payrollSettingsRepository;
    private final LoanRepository loanRepository;
    private final PayrollCalculationService payrollCalculationService;

    @Override
    public PagedResponse<PayrollRun> getAllPayrollRuns(Integer month, Integer year, PayrollRunStatus status, Pageable pageable) {
        var page = payrollRunRepository.searchPayrollRuns(month, year, status, pageable);
        return PagedResponse.from(page);
    }

    @Override
    public PayrollRun getPayrollRunById(UUID id) {
        return payrollRunRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("PayrollRun", id));
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

        return payrollRunRepository.save(payrollRun);
    }

    @Override
    @Transactional
    public PayrollRun submitPayrollRun(UUID id, UUID userId) {
        PayrollRun payrollRun = payrollRunRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("PayrollRun", id));

        if (payrollRun.getStatus() != PayrollRunStatus.DRAFT) {
            throw new BusinessRuleException("Only DRAFT payroll runs can be submitted");
        }

        payrollRun.setStatus(PayrollRunStatus.SUBMITTED);
        return payrollRunRepository.save(payrollRun);
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

        payrollRun.setStatus(PayrollRunStatus.APPROVED);
        payrollRun.setApprovedBy(approver);
        payrollRun.setApprovedAt(LocalDateTime.now());
        return payrollRunRepository.save(payrollRun);
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
        return payrollRunRepository.save(payrollRun);
    }

    @Override
    @Transactional
    public PayrollRun reopenPayrollRun(UUID id, UUID userId) {
        PayrollRun payrollRun = payrollRunRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("PayrollRun", id));

        if (payrollRun.getStatus() != PayrollRunStatus.REJECTED) {
            throw new BusinessRuleException("Only REJECTED payroll runs can be reopened");
        }

        payrollRun.setStatus(PayrollRunStatus.DRAFT);
        payrollRun.setRejectedBy(null);
        payrollRun.setRejectedAt(null);
        payrollRun.setRejectionReason(null);
        return payrollRunRepository.save(payrollRun);
    }

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

            createdEntries.add(payrollEntryRepository.save(entry));
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

        payrollEntryRepository.delete(entry);
    }

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

    @Override
    public byte[] exportPayrollRunToExcel(UUID runId) {
        PayrollRun payrollRun = payrollRunRepository.findById(runId)
                .orElseThrow(() -> new ResourceNotFoundException("PayrollRun", runId));

        List<PayrollEntry> entries = payrollEntryRepository.findByPayrollRunId(runId);

        try (InputStream templateStream = new ClassPathResource("PAYROLL TEMPLATE.xlsx").getInputStream();
             Workbook workbook = new XSSFWorkbook(templateStream)) {

            PayrollSettings settings = payrollSettingsRepository
                    .findTopByEffectiveDateLessThanEqualOrderByEffectiveDateDesc(LocalDate.now())
                    .orElse(null);

            // ============================================================
            // SHEET 1: PAYROLL SUMMARY
            // ============================================================
            Sheet sheet = workbook.getSheet("PAYROLL");
            if (sheet == null) {
                sheet = workbook.createSheet("PAYROLL");
            }

            // Remove the default template sheets (keep only the first one if "Sheet0"/default exists)
            // Clear existing data rows (from row 4 onwards)
            for (int i = sheet.getLastRowNum(); i >= 3; i--) {
                Row row = sheet.getRow(i);
                if (row != null) {
                    sheet.removeRow(row);
                }
            }

            // Create header row (row 3, 0-indexed)
            Row headerRow = sheet.getRow(3);
            if (headerRow == null) {
                headerRow = sheet.createRow(3);
            }
            String[] headers = {"S/N", "NAMES", "NRC", "JOB TITTLE", "SITE", "RATE/HRS",
                    "NORMAL WORKING HRS", "OVER TIME RATE", "HOLIDAY OVERTIME RATE",
                    "PRESENT DAYS", "PRESENT AMOUNT", "OVERT TIME", "OVER TIME AMOUNT",
                    "HOLIDAY OVER TIME", "HOLIDAY OVER TIME AMOUNT", "GROSS SALARY",
                    "NHIMA", "NAPSA", "SOFT LOAN", "SOFT LOAN DEDUCTION",
                    "OTHER DEDUCTION", "NET PAY"};
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(getHeaderCellStyle(workbook));
            }

            int normalWorkingHrs = settings != null ? settings.getHoursPerDay() : 8;

            // Data rows starting from row 4
            int rowNum = 4;
            CellStyle currencyStyle = getCurrencyCellStyle(workbook);
            CellStyle intStyle = getIntegerCellStyle(workbook);
            for (int i = 0; i < entries.size(); i++) {
                PayrollEntry entry = entries.get(i);
                Row row = sheet.createRow(rowNum++);

                row.createCell(0).setCellValue(i + 1); // S/N
                row.createCell(1).setCellValue(entry.getEmployee().getFirstName() + " " + entry.getEmployee().getLastName()); // NAMES
                row.createCell(2).setCellValue(entry.getEmployee().getNrc()); // NRC
                row.createCell(3).setCellValue(entry.getEmployee().getPosition() != null ? entry.getEmployee().getPosition() : ""); // JOB TITTLE
                row.createCell(4).setCellValue(entry.getSite() != null ? entry.getSite() : ""); // SITE
                row.createCell(5).setCellValue(entry.getHourlyRate() != null ? entry.getHourlyRate().doubleValue() : 0); // RATE/HRS
                row.createCell(6).setCellValue(normalWorkingHrs); // NORMAL WORKING HRS

                // OVER TIME RATE = hourlyRate * overtimeRate
                BigDecimal overtimeRateSetting = settings != null ? settings.getOvertimeRate() : new BigDecimal("1.5");
                BigDecimal overTimeRateHrly = entry.getHourlyRate() != null
                        ? entry.getHourlyRate().multiply(overtimeRateSetting)
                        : BigDecimal.ZERO;
                row.createCell(7).setCellValue(overTimeRateHrly.doubleValue());

                // HOLIDAY OVERTIME RATE = hourlyRate * holidayRate
                BigDecimal holidayRateSetting = settings != null ? settings.getHolidayRate() : new BigDecimal("2.0");
                BigDecimal holidayRateHrly = entry.getHourlyRate() != null
                        ? entry.getHourlyRate().multiply(holidayRateSetting)
                        : BigDecimal.ZERO;
                row.createCell(8).setCellValue(holidayRateHrly.doubleValue());

                setCellValue(row.createCell(9), entry.getPresentDays(), intStyle); // PRESENT DAYS
                setCellValue(row.createCell(10), entry.getRegularAmount(), currencyStyle); // PRESENT AMOUNT
                setCellValue(row.createCell(11), entry.getOvertimeHours(), intStyle); // OVERT TIME
                setCellValue(row.createCell(12), entry.getOvertimeAmount(), currencyStyle); // OVER TIME AMOUNT
                setCellValue(row.createCell(13), entry.getHolidayHours(), intStyle); // HOLIDAY OVER TIME
                setCellValue(row.createCell(14), entry.getHolidayAmount(), currencyStyle); // HOLIDAY OVER TIME AMOUNT
                setCellValue(row.createCell(15), entry.getGrossSalary(), currencyStyle); // GROSS SALARY
                setCellValue(row.createCell(16), entry.getNhima(), currencyStyle); // NHIMA
                setCellValue(row.createCell(17), entry.getNapsa(), currencyStyle); // NAPSA
                setCellValue(row.createCell(18), entry.getLoanBalance(), currencyStyle); // SOFT LOAN
                setCellValue(row.createCell(19), entry.getLoanDeduction(), currencyStyle); // SOFT LOAN DEDUCTION
                setCellValue(row.createCell(20), entry.getOtherDeductions(), currencyStyle); // OTHER DEDUCTION
                setCellValue(row.createCell(21), entry.getNetSalary(), currencyStyle); // NET PAY
            }

            // Summary row
            if (!entries.isEmpty()) {
                Row summaryRow = sheet.createRow(rowNum + 1);
                summaryRow.createCell(0).setCellValue("TOTALS");
            }

            // ============================================================
            // SHEETS 2+: Individual PAYSLIP for each employee
            // Clone the formatted PAYSLIP template sheet for each employee
            // ============================================================
            String[] monthNames = {
                "January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"
            };
            String periodStr = monthNames[payrollRun.getMonth() - 1] + " " + payrollRun.getYear();

            int payslipTemplateIdx = workbook.getSheetIndex("PAYSLIP");

            for (int i = 0; i < entries.size(); i++) {
                PayrollEntry entry = entries.get(i);
                var employee = entry.getEmployee();

                // Clone the formatted PAYSLIP template sheet
                Sheet payslipSheet = workbook.cloneSheet(payslipTemplateIdx);
                int newIdx = workbook.getSheetIndex(payslipSheet);
                workbook.setSheetName(newIdx, "PAYSLIP " + (i + 1));

                // Helper to get or create a cell
                java.util.function.BiFunction<Integer, Integer, Cell> getCell = (rowIdx, colIdx) -> {
                    Row row = payslipSheet.getRow(rowIdx);
                    if (row == null) row = payslipSheet.createRow(rowIdx);
                    Cell cell = row.getCell(colIdx);
                    if (cell == null) cell = row.createCell(colIdx);
                    return cell;
                };

                // Row 1 (0-indexed): Period & Page
                getCell.apply(1, 3).setCellValue("PAY STATEMENT FOR: " + periodStr);
                getCell.apply(1, 7).setCellValue("Page                      " + (i + 1));

                // Row 3: Employee header line — update EMP NO cell
                getCell.apply(3, 0).setCellValue("EMP NO   " + employee.getEmployeeNumber());
                // GRADE value
                getCell.apply(3, 4).setCellValue(employee.getPosition() != null ? employee.getPosition() : "");
                // MINE SITE value
                getCell.apply(3, 5).setCellValue(employee.getSite() != null ? employee.getSite() : "");
                // NORMAL WORKING HRS value
                getCell.apply(3, 7).setCellValue(normalWorkingHrs);

                // Row 4: NAME
                getCell.apply(4, 0).setCellValue("NAME:      " + employee.getFirstName() + " " + employee.getLastName());

                // Row 5: NRC
                getCell.apply(5, 0).setCellValue("N.R.C:        " + employee.getNrc());

                // Row 6: Date Engaged
                String dateHiredStr = employee.getDateHired() != null
                        ? java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy").format(employee.getDateHired())
                        : "-";
                getCell.apply(6, 0).setCellValue("DATE Engaged: " + dateHiredStr);

                // Row 10: BASIC PAY
                getCell.apply(10, 2).setCellValue(entry.getPresentDays() != null ? entry.getPresentDays().doubleValue() : 0);
                getCell.apply(10, 3).setCellValue(entry.getRegularAmount() != null ? entry.getRegularAmount().doubleValue() : 0);
                getCell.apply(10, 7).setCellValue(entry.getNapsa() != null ? entry.getNapsa().doubleValue() : 0);

                BigDecimal loanDed = entry.getLoanDeduction() != null ? entry.getLoanDeduction() : BigDecimal.ZERO;

                // Row 11: OVERTIME
                getCell.apply(11, 2).setCellValue(entry.getOvertimeHours() != null ? entry.getOvertimeHours().doubleValue() : 0);
                getCell.apply(11, 3).setCellValue(entry.getOvertimeAmount() != null ? entry.getOvertimeAmount().doubleValue() : 0);
                getCell.apply(11, 7).setCellValue(loanDed.doubleValue());

                // Row 12: SHIFT DIFFERENTIAL / NHIMA
                getCell.apply(12, 2).setCellValue(0);
                getCell.apply(12, 3).setCellValue(0);
                getCell.apply(12, 7).setCellValue(entry.getNhima() != null ? entry.getNhima().doubleValue() : 0);

                // Row 13: SUNDAY/HOLIDAY OT / OTHER
                getCell.apply(13, 2).setCellValue(entry.getHolidayHours() != null ? entry.getHolidayHours().doubleValue() : 0);
                getCell.apply(13, 3).setCellValue(entry.getHolidayAmount() != null ? entry.getHolidayAmount().doubleValue() : 0);
                BigDecimal otherDed = entry.getOtherDeductions() != null ? entry.getOtherDeductions() : BigDecimal.ZERO;
                getCell.apply(13, 7).setCellValue(otherDed.doubleValue());

                // Row 15: Total Earnings & Total Deductions
                getCell.apply(15, 3).setCellValue(entry.getGrossSalary() != null ? entry.getGrossSalary().doubleValue() : 0);
                BigDecimal totalDeductions = entry.getNapsa()
                        .add(entry.getNhima())
                        .add(loanDed)
                        .add(otherDed);
                getCell.apply(15, 7).setCellValue(totalDeductions.doubleValue());

                // Row 16: Net Pay
                getCell.apply(16, 3).setCellValue(entry.getGrossSalary() != null ? entry.getGrossSalary().doubleValue() : 0);
                getCell.apply(16, 7).setCellValue(entry.getNetSalary() != null ? entry.getNetSalary().doubleValue() : 0);
            }

            // Remove the original PAYSLIP template sheet (after all cloning is done)
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
}
