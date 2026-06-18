package com.payroll.service;

import com.payroll.entity.Payslip;
import java.util.List;
import java.util.UUID;

public interface PayslipService {
    List<Payslip> getPayslipsByEmployee(UUID employeeId);
    Payslip getPayslipById(UUID id);
    byte[] downloadPayslip(UUID id);
    void generatePayslips(UUID payrollRunId);
    void emailPayslip(UUID id);
}