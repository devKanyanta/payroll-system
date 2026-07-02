package com.payroll.service.impl;

import com.payroll.entity.*;
import com.payroll.exception.BusinessRuleException;
import com.payroll.exception.ResourceNotFoundException;
import com.payroll.repository.*;
import com.payroll.service.AuditService;
import com.payroll.service.FileStorageService;
import com.payroll.service.PayrollImportService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
@Slf4j
public class PayrollImportServiceImpl implements PayrollImportService {

    private final PayrollImportRepository payrollImportRepository;
    private final PayrollRunRepository payrollRunRepository;
    private final UserRepository userRepository;
    private final EmployeeRepository employeeRepository;
    private final PayrollEntryRepository payrollEntryRepository;
    private final PayrollSettingsRepository payrollSettingsRepository;
    private final LoanRepository loanRepository;
    private final FileStorageService fileStorageService;
    private final AuditService auditService;
    private final CashflowRevenueRepository cashflowRevenueRepository;

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

            // ── Step 1: Validate ALL rows first and collect detailed errors ──
            List<String> validationErrors = new ArrayList<>();
            List<RowData> validRows = new ArrayList<>();
            int totalRows = 0;

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
                int excelRowNum = i + 1; // Convert to 1-based for display

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
                    StringBuilder identifier = new StringBuilder();
                    if (employeeNumber != null && !employeeNumber.isEmpty()) {
                        identifier.append("Employee #").append(employeeNumber);
                    }
                    if (nrc != null && !nrc.isEmpty()) {
                        if (!identifier.isEmpty()) identifier.append(", ");
                        identifier.append("NRC: ").append(nrc);
                    }
                    if (names != null && !names.isEmpty()) {
                        if (!identifier.isEmpty()) identifier.append(", ");
                        identifier.append("Name: ").append(names);
                    }
                    validationErrors.add(String.format(
                            "Row %d: Employee not found in the system (%s)",
                            excelRowNum, identifier));
                    continue;
                }

                if (payrollEntryRepository.findByPayrollRunIdAndEmployeeId(payrollRun.getId(), employee.getId()).isPresent()) {
                    validationErrors.add(String.format(
                            "Row %d: Employee '%s %s' (#%s) already has an entry in this payroll run",
                            excelRowNum, employee.getFirstName(), employee.getLastName(), employee.getEmployeeNumber()));
                    continue;
                }

                validRows.add(new RowData(row, employee));
            }

            // ── Step 2: If validation errors exist, reject entirely ──
            if (!validationErrors.isEmpty()) {
                payrollImport.setTotalRows(totalRows);
                payrollImport.setSuccessRows(0);
                payrollImport.setErrorRows(validationErrors.size());
                payrollImport.setErrorDetails(String.join("\n", validationErrors));
                payrollImport.setStatus(ImportStatus.FAILED);
                return payrollImportRepository.save(payrollImport);
            }

            // ── Step 3: No errors — proceed with import ──
            int successRows = 0;

            for (RowData rowData : validRows) {
                Row row = rowData.row;
                Employee employee = rowData.employee;

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

                // ── Read ALL imported values from the Excel file ──
                BigDecimal presentDays = getNumericCellValue(row.getCell(14));    // PRESENT DAYS (col O)
                BigDecimal presentAmount = getNumericCellValue(row.getCell(15));  // PRESENT AMOUNT (col P)
                BigDecimal overtimeHrs = getNumericCellValue(row.getCell(16));    // OVERT TIME (col Q)
                BigDecimal overtimeAmt = getNumericCellValue(row.getCell(17));   // OVER TIME AMOUNT (col R)
                BigDecimal holidayHrs = getNumericCellValue(row.getCell(18));     // HOLIDAY OVER TIME (col S)
                BigDecimal holidayAmt = getNumericCellValue(row.getCell(19));    // HOLIDAY OVER TIME AMOUNT (col T)
                BigDecimal grossSalary = getNumericCellValue(row.getCell(20));   // GROSS SALARY (col U)
                BigDecimal nhima = getNumericCellValue(row.getCell(21));          // NHIMA (col V)
                BigDecimal napsa = getNumericCellValue(row.getCell(22));          // NAPSA (col W)
                BigDecimal importedLoanBalance = getNumericCellValue(row.getCell(23)); // SOFT LOAN (col X)
                BigDecimal loanDeduction = getNumericCellValue(row.getCell(24));  // SOFT LOAN DEDUCTION (col Y)
                BigDecimal otherDeduction = getNumericCellValue(row.getCell(25)); // OTHER DEDUCTION (col Z)
                BigDecimal netSalary = getNumericCellValue(row.getCell(26));      // NET PAY (col AA)

                // Calculate derived fields for record-keeping
                BigDecimal hourlyRate = employee.getRate() != null ? employee.getRate() : BigDecimal.ZERO;
                BigDecimal normalHrsPerDay = BigDecimal.valueOf(settings.getHoursPerDay());
                BigDecimal regularHours = normalHrsPerDay.multiply(presentDays);
                BigDecimal monthlyEquivalent = hourlyRate.multiply(
                        BigDecimal.valueOf(settings.getHoursPerDay() * settings.getWorkingDaysPerMonth()));

                // Build PayrollEntry directly from imported values
                PayrollEntry entry = PayrollEntry.builder()
                        .basicSalary(monthlyEquivalent)
                        .hourlyRate(hourlyRate)
                        .presentDays(presentDays)
                        .loanBalance(importedLoanBalance)
                        .site(employee.getSite())
                        .regularHours(regularHours)
                        .regularAmount(presentAmount)
                        .overtimeHours(overtimeHrs)
                        .overtimeAmount(overtimeAmt)
                        .holidayHours(holidayHrs)
                        .holidayAmount(holidayAmt)
                        .grossSalary(grossSalary)
                        .nhima(nhima)
                        .napsa(napsa)
                        .paye(BigDecimal.ZERO)
                        .loanDeduction(loanDeduction)
                        .otherDeductions(otherDeduction)
                        .netSalary(netSalary)
                        .build();
                entry.setPayrollRun(payrollRun);
                entry.setEmployee(employee);

                payrollEntryRepository.save(entry);

                // ── Update loan balances from imported deductions ──
                if (loanDeduction.compareTo(BigDecimal.ZERO) > 0) {
                    List<Loan> activeLoans = loanRepository.findByEmployeeIdAndStatus(
                            employee.getId(), LoanStatus.ACTIVE);

                    if (!activeLoans.isEmpty()) {
                        // Deduct from existing active loans
                        BigDecimal remainingDeduction = loanDeduction;
                        for (Loan loan : activeLoans) {
                            if (remainingDeduction.compareTo(BigDecimal.ZERO) <= 0) break;

                            BigDecimal actualDeduction = remainingDeduction.min(loan.getBalance());
                            BigDecimal newBalance = loan.getBalance().subtract(actualDeduction)
                                    .max(BigDecimal.ZERO);

                            loan.setBalance(newBalance);
                            if (newBalance.compareTo(BigDecimal.ZERO) <= 0) {
                                loan.setStatus(LoanStatus.COMPLETED);
                            }

                            loanRepository.save(loan);
                            remainingDeduction = remainingDeduction.subtract(actualDeduction);
                        }

                        auditService.logEvent(userId, "LOAN_DEDUCTION", "Loan",
                                employee.getId().toString(),
                                null,
                                String.format("Imported payroll deducted ZMW %.2f from employee %s %s's loans",
                                        loanDeduction, employee.getFirstName(), employee.getLastName()),
                                null);
                    } else {
                        // No active loan exists — create a historical record marked as paid.
                        BigDecimal loanBalance = (importedLoanBalance != null
                                && importedLoanBalance.compareTo(BigDecimal.ZERO) > 0)
                                ? importedLoanBalance : loanDeduction;

                        Loan newLoan = Loan.builder()
                                .employee(employee)
                                .loanAmount(loanBalance)
                                .balance(BigDecimal.ZERO)
                                .interestRate(BigDecimal.ZERO)
                                .monthlyDeduction(loanDeduction)
                                .durationMonths(1)
                                .startDate(LocalDate.now())
                                .endDate(LocalDate.now())
                                .status(LoanStatus.COMPLETED)
                                .build();
                        loanRepository.save(newLoan);

                        auditService.logEvent(userId, "LOAN_CREATED", "Loan",
                                employee.getId().toString(),
                                null,
                                String.format("Loan created from payroll import: ZMW %.2f for employee %s %s",
                                        loanBalance, employee.getFirstName(), employee.getLastName()),
                                null);
                    }
                }

                successRows++;
            }

            // ── Step 4: Parse and save Company Cash Flow section ──
            try {
                parseAndSaveCashflowSection(sheet, payrollRun);
            } catch (Exception e) {
                log.warn("Could not parse cashflow section from import: {}", e.getMessage());
            }

            payrollImport.setTotalRows(totalRows);
            payrollImport.setSuccessRows(successRows);
            payrollImport.setErrorRows(0);
            payrollImport.setErrorDetails(null);
            payrollImport.setStatus(ImportStatus.IMPORTED);

        } catch (Exception e) {
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

            Row headerRow = sheet.createRow(2);
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }

            int dataRowIdx = 4;
            Row exampleRow = sheet.createRow(3);

            exampleRow.createCell(0).setCellValue(1);
            exampleRow.createCell(1).setCellValue("EMP001");
            exampleRow.createCell(2).setCellValue("JOHN DOE");
            exampleRow.createCell(3).setCellValue("123456/78/1");
            exampleRow.createCell(4).setCellValue("FITTER");
            exampleRow.createCell(5).setCellValue("KITWE");
            exampleRow.createCell(6).setCellValue("0977000000");
            exampleRow.createCell(7).setCellValue("john@example.com");
            exampleRow.createCell(8).setCellValue("1234567890");
            exampleRow.createCell(9).setCellValue("010101");
            exampleRow.createCell(10).setCellValue(35.0);
            exampleRow.createCell(11).setCellValue(8.0);
            exampleRow.createCell(12).setCellFormula("K" + dataRowIdx + "*1.5");
            exampleRow.createCell(13).setCellFormula("K" + dataRowIdx + "*2");
            exampleRow.createCell(14).setCellValue(26.0);
            exampleRow.createCell(15).setCellFormula("K" + dataRowIdx + "*L" + dataRowIdx + "*O" + dataRowIdx);
            exampleRow.createCell(16).setCellValue(10.0);
            exampleRow.createCell(17).setCellFormula("Q" + dataRowIdx + "*M" + dataRowIdx);
            exampleRow.createCell(18).setCellValue(5.0);
            exampleRow.createCell(19).setCellFormula("S" + dataRowIdx + "*N" + dataRowIdx);
            exampleRow.createCell(20).setCellFormula("P" + dataRowIdx + "+R" + dataRowIdx + "+T" + dataRowIdx);
            exampleRow.createCell(21).setCellFormula("U" + dataRowIdx + "*1%");
            exampleRow.createCell(22).setCellFormula("U" + dataRowIdx + "*5%");
            exampleRow.createCell(23).setCellValue(1000.0);
            exampleRow.createCell(24).setCellFormula("X" + dataRowIdx + "*0.3+X" + dataRowIdx);
            exampleRow.createCell(25).setCellValue(0.0);
            exampleRow.createCell(26).setCellFormula("U" + dataRowIdx + "-V" + dataRowIdx + "-W" + dataRowIdx + "-Y" + dataRowIdx + "-Z" + dataRowIdx);

            Row totalRow = sheet.createRow(4);
            Cell totalLabel = totalRow.createCell(0);
            totalLabel.setCellValue("TOTALS");
            CellStyle totalStyle = workbook.createCellStyle();
            Font totalFont = workbook.createFont();
            totalFont.setBold(true);
            totalStyle.setFont(totalFont);
            totalLabel.setCellStyle(totalStyle);

            Cell totalNetPay = totalRow.createCell(26);
            totalNetPay.setCellFormula("SUM(AA4:AA4)");
            totalNetPay.setCellStyle(totalStyle);

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

    /**
     * Holds a parsed row and its matched employee during validation.
     */
    private record RowData(Row row, Employee employee) {}

    /**
     * Parses the Company Cash Flow section from the payroll Excel and saves it
     * to the cashflow_revenues table for the given payroll run's month/year.
     * <p>
     * Expected Excel layout (starting after employee data rows):
     *   Row N:   "Company Cash Flow"           (header)
     *   Row N+1: (blank)
     *   Row N+2: [Site headers with amounts in adjacent columns]
     *   Row N+3: "Sub Total" in col E, values in col F,H,J,M
     *   Row N+4: "Vat @ 16%"  in col E, values in col F,H,J,M
     *   Row N+5: "Total"      in col E, values in col F,H,J,M
     * <p>
     * Known sites: Kitwe Invoice, Mufulira Smelter, Mufulira Mining, Chingola
     */
    private void parseAndSaveCashflowSection(Sheet sheet, PayrollRun payrollRun) {
        // Scan for the "Company Cash Flow" header row
        int headerRow = -1;
        for (int i = 0; i <= sheet.getLastRowNum(); i++) {
            Row row = sheet.getRow(i);
            if (row != null) {
                // Look in column E (index 4) for the cashflow header
                String val = getCellStringValue(row.getCell(4));
                if (val != null && val.equalsIgnoreCase("Company Cash Flow")) {
                    headerRow = i;
                    break;
                }
            }
        }

        if (headerRow == -1) {
            log.info("No 'Company Cash Flow' section found in the import file — skipping cashflow import");
            return;
        }

        int month = payrollRun.getMonth();
        int year = payrollRun.getYear();

        // Site amount column indices (0-based POI column index)
        // The Excel layout places each site's numeric value in a dedicated column:
        //   Kitwe Invoice       → Col F (idx 5)
        //   Mufulira Smelter    → Col H (idx 7)
        //   Mufulira Mining     → Col J (idx 9)
        //   Chingola            → Col M (idx 12)
        Map<String, Integer> siteAmountCols = new LinkedHashMap<>();
        siteAmountCols.put("Kitwe Invoice", 5);
        siteAmountCols.put("Mufulira Smelter", 7);
        siteAmountCols.put("Mufulira Mining", 9);
        siteAmountCols.put("Chingola", 12);

        // Parse the three data rows: Sub Total, Vat, and Total
        Map<String, BigDecimal> subTotals = new HashMap<>();
        Map<String, BigDecimal> vatAmounts = new HashMap<>();
        Map<String, BigDecimal> totals = new HashMap<>();

        for (int i = headerRow + 2; i <= sheet.getLastRowNum(); i++) {
            Row row = sheet.getRow(i);
            if (row == null) continue;

            String label = getCellStringValue(row.getCell(4)); // Column E
            if (label == null) continue;

            if (label.equalsIgnoreCase("Sub Total")) {
                for (Map.Entry<String, Integer> entry : siteAmountCols.entrySet()) {
                    subTotals.put(entry.getKey(), getNumericCellValue(row.getCell(entry.getValue())));
                }
            } else if (label.toLowerCase().contains("vat")) {
                for (Map.Entry<String, Integer> entry : siteAmountCols.entrySet()) {
                    vatAmounts.put(entry.getKey(), getNumericCellValue(row.getCell(entry.getValue())));
                }
            } else if (label.equalsIgnoreCase("Total")) {
                for (Map.Entry<String, Integer> entry : siteAmountCols.entrySet()) {
                    totals.put(entry.getKey(), getNumericCellValue(row.getCell(entry.getValue())));
                }
            }
            // Stop after processing all three data rows — they should be consecutive
            if (!subTotals.isEmpty() && !vatAmounts.isEmpty() && !totals.isEmpty()) {
                break;
            }
        }

        // Only proceed if we found at least one non-zero value
        boolean hasData = subTotals.values().stream().anyMatch(v -> v.compareTo(BigDecimal.ZERO) > 0);
        if (!hasData) {
            log.info("Cashflow section found but all values are zero — skipping save");
            return;
        }

        // Remove any existing cashflow revenues for this month/year before inserting
        List<CashflowRevenue> existing = cashflowRevenueRepository.findByMonthAndYearOrderBySiteAsc(month, year);
        if (!existing.isEmpty()) {
            cashflowRevenueRepository.deleteAll(existing);
        }

        // Save each site's revenue data
        for (Map.Entry<String, Integer> entry : siteAmountCols.entrySet()) {
            String site = entry.getKey();
            BigDecimal subTotal = subTotals.getOrDefault(site, BigDecimal.ZERO);
            BigDecimal vatAmount = vatAmounts.getOrDefault(site, BigDecimal.ZERO);
            BigDecimal total = totals.getOrDefault(site, BigDecimal.ZERO);

            // Skip sites with no data
            if (subTotal.compareTo(BigDecimal.ZERO) == 0
                    && vatAmount.compareTo(BigDecimal.ZERO) == 0
                    && total.compareTo(BigDecimal.ZERO) == 0) {
                continue;
            }

            CashflowRevenue revenue = CashflowRevenue.builder()
                    .site(site)
                    .subTotal(subTotal)
                    .vatRate(new BigDecimal("16.00"))
                    .vatAmount(vatAmount)
                    .total(total)
                    .month(month)
                    .year(year)
                    .build();

            cashflowRevenueRepository.save(revenue);
        }

        log.info("Successfully imported cashflow data for {}/{} from payroll Excel", month, year);
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
            case FORMULA -> {
                try {
                    if (cell.getCachedFormulaResultType() == CellType.NUMERIC) {
                        yield BigDecimal.valueOf(cell.getNumericCellValue()).setScale(2, RoundingMode.HALF_UP);
                    }
                } catch (Exception e) {
                }
                yield BigDecimal.ZERO;
            }
            default -> BigDecimal.ZERO;
        };
    }
}
