package com.payroll.service;

import com.payroll.entity.PayrollEntry;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public interface ReportService {
    Map<String, Object> getPayrollSummary(int month, int year, UUID departmentId);
    List<PayrollEntry> getEmployeePayrollHistory(UUID employeeId);
    Map<String, Object> getExpenseReport(int month, int year);
    byte[] exportToExcel(int month, int year);
    byte[] exportToPdf(int month, int year);
}
