package com.payroll.service.impl;

import com.payroll.entity.*;
import com.payroll.exception.BusinessRuleException;
import com.payroll.exception.ResourceNotFoundException;
import com.payroll.repository.*;
import com.payroll.service.FileStorageService;
import com.payroll.service.PayrollCalculationService;
import com.payroll.service.PayrollImportService;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;

@Service
@RequiredArgsConstructor
public class PayrollImportServiceImpl implements PayrollImportService {

    private final PayrollImportRepository payrollImportRepository;
    private final PayrollRunRepository payrollRunRepository;
    private final UserRepository userRepository;
    private final EmployeeRepository employeeRepository;
    private final PayrollEntryRepository payrollEntryRepository;
    private final PayrollSettingsRepository payrollSettingsRepository;
    private final LoanRepository loanRepository;
    private final FileStorageService fileStorageService;
    private final PayrollCalculationService payrollCalculationService;

    @Override
    @Transactional
    public PayrollImport uploadFile(MultipartFile file, UUID payrollRunId, UUID userId) {
        PayrollRun payrollRun = payrollRunRepository.findById(payrollRunId)
                .orElseThrow(() -> new ResourceNotFoundException("PayrollRun", payrollRunId));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));

        String filePath = fileStorageService.storeFile(file, "imports");

        PayrollImport payrollImport = PayrollImport.builder()
                .payrollRun(payrollRun)
                .fileName(file.getOriginalFilename())
                .filePath(filePath)
                .totalRows(0)
                .successRows(0)
                .errorRows(0)
                .createdBy(user)
                .build();

        return payrollImportRepository.save(payrollImport);
    }

    @Override
    @Transactional
    public PayrollImport processImport(UUID importId, UUID userId) {
        PayrollImport payrollImport = payrollImportRepository.findById(importId)
                .orElseThrow(() -> new ResourceNotFoundException("PayrollImport", importId));

        if (payrollImport.getStatus() != ImportStatus.UPLOADED) {
            throw new BusinessRuleException("Import has already been processed");
        }

        PayrollRun payrollRun = payrollImport.getPayrollRun();
        if (payrollRun.getStatus() != PayrollRunStatus.DRAFT) {
            throw new BusinessRuleException("Can only import to DRAFT payroll runs");
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
                        .build());

        List<Employee> allEmployees = employeeRepository.findAll();
        Map<String, Employee> employeeByNrc = new HashMap<>();
        Map<String, Employee> employeeByName = new HashMap<>();
        Map<String, Employee> employeeByNumber = new HashMap<>();
        for (Employee emp : allEmployees) {
            employeeByNrc.put(emp.getNrc(), emp);
            employeeByName.put((emp.getFirstName() + " " + emp.getLastName()).toLowerCase(), emp);
            if (emp.getEmployeeNumber() != null) {
                employeeByNumber.put(emp.getEmployeeNumber(), emp);
            }
        }

        Resource fileResource = fileStorageService.loadFile(payrollImport.getFilePath());

        try (InputStream is = fileResource.getInputStream();
             Workbook workbook = new XSSFWorkbook(is)) {

            Sheet sheet = workbook.getSheet("PAYROLL");
            if (sheet == null) {
                sheet = workbook.getSheetAt(0);
            }

            int totalRows = 0;
            int successRows = 0;
            int errorRows = 0;

            for (int i = 3; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null) continue;

                String employeeNumber = getCellStringValue(row.getCell(1));  // EMPLOYEE NUMBER
                String names = getCellStringValue(row.getCell(2));            // NAMES
                String nrc = getCellStringValue(row.getCell(3));              // NRC

                if (names == null || names.isEmpty() || names.equalsIgnoreCase("TOTALS")) {
                    continue;
                }

                totalRows++;

                try {
                    Employee employee = null;
                    if (employeeNumber != null && !employeeNumber.isEmpty()) {
                        employee = employeeByNumber.get(employeeNumber);
                    }
                    if (employee == null && nrc != null && !nrc.isEmpty()) {
                        employee = employeeByNrc.get(nrc);
                    }
                    if (employee == null && names != null) {
                        employee = employeeByName.get(names.toLowerCase());
                    }
                    if (employee == null) {
                        errorRows++;
                        continue;
                    }

                    if (payrollEntryRepository.findByPayrollRunIdAndEmployeeId(payrollRun.getId(), employee.getId()).isPresent()) {
                        errorRows++;
                        continue;
                    }

                    // Update employee details from new template columns
                    String phone = getCellStringValue(row.getCell(6));      // PHONE NUMBER
                    String email = getCellStringValue(row.getCell(7));      // EMAIL
                    String accountNumber = getCellStringValue(row.getCell(8)); // ACCOUNT NUMBER
                    String sortCode = getCellStringValue(row.getCell(9));   // SORT CODE
                    String site = getCellStringValue(row.getCell(5));       // SITE

                    boolean employeeUpdated = false;
                    if (phone != null && !phone.isEmpty() && !phone.equals(employee.getPhone())) {
                        employee.setPhone(phone);
                        employeeUpdated = true;
                    }
                    if (email != null && !email.isEmpty() && !email.equals(employee.getEmail())) {
                        employee.setEmail(email);
                        employeeUpdated = true;
                    }
                    if (accountNumber != null && !accountNumber.isEmpty() && !accountNumber.equals(employee.getAccountNumber())) {
                        employee.setAccountNumber(accountNumber);
                        employeeUpdated = true;
                    }
                    if (sortCode != null && !sortCode.isEmpty() && !sortCode.equals(employee.getSortCode())) {
                        employee.setSortCode(sortCode);
                        employeeUpdated = true;
                    }
                    if (site != null && !site.isEmpty() && !site.equals(employee.getSite())) {
                        employee.setSite(site);
                        employeeUpdated = true;
                    }
                    if (employeeUpdated) {
                        employeeRepository.save(employee);
                    }

                    BigDecimal presentDays = getNumericCellValue(row.getCell(14));  // PRESENT DAYS (col O)
                    BigDecimal overtimeHrs = getNumericCellValue(row.getCell(16));  // OVERT TIME (col Q)
                    BigDecimal holidayHrs = getNumericCellValue(row.getCell(18));   // HOLIDAY OVER TIME (col S)
                    BigDecimal otherDeduction = getNumericCellValue(row.getCell(25));// OTHER DEDUCTION (col Z)

                    // Get active loans for this employee
                    List<Loan> activeLoans = loanRepository.findByEmployeeIdAndStatus(employee.getId(), LoanStatus.ACTIVE);

                    PayrollEntry entry = payrollCalculationService.calculatePayrollEntry(
                            employee, settings,
                            overtimeHrs, holidayHrs,
                            activeLoans, otherDeduction,
                            presentDays);
                    entry.setPayrollRun(payrollRun);
                    entry.setEmployee(employee);

                    payrollEntryRepository.save(entry);
                    successRows++;

                } catch (Exception e) {
                    errorRows++;
                }
            }

            payrollImport.setTotalRows(totalRows);
            payrollImport.setSuccessRows(successRows);
            payrollImport.setErrorRows(errorRows);
            payrollImport.setStatus(ImportStatus.IMPORTED);

        } catch (Exception e) {
            // Transaction rolls back on RuntimeException, import stays as UPLOADED
            throw new RuntimeException("Failed to process import file", e);
        }

        return payrollImportRepository.save(payrollImport);
    }

    @Override
    public List<PayrollImport> getImportsByPayrollRun(UUID payrollRunId) {
        return payrollImportRepository.findByPayrollRunIdOrderByCreatedAtDesc(payrollRunId);
    }

    @Override
    public PayrollImport getImportById(UUID id) {
        return payrollImportRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("PayrollImport", id));
    }

    @Override
    public Resource downloadTemplate() {
        try (Workbook workbook = new XSSFWorkbook()) {
            Sheet sheet = workbook.createSheet("PAYROLL");

            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerFont.setFontHeightInPoints((short) 11);
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            headerStyle.setBorderBottom(BorderStyle.THIN);
            headerStyle.setBorderTop(BorderStyle.THIN);
            headerStyle.setBorderLeft(BorderStyle.THIN);
            headerStyle.setBorderRight(BorderStyle.THIN);

            String[] headers = {
                    "S/N", "EMPLOYEE NUMBER", "NAMES", "NRC", "JOB TITTLE", "SITE",
                    "PHONE NUMBER", "EMAIL", "ACCOUNT NUMBER", "SORT CODE", "RATE/HRS",
                    "NORMAL WORKING HRS", "OVER TIME RATE", "HOLIDAY OVERTIME RATE",
                    "PRESENT DAYS", "PRESENT AMOUNT", "OVERT TIME", "OVER TIME AMOUNT",
                    "HOLIDAY OVER TIME", "HOLIDAY OVER TIME AMOUNT", "GROSS SALARY",
                    "NHIMA", "NAPSA", "SOFT LOAN", "SOFT LOAN DEDUCTION",
                    "OTHER DEDUCTION", "NET PAY"
            };

            Row headerRow = sheet.createRow(2);  // Index 2 (Excel Row 3) — header row matching template format
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }

            // Example data row with input values and formulas
            int dataRowIdx = 4;  // Excel row 4 (0-indexed row 3) = first example data row
            Row exampleRow = sheet.createRow(3);

            // Input values the user should fill in
            exampleRow.createCell(0).setCellValue(1);               // A: S/N
            exampleRow.createCell(1).setCellValue("EMP001");        // B: EMPLOYEE NUMBER
            exampleRow.createCell(2).setCellValue("JOHN DOE");     // C: NAMES
            exampleRow.createCell(3).setCellValue("123456/78/1");  // D: NRC
            exampleRow.createCell(4).setCellValue("FITTER");       // E: JOB TITTLE
            exampleRow.createCell(5).setCellValue("KITWE");        // F: SITE
            exampleRow.createCell(6).setCellValue("0977000000");   // G: PHONE NUMBER
            exampleRow.createCell(7).setCellValue("john@example.com"); // H: EMAIL
            exampleRow.createCell(8).setCellValue("1234567890");   // I: ACCOUNT NUMBER
            exampleRow.createCell(9).setCellValue("010101");       // J: SORT CODE
            exampleRow.createCell(10).setCellValue(35.0);           // K: RATE/HRS
            exampleRow.createCell(11).setCellValue(8.0);            // L: NORMAL WORKING HRS

            // Formulas — OVER TIME RATE = RATE/HRS * 1.5
            exampleRow.createCell(12).setCellFormula("K" + dataRowIdx + "*1.5");

            // Formulas — HOLIDAY OVERTIME RATE = RATE/HRS * 2
            exampleRow.createCell(13).setCellFormula("K" + dataRowIdx + "*2");

            exampleRow.createCell(14).setCellValue(26.0);           // O: PRESENT DAYS

            // Formulas — PRESENT AMOUNT = RATE/HRS * NORMAL WORKING HRS * PRESENT DAYS
            exampleRow.createCell(15).setCellFormula("K" + dataRowIdx + "*L" + dataRowIdx + "*O" + dataRowIdx);

            exampleRow.createCell(16).setCellValue(10.0);           // Q: OVERT TIME

            // Formulas — OVER TIME AMOUNT = OVERT TIME * OVER TIME RATE
            exampleRow.createCell(17).setCellFormula("Q" + dataRowIdx + "*M" + dataRowIdx);

            exampleRow.createCell(18).setCellValue(5.0);            // S: HOLIDAY OVER TIME

            // Formulas — HOLIDAY OVER TIME AMOUNT = HOLIDAY OVER TIME * HOLIDAY OVERTIME RATE
            exampleRow.createCell(19).setCellFormula("S" + dataRowIdx + "*N" + dataRowIdx);

            // Formulas — GROSS SALARY = PRESENT AMOUNT + OVER TIME AMOUNT + HOLIDAY OVER TIME AMOUNT
            exampleRow.createCell(20).setCellFormula("P" + dataRowIdx + "+R" + dataRowIdx + "+T" + dataRowIdx);

            // Formulas — NHIMA = GROSS SALARY * 1%
            exampleRow.createCell(21).setCellFormula("U" + dataRowIdx + "*1%");

            // Formulas — NAPSA = GROSS SALARY * 5%
            exampleRow.createCell(22).setCellFormula("U" + dataRowIdx + "*5%");

            exampleRow.createCell(23).setCellValue(1000.0);         // X: SOFT LOAN

            // Formulas — SOFT LOAN DEDUCTION = SOFT LOAN * 0.3 + SOFT LOAN
            exampleRow.createCell(24).setCellFormula("X" + dataRowIdx + "*0.3+X" + dataRowIdx);

            exampleRow.createCell(25).setCellValue(0.0);            // Z: OTHER DEDUCTION

            // Formulas — NET PAY = GROSS SALARY - NHIMA - NAPSA - SOFT LOAN DEDUCTION - OTHER DEDUCTION
            exampleRow.createCell(26).setCellFormula("U" + dataRowIdx + "-V" + dataRowIdx + "-W" + dataRowIdx + "-Y" + dataRowIdx + "-Z" + dataRowIdx);

            // Add a totals row (sums only the data rows, not itself)
            Row totalRow = sheet.createRow(4);  // Excel row 5 (0-indexed row 4)
            Cell totalLabel = totalRow.createCell(0);
            totalLabel.setCellValue("TOTALS");
            CellStyle totalStyle = workbook.createCellStyle();
            Font totalFont = workbook.createFont();
            totalFont.setBold(true);
            totalStyle.setFont(totalFont);
            totalLabel.setCellStyle(totalStyle);

            // Sum formula for NET PAY totals column (only data rows, excludes totals row)
            Cell totalNetPay = totalRow.createCell(26);
            totalNetPay.setCellFormula("SUM(AA4:AA4)");
            totalNetPay.setCellStyle(totalStyle);

            // Auto-size columns
            for (int i = 0; i < headers.length; i++) {
                sheet.autoSizeColumn(i);
            }

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            workbook.write(baos);
            return new ByteArrayResource(baos.toByteArray());
        } catch (Exception e) {
            throw new RuntimeException("Failed to generate payroll import template", e);
        }
    }

    private String getCellStringValue(Cell cell) {
        if (cell == null) return null;
        return switch (cell.getCellType()) {
            case STRING -> cell.getStringCellValue().trim();
            case NUMERIC -> String.valueOf((long) cell.getNumericCellValue());
            default -> null;
        };
    }

    private BigDecimal getNumericCellValue(Cell cell) {
        if (cell == null) return BigDecimal.ZERO;
        return switch (cell.getCellType()) {
            case NUMERIC -> BigDecimal.valueOf(cell.getNumericCellValue()).setScale(2, RoundingMode.HALF_UP);
            case STRING -> {
                try {
                    yield new BigDecimal(cell.getStringCellValue().trim());
                } catch (NumberFormatException e) {
                    yield BigDecimal.ZERO;
                }
            }
            default -> BigDecimal.ZERO;
        };
    }
}
