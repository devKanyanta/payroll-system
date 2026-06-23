package com.payroll.service;

import com.payroll.dto.EmployeeRequest;
import com.payroll.dto.EmployeeResponse;
import com.payroll.dto.PagedResponse;
import com.payroll.entity.EmployeeStatus;
import org.springframework.data.domain.Pageable;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public interface EmployeeService {
    PagedResponse<EmployeeResponse> getAllEmployees(String search, UUID departmentId, EmployeeStatus status, Pageable pageable);
    EmployeeResponse getEmployeeById(UUID id);
    EmployeeResponse createEmployee(EmployeeRequest request);
    EmployeeResponse updateEmployee(UUID id, EmployeeRequest request);
    void deleteEmployee(UUID id);
    List<EmployeeResponse> getActiveEmployeesNotInPayrollRun(UUID payrollRunId, UUID departmentId);
    Map<String, Object> importEmployees(MultipartFile file);
}
