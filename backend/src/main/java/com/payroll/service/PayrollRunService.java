package com.payroll.service;

import com.payroll.dto.PagedResponse;
import com.payroll.entity.EmployeeDeduction;
import com.payroll.entity.PayrollEntry;
import com.payroll.entity.PayrollRun;
import com.payroll.entity.PayrollRunStatus;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public interface PayrollRunService {
    PagedResponse<PayrollRun> getAllPayrollRuns(Integer month, Integer year, PayrollRunStatus status, Pageable pageable);
    PayrollRun getPayrollRunById(UUID id);
    PayrollRun createPayrollRun(Integer month, Integer year, UUID userId);
    PayrollRun submitPayrollRun(UUID id, UUID userId);
    PayrollRun approvePayrollRun(UUID id, UUID userId);
    PayrollRun rejectPayrollRun(UUID id, UUID userId, String reason);
    PayrollRun reopenPayrollRun(UUID id, UUID userId);
    List<PayrollEntry> addEmployeesToPayrollRun(UUID runId, List<UUID> employeeIds, UUID userId);
    void removeEmployeeFromPayrollRun(UUID runId, UUID entryId, UUID userId);
    PayrollEntry updatePayrollEntry(UUID runId, UUID entryId, BigDecimal presentDays, BigDecimal overtimeHours, BigDecimal holidayHours);
    void recalculateLoanDeductions(UUID runId);
    byte[] exportPayrollRunToExcel(UUID runId);

    // New: Pre-submit validation
    List<Map<String, String>> validateBeforeSubmit(UUID runId);

    // New: Per-entry deduction management
    EmployeeDeduction addDeductionToEntry(UUID runId, UUID entryId, UUID deductionTypeId, BigDecimal amount);
    void removeDeductionFromEntry(UUID runId, UUID entryId, UUID deductionId);

    // New: Bulk email payslips
    Map<String, Object> emailAllPayslips(UUID runId);
}
