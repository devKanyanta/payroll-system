package com.payroll.service;

import com.payroll.entity.Payslip;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public interface PayslipService {
    List<Payslip> getPayslipsByEmployee(UUID employeeId);
    Payslip getPayslipById(UUID id);
    byte[] downloadPayslip(UUID id);
    void generatePayslips(UUID payrollRunId);
    void emailPayslip(UUID id);

    // New: Bulk email all payslips for a run
    Map<String, Object> emailAllPayslipsForRun(UUID payrollRunId);

    // New: Invalidate payslips for a run (when reopened from APPROVED)
    void invalidatePayslipsForRun(UUID payrollRunId);

    // New: Download all payslips for a run as a ZIP
    byte[] downloadPayslipsZip(UUID payrollRunId);

    // New: Download all payslips for a specific month/year as a ZIP
    byte[] downloadPayslipsByMonth(int month, int year);
}
