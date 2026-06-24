package com.payroll.service.impl;

import com.payroll.dto.EmployeeRequest;
import com.payroll.dto.EmployeeResponse;
import com.payroll.dto.PagedResponse;
import com.payroll.entity.*;
import com.payroll.exception.BusinessRuleException;
import com.payroll.exception.DuplicateResourceException;
import com.payroll.exception.ResourceNotFoundException;
import com.payroll.repository.*;
import com.payroll.service.AuditService;
import com.payroll.service.EmployeeService;
import com.payroll.service.FileStorageService;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.util.*;

@Service
@RequiredArgsConstructor
public class EmployeeServiceImpl implements EmployeeService {

    private static final Logger log = LoggerFactory.getLogger(EmployeeServiceImpl.class);

    private final EmployeeRepository employeeRepository;
    private final DepartmentRepository departmentRepository;
    private final UserRepository userRepository;
    private final AuditService auditService;
    private final FileStorageService fileStorageService;

    @Override
    @Transactional(readOnly = true)
    public PagedResponse<EmployeeResponse> getAllEmployees(String search, UUID departmentId, EmployeeStatus status, Pageable pageable) {
        Page<Employee> employeePage = employeeRepository.searchEmployees(search, departmentId, status, pageable);
        List<EmployeeResponse> employees = employeePage.getContent().stream()
                .map(this::toResponse)
                .toList();
        return PagedResponse.<EmployeeResponse>builder()
                .content(employees)
                .page(employeePage.getNumber())
                .size(employeePage.getSize())
                .totalElements(employeePage.getTotalElements())
                .totalPages(employeePage.getTotalPages())
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public EmployeeResponse getEmployeeById(UUID id) {
        Employee employee = employeeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Employee", id));
        return toResponse(employee);
    }

    @Override
    @Transactional
    public EmployeeResponse createEmployee(EmployeeRequest request) {
        if (employeeRepository.existsByEmployeeNumber(request.getEmployeeNumber())) {
            throw new DuplicateResourceException("Employee number already exists");
        }

        Department department = null;
        if (request.getDepartmentId() != null) {
            department = departmentRepository.findById(request.getDepartmentId())
                    .orElseThrow(() -> new ResourceNotFoundException("Department", request.getDepartmentId()));
        }

        Employee employee = Employee.builder()
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .employeeNumber(request.getEmployeeNumber())
                .email(request.getEmail())
                .phone(request.getPhone())
                .nrc(request.getNrc())
                .position(request.getPosition())
                .rate(request.getRate())
                .site(request.getSite())
                .bankName(request.getBankName())
                .accountNumber(request.getAccountNumber())
                .sortCode(request.getSortCode())
                .status(EmployeeStatus.ACTIVE)
                .salaryType(request.getSalaryType() != null ? SalaryType.valueOf(request.getSalaryType()) : SalaryType.MONTHLY)
                .employmentType(request.getEmploymentType() != null ? EmploymentType.valueOf(request.getEmploymentType()) : EmploymentType.FULL_TIME)
                .department(department)
                .build();

        Employee saved = employeeRepository.save(employee);
        return toResponse(saved);
    }

    @Override
    @Transactional
    public EmployeeResponse updateEmployee(UUID id, EmployeeRequest request) {
        Employee employee = employeeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Employee", id));

        Department department = null;
        if (request.getDepartmentId() != null) {
            department = departmentRepository.findById(request.getDepartmentId())
                    .orElseThrow(() -> new ResourceNotFoundException("Department", request.getDepartmentId()));
        }

        employee.setFirstName(request.getFirstName());
        employee.setLastName(request.getLastName());
        employee.setEmployeeNumber(request.getEmployeeNumber());
        employee.setEmail(request.getEmail());
        employee.setPhone(request.getPhone());
        employee.setNrc(request.getNrc());
        employee.setPosition(request.getPosition());
        employee.setRate(request.getRate());
        employee.setSite(request.getSite());
        employee.setBankName(request.getBankName());
        employee.setAccountNumber(request.getAccountNumber());
        employee.setSortCode(request.getSortCode());
        employee.setSalaryType(request.getSalaryType() != null ? SalaryType.valueOf(request.getSalaryType()) : null);
        employee.setEmploymentType(request.getEmploymentType() != null ? EmploymentType.valueOf(request.getEmploymentType()) : null);
        employee.setDepartment(department);

        Employee saved = employeeRepository.save(employee);
        return toResponse(saved);
    }

    @Override
    @Transactional
    public void deleteEmployee(UUID id) {
        Employee employee = employeeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Employee", id));
        employee.setStatus(EmployeeStatus.TERMINATED);
        employeeRepository.save(employee);
    }

    @Override
    @Transactional(readOnly = true)
    public List<EmployeeResponse> getActiveEmployeesNotInPayrollRun(UUID payrollRunId, UUID departmentId) {
        return employeeRepository.findActiveEmployeesNotInPayrollRun(payrollRunId, departmentId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    @Transactional
    public Map<String, Object> importEmployees(MultipartFile file) {
        Map<String, Object> result = new HashMap<>();
        List<Map<String, String>> errors = new ArrayList<>();
        int imported = 0;

        try (Workbook workbook = new XSSFWorkbook(file.getInputStream())) {
            Sheet sheet = workbook.getSheetAt(0);
            Iterator<Row> rowIterator = sheet.iterator();

            if (!rowIterator.hasNext()) {
                throw new BusinessRuleException("Uploaded file is empty");
            }

            Row headerRow = rowIterator.next();
            Map<String, Integer> columnMap = new HashMap<>();
            for (Cell cell : headerRow) {
                columnMap.put(cell.getStringCellValue().toLowerCase().trim(), cell.getColumnIndex());
            }

            while (rowIterator.hasNext()) {
                Row row = rowIterator.next();
                try {
                    Employee employee = new Employee();
                    employee.setStatus(EmployeeStatus.ACTIVE);

                    employee.setEmployeeNumber(getCellStringValue(row, columnMap.get("employeenumber")));
                    employee.setFirstName(getCellStringValue(row, columnMap.get("firstname")));
                    employee.setLastName(getCellStringValue(row, columnMap.get("lastname")));

                    String emailVal = getCellStringValue(row, columnMap.get("email"));
                    employee.setEmail(emailVal != null && !emailVal.isEmpty() ? emailVal : null);

                    employee.setPhone(getCellStringValue(row, columnMap.get("phone")));
                    employee.setNrc(getCellStringValue(row, columnMap.get("nrc")));
                    employee.setPosition(getCellStringValue(row, columnMap.get("position")));
                    employee.setBankName(getCellStringValue(row, columnMap.get("bankname")));
                    employee.setAccountNumber(getCellStringValue(row, columnMap.get("accountnumber")));
                    employee.setSortCode(getCellStringValue(row, columnMap.get("sortcode")));
                    employee.setSite(getCellStringValue(row, columnMap.get("site")));

                    String rateStr = getCellStringValue(row, columnMap.get("rate"));
                    if (rateStr != null && !rateStr.isEmpty()) {
                        employee.setRate(new BigDecimal(rateStr));
                    }

                    String deptName = getCellStringValue(row, columnMap.get("department"));
                    if (deptName != null && !deptName.isEmpty()) {
                        Department dept = departmentRepository.findByName(deptName.trim()).orElse(null);
                        if (dept == null) {
                            dept = departmentRepository.save(Department.builder().name(deptName.trim()).build());
                        }
                        employee.setDepartment(dept);
                    }

                    if (employeeRepository.existsByEmployeeNumber(employee.getEmployeeNumber())) {
                        errors.add(Map.of(
                                "row", String.valueOf(row.getRowNum() + 1),
                                "error", "Employee number already exists: " + employee.getEmployeeNumber()
                        ));
                        continue;
                    }

                    employeeRepository.save(employee);
                    imported++;

                } catch (Exception e) {
                    log.error("Error importing row {}: {}", row.getRowNum() + 1, e.getMessage());
                    errors.add(Map.of(
                            "row", String.valueOf(row.getRowNum() + 1),
                            "error", e.getMessage()
                    ));
                }
            }
        } catch (IOException e) {
            throw new BusinessRuleException("Failed to read uploaded file: " + e.getMessage());
        }

        result.put("imported", imported);
        result.put("errors", errors);
        result.put("total", imported + errors.size());

        return result;
    }

    private String getCellStringValue(Row row, Integer columnIndex) {
        if (columnIndex == null) return "";
        Cell cell = row.getCell(columnIndex);
        if (cell == null) return "";

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
            default -> "";
        };
    }

    private EmployeeResponse toResponse(Employee employee) {
        return EmployeeResponse.builder()
                .id(employee.getId())
                .firstName(employee.getFirstName())
                .lastName(employee.getLastName())
                .employeeNumber(employee.getEmployeeNumber())
                .email(employee.getEmail())
                .phone(employee.getPhone())
                .nrc(employee.getNrc())
                .position(employee.getPosition())
                .rate(employee.getRate())
                .site(employee.getSite())
                .bankName(employee.getBankName())
                .accountNumber(employee.getAccountNumber())
                .sortCode(employee.getSortCode())
                .status(employee.getStatus().name())
                .salaryType(employee.getSalaryType() != null ? employee.getSalaryType().name() : null)
                .employmentType(employee.getEmploymentType() != null ? employee.getEmploymentType().name() : null)
                .departmentId(employee.getDepartment() != null ? employee.getDepartment().getId() : null)
                .departmentName(employee.getDepartment() != null ? employee.getDepartment().getName() : null)
                .createdAt(employee.getCreatedAt())
                .build();
    }
}
