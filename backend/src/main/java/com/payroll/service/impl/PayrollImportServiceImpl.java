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
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

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
        for (Employee emp : allEmployees) {
            employeeByNrc.put(emp.getNrc(), emp);
            employeeByName.put((emp.getFirstName() + " " + emp.getLastName()).toLowerCase(), emp);
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

                String names = getCellStringValue(row.getCell(1));
                String nrc = getCellStringValue(row.getCell(2));

                if (names == null || names.isEmpty() || names.equalsIgnoreCase("TOTALS")) {
                    continue;
                }

                totalRows++;

                try {
                    Employee employee = null;
                    if (nrc != null && !nrc.isEmpty()) {
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

                    BigDecimal presentDays = getNumericCellValue(row.getCell(9));   // PRESENT DAYS
                    BigDecimal overtimeHrs = getNumericCellValue(row.getCell(11));  // OVERT TIME
                    BigDecimal holidayHrs = getNumericCellValue(row.getCell(13));  // HOLIDAY OVER TIME
                    BigDecimal otherDeduction = getNumericCellValue(row.getCell(20));// OTHER DEDUCTION

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
