package com.payroll.service.impl;

import com.payroll.dto.EmployeeRequest;
import com.payroll.dto.EmployeeResponse;
import com.payroll.dto.PagedResponse;
import com.payroll.entity.*;
import com.payroll.exception.DuplicateResourceException;
import com.payroll.exception.ResourceNotFoundException;
import com.payroll.repository.DepartmentRepository;
import com.payroll.repository.EmployeeRepository;
import com.payroll.service.EmployeeService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class EmployeeServiceImpl implements EmployeeService {

    private final EmployeeRepository employeeRepository;
    private final DepartmentRepository departmentRepository;

    @Override
    @Transactional(readOnly = true)
    public PagedResponse<EmployeeResponse> getAllEmployees(String search, UUID departmentId, EmployeeStatus status, Pageable pageable) {
        var page = employeeRepository.searchEmployees(search, departmentId, status, pageable);
        return PagedResponse.from(page.map(this::toResponse));
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
        if (employeeRepository.existsByEmail(request.getEmail())) {
            throw new DuplicateResourceException("Employee with email '" + request.getEmail() + "' already exists");
        }

        Department department = null;
        if (request.getDepartmentId() != null) {
            department = departmentRepository.findById(request.getDepartmentId())
                    .orElseThrow(() -> new ResourceNotFoundException("Department", request.getDepartmentId()));
        }

        Employee employee = Employee.builder()
                .employeeNumber(request.getEmployeeNumber() != null ? request.getEmployeeNumber() : generateEmployeeNumber())
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .email(request.getEmail())
                .phone(request.getPhone())
                .nrc(request.getNrc())
                .department(department)
                .position(request.getPosition())
                .site(request.getSite())
                .employmentType(EmploymentType.valueOf(request.getEmploymentType()))
                .salaryType(SalaryType.valueOf(request.getSalaryType()))
                .bankName(request.getBankName())
                .accountNumber(request.getAccountNumber())
                .dateHired(request.getDateHired())
                .rate(request.getRate())
                .status(request.getStatus() != null ? EmployeeStatus.valueOf(request.getStatus()) : EmployeeStatus.ACTIVE)
                .build();

        return toResponse(employeeRepository.save(employee));
    }

    @Override
    @Transactional
    public EmployeeResponse updateEmployee(UUID id, EmployeeRequest request) {
        Employee employee = employeeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Employee", id));

        if (!employee.getEmail().equalsIgnoreCase(request.getEmail())
                && employeeRepository.existsByEmail(request.getEmail())) {
            throw new DuplicateResourceException("Employee with email '" + request.getEmail() + "' already exists");
        }

        Department department = null;
        if (request.getDepartmentId() != null) {
            department = departmentRepository.findById(request.getDepartmentId())
                    .orElseThrow(() -> new ResourceNotFoundException("Department", request.getDepartmentId()));
        }

        if (request.getEmployeeNumber() != null
                && !request.getEmployeeNumber().equals(employee.getEmployeeNumber())
                && employeeRepository.existsByEmployeeNumber(request.getEmployeeNumber())) {
            throw new DuplicateResourceException("Employee with number '" + request.getEmployeeNumber() + "' already exists");
        }

        employee.setEmployeeNumber(request.getEmployeeNumber() != null ? request.getEmployeeNumber() : employee.getEmployeeNumber());
        employee.setFirstName(request.getFirstName());
        employee.setLastName(request.getLastName());
        employee.setEmail(request.getEmail());
        employee.setPhone(request.getPhone());
        employee.setNrc(request.getNrc());
        employee.setDepartment(department);
        employee.setPosition(request.getPosition());
        employee.setSite(request.getSite());
        employee.setEmploymentType(EmploymentType.valueOf(request.getEmploymentType()));
        employee.setSalaryType(SalaryType.valueOf(request.getSalaryType()));
        employee.setBankName(request.getBankName());
        employee.setAccountNumber(request.getAccountNumber());
        employee.setDateHired(request.getDateHired());
        employee.setRate(request.getRate());
        employee.setStatus(request.getStatus() != null ? EmployeeStatus.valueOf(request.getStatus()) : employee.getStatus());

        return toResponse(employeeRepository.save(employee));
    }

    @Override
    @Transactional
    public void deleteEmployee(UUID id) {
        Employee employee = employeeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Employee", id));
        employeeRepository.delete(employee);
    }

    @Override
    @Transactional(readOnly = true)
    public List<EmployeeResponse> getActiveEmployeesNotInPayrollRun(UUID payrollRunId) {
        return employeeRepository.findActiveEmployeesNotInPayrollRun(payrollRunId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    public String generateEmployeeNumber() {
        String prefix = "EMP";
        long count = employeeRepository.count();
        return prefix + String.format("%04d", count + 1);
    }

    private EmployeeResponse toResponse(Employee employee) {
        return EmployeeResponse.builder()
                .id(employee.getId())
                .employeeNumber(employee.getEmployeeNumber())
                .firstName(employee.getFirstName())
                .lastName(employee.getLastName())
                .email(employee.getEmail())
                .phone(employee.getPhone())
                .nrc(employee.getNrc())
                .departmentId(employee.getDepartment() != null ? employee.getDepartment().getId() : null)
                .departmentName(employee.getDepartment() != null ? employee.getDepartment().getName() : null)
                .position(employee.getPosition())
                .site(employee.getSite())
                .employmentType(employee.getEmploymentType().name())
                .salaryType(employee.getSalaryType().name())
                .bankName(employee.getBankName())
                .accountNumber(employee.getAccountNumber())
                .dateHired(employee.getDateHired())
                .rate(employee.getRate())
                .status(employee.getStatus().name())
                .createdAt(employee.getCreatedAt())
                .build();
    }
}
