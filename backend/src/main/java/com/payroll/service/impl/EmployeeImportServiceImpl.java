package com.payroll.service.impl;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.payroll.entity.*;
import com.payroll.exception.BusinessRuleException;
import com.payroll.exception.ResourceNotFoundException;
import com.payroll.repository.*;
import com.payroll.service.EmployeeImportService;
import com.payroll.service.FileStorageService;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;

@Service
@RequiredArgsConstructor
public class EmployeeImportServiceImpl implements EmployeeImportService {

    private final EmployeeImportRepository employeeImportRepository;
    private final EmployeeRepository employeeRepository;
    private final DepartmentRepository departmentRepository;
    private final FileStorageService fileStorageService;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final DateTimeFormatter[] DATE_FORMATS = {
            DateTimeFormatter.ofPattern("dd/MM/yyyy"),
            DateTimeFormatter.ofPattern("yyyy-MM-dd"),
            DateTimeFormatter.ofPattern("MM/dd/yyyy"),
            DateTimeFormatter.ofPattern("dd-MM-yyyy"),
    };

    @Override
    @Transactional
    public EmployeeImport uploadFile(MultipartFile file, UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));

        String filePath = fileStorageService.storeFile(file, "employee-imports");

        EmployeeImport employeeImport = EmployeeImport.builder()
                .fileName(file.getOriginalFilename())
                .filePath(filePath)
                .totalRows(0)
                .successRows(0)
                .errorRows(0)
                .createdBy(user)
                .build();

        return employeeImportRepository.save(employeeImport);
    }

    @Override
    @Transactional
    public EmployeeImport processImport(UUID importId, UUID userId) {
        EmployeeImport employeeImport = employeeImportRepository.findById(importId)
                .orElseThrow(() -> new ResourceNotFoundException("EmployeeImport", importId));

        if (employeeImport.getStatus() != ImportStatus.UPLOADED) {
            throw new BusinessRuleException("Import has already been processed");
        }

        Resource fileResource = fileStorageService.loadFile(employeeImport.getFilePath());
        List<ImportError> errors = new ArrayList<>();

        // Ensure "General" department exists
        Department generalDepartment = departmentRepository.findByName("General")
                .orElseGet(() -> departmentRepository.save(
                        Department.builder()
                                .name("General")
                                .description("Default department for imported employees")
                                .build()
                ));

        try (InputStream is = fileResource.getInputStream();
             Workbook workbook = new XSSFWorkbook(is)) {

            Sheet sheet = workbook.getSheet("EMPLOYEES");
            if (sheet == null) {
                sheet = workbook.getSheetAt(0);
            }

            // Parse header row (row 0) to map column names to indices
            Row headerRow = sheet.getRow(0);
            if (headerRow == null) {
                throw new BusinessRuleException("Template is empty — no header row found");
            }

            Map<String, Integer> colMap = new HashMap<>();
            for (int c = 0; c < headerRow.getLastCellNum(); c++) {
                String header = getCellStringValue(headerRow.getCell(c));
                if (header != null && !header.isEmpty()) {
                    colMap.put(header.toUpperCase().trim(), c);
                }
            }

            int totalRows = 0;
            int successRows = 0;
            int errorRows = 0;

            // Pre-load existing employees by NRC for fast lookup
            List<Employee> allEmployees = employeeRepository.findAll();
            Map<String, Employee> employeeByNrc = new HashMap<>();
            for (Employee emp : allEmployees) {
                if (emp.getNrc() != null) {
                    employeeByNrc.put(emp.getNrc().trim().toLowerCase(), emp);
                }
            }

            // Process data rows starting from row 1
            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null) continue;

                int rowNum = i + 1; // 1-based for user display

                try {
                    String names = getCellStringValue(row, colMap, "NAMES");
                    String nrc = getCellStringValue(row, colMap, "NRC");

                    if (names == null || names.isBlank()) {
                        errors.add(new ImportError(rowNum, "NAMES is required"));
                        errorRows++;
                        totalRows++;
                        continue;
                    }

                    if (nrc == null || nrc.isBlank()) {
                        errors.add(new ImportError(rowNum, "NRC is required"));
                        errorRows++;
                        totalRows++;
                        continue;
                    }

                    totalRows++;

                    // Split name on first space
                    String firstName = names.trim();
                    String lastName = "";
                    int spaceIdx = firstName.indexOf(' ');
                    if (spaceIdx > 0) {
                        firstName = names.trim().substring(0, spaceIdx);
                        lastName = names.trim().substring(spaceIdx + 1).trim();
                    }

                    // Parse optional fields
                    String jobTitle = getCellStringValue(row, colMap, "JOB TITLE");
                    String site = getCellStringValue(row, colMap, "SITE");
                    String rateStr = getCellStringValue(row, colMap, "RATE/HRS");
                    String sortCode = getCellStringValue(row, colMap, "SORT CODE");
                    String accountNumber = getCellStringValue(row, colMap, "ACCOUNT NUMBER");
                    String phone = getCellStringValue(row, colMap, "PHONE");
                    String deptName = getCellStringValue(row, colMap, "DEPARTMENT");
                    String empTypeStr = getCellStringValue(row, colMap, "EMPLOYMENT TYPE");
                    String salTypeStr = getCellStringValue(row, colMap, "SALARY TYPE");
                    String dateHiredStr = getCellStringValue(row, colMap, "DATE HIRED");

                    // Validate employment type
                    EmploymentType employmentType = EmploymentType.FULL_TIME;
                    if (empTypeStr != null && !empTypeStr.isBlank()) {
                        try {
                            employmentType = EmploymentType.valueOf(empTypeStr.trim().toUpperCase());
                        } catch (IllegalArgumentException e) {
                            errors.add(new ImportError(rowNum, "Invalid EMPLOYMENT TYPE: '" + empTypeStr + "'. Must be FULL_TIME, PART_TIME, or CONTRACT"));
                            errorRows++;
                            continue;
                        }
                    }

                    // Validate salary type
                    SalaryType salaryType = SalaryType.MONTHLY;
                    if (salTypeStr != null && !salTypeStr.isBlank()) {
                        try {
                            salaryType = SalaryType.valueOf(salTypeStr.trim().toUpperCase());
                        } catch (IllegalArgumentException e) {
                            errors.add(new ImportError(rowNum, "Invalid SALARY TYPE: '" + salTypeStr + "'. Must be MONTHLY or HOURLY"));
                            errorRows++;
                            continue;
                        }
                    }

                    // Parse rate
                    BigDecimal rate = BigDecimal.ZERO;
                    if (rateStr != null && !rateStr.isBlank()) {
                        try {
                            rate = new BigDecimal(rateStr.trim());
                        } catch (NumberFormatException e) {
                            errors.add(new ImportError(rowNum, "Invalid RATE/HRS: '" + rateStr + "'"));
                            errorRows++;
                            continue;
                        }
                    }

                    // Parse date hired
                    LocalDate dateHired = LocalDate.now();
                    if (dateHiredStr != null && !dateHiredStr.isBlank()) {
                        dateHired = parseDate(dateHiredStr.trim());
                        if (dateHired == null) {
                            errors.add(new ImportError(rowNum, "Invalid DATE HIRED: '" + dateHiredStr + "'. Expected format: DD/MM/YYYY"));
                            errorRows++;
                            continue;
                        }
                    }

                    // Resolve department
                    Department department = generalDepartment;
                    if (deptName != null && !deptName.isBlank()) {
                        department = departmentRepository.findByName(deptName.trim())
                                .orElseGet(() -> departmentRepository.save(
                                        Department.builder()
                                                .name(deptName.trim())
                                                .description("")
                                                .build()
                                ));
                    }

                    // Parse optional employee number
                    String employeeNumberStr = getCellStringValue(row, colMap, "EMPLOYEE NUMBER");

                    // Validate employee number uniqueness if provided
                    String resolvedEmployeeNumber = null;
                    if (employeeNumberStr != null && !employeeNumberStr.isBlank()) {
                        String empNum = employeeNumberStr.trim().toUpperCase();
                        if (employeeRepository.existsByEmployeeNumber(empNum)) {
                            errors.add(new ImportError(rowNum, "EMPLOYEE NUMBER '" + empNum + "' already exists"));
                            errorRows++;
                            totalRows++;
                            continue;
                        }
                        resolvedEmployeeNumber = empNum;
                    }

                    String normalizedNrc = nrc.trim().toLowerCase();
                    Employee existingEmployee = employeeByNrc.get(normalizedNrc);

                    if (existingEmployee != null) {
                        // Update existing employee
                        existingEmployee.setFirstName(firstName);
                        existingEmployee.setLastName(lastName);
                        existingEmployee.setPosition(jobTitle);
                        existingEmployee.setSite(site);
                        existingEmployee.setSortCode(sortCode);
                        existingEmployee.setAccountNumber(accountNumber);
                        existingEmployee.setPhone(phone);
                        existingEmployee.setDepartment(department);
                        existingEmployee.setEmploymentType(employmentType);
                        existingEmployee.setSalaryType(salaryType);
                        existingEmployee.setRate(rate);
                        existingEmployee.setDateHired(dateHired);
                        // Update employee number if provided
                        if (resolvedEmployeeNumber != null) {
                            existingEmployee.setEmployeeNumber(resolvedEmployeeNumber);
                        }
                        employeeRepository.save(existingEmployee);
                    } else {
                        // Create new employee
                        Employee newEmployee = Employee.builder()
                                .employeeNumber(resolvedEmployeeNumber != null ? resolvedEmployeeNumber : generateEmployeeNumber())
                                .firstName(firstName)
                                .lastName(lastName)
                                .nrc(nrc.trim())
                                .email(null)
                                .phone(phone)
                                .position(jobTitle)
                                .site(site)
                                .department(department)
                                .employmentType(employmentType)
                                .salaryType(salaryType)
                                .sortCode(sortCode)
                                .accountNumber(accountNumber)
                                .dateHired(dateHired)
                                .rate(rate)
                                .status(EmployeeStatus.ACTIVE)
                                .build();
                        employeeRepository.save(newEmployee);
                        employeeByNrc.put(normalizedNrc, newEmployee);
                    }

                    successRows++;

                } catch (Exception e) {
                    errors.add(new ImportError(rowNum, "Unexpected error: " + e.getMessage()));
                    errorRows++;
                }
            }

            employeeImport.setTotalRows(totalRows);
            employeeImport.setSuccessRows(successRows);
            employeeImport.setErrorRows(errorRows);
            employeeImport.setErrors(toJsonErrors(errors));
            employeeImport.setStatus(errorRows > 0 && successRows == 0 ? ImportStatus.FAILED : ImportStatus.IMPORTED);

        } catch (Exception e) {
            throw new RuntimeException("Failed to process employee import file", e);
        }

        return employeeImportRepository.save(employeeImport);
    }

    @Override
    public EmployeeImport getImportById(UUID id) {
        return employeeImportRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("EmployeeImport", id));
    }

    @Override
    public List<EmployeeImport> getImportsByUser(UUID userId) {
        return employeeImportRepository.findByCreatedByIdOrderByCreatedAtDesc(userId);
    }

    @Override
    public Resource downloadTemplate() {
        try (Workbook workbook = new XSSFWorkbook()) {
            Sheet sheet = workbook.createSheet("EMPLOYEES");

            // Create header style
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
                    "NAMES", "NRC", "EMPLOYEE NUMBER", "JOB TITLE", "SITE", "RATE/HRS",
                    "SORT CODE", "ACCOUNT NUMBER", "PHONE", "DEPARTMENT",
                    "EMPLOYMENT TYPE", "SALARY TYPE", "DATE HIRED"
            };

            Row headerRow = sheet.createRow(0);
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }

            // Auto-size columns
            for (int i = 0; i < headers.length; i++) {
                sheet.autoSizeColumn(i);
            }

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            workbook.write(baos);
            return new ByteArrayResource(baos.toByteArray());
        } catch (Exception e) {
            throw new RuntimeException("Failed to generate template", e);
        }
    }

    private String generateEmployeeNumber() {
        String prefix = "EMP";
        long count = employeeRepository.count();
        return prefix + String.format("%04d", count + 1);
    }

    private String getCellStringValue(Row row, Map<String, Integer> colMap, String columnName) {
        Integer colIdx = colMap.get(columnName.toUpperCase());
        if (colIdx == null) return null;
        Cell cell = row.getCell(colIdx);
        return getCellStringValue(cell);
    }

    private String getCellStringValue(Cell cell) {
        if (cell == null) return null;
        return switch (cell.getCellType()) {
            case STRING -> cell.getStringCellValue().trim();
            case NUMERIC -> {
                double val = cell.getNumericCellValue();
                if (val == Math.floor(val) && !Double.isInfinite(val)) {
                    yield String.valueOf((long) val);
                }
                yield String.valueOf(val);
            }
            case BOOLEAN -> String.valueOf(cell.getBooleanCellValue());
            default -> null;
        };
    }

    private LocalDate parseDate(String dateStr) {
        for (DateTimeFormatter fmt : DATE_FORMATS) {
            try {
                return LocalDate.parse(dateStr, fmt);
            } catch (DateTimeParseException ignored) {
            }
        }
        return null;
    }

    private String toJsonErrors(List<ImportError> errors) {
        try {
            return objectMapper.writeValueAsString(errors);
        } catch (JsonProcessingException e) {
            return "[]";
        }
    }

    private record ImportError(int row, String message) {}
}
