package com.payroll.service;

import com.payroll.entity.Employee;
import com.payroll.entity.Loan;
import com.payroll.entity.PayrollEntry;
import com.payroll.entity.PayrollSettings;
import java.math.BigDecimal;
import java.util.List;

public interface PayrollCalculationService {
    PayrollEntry calculatePayrollEntry(Employee employee, PayrollSettings settings,
                                       BigDecimal overtimeHours, BigDecimal holidayHours,
                                       List<Loan> activeLoans, BigDecimal otherDeductions,
                                       BigDecimal presentDays);
    BigDecimal calculateHourlyRate(BigDecimal basicSalary, int workingDays, int hoursPerDay);
    BigDecimal calculateGrossSalary(BigDecimal regularAmount, BigDecimal overtimeAmount, BigDecimal holidayAmount);
    BigDecimal calculateRegularAmount(BigDecimal hourlyRate, BigDecimal hours);
    BigDecimal calculateOvertimeAmount(BigDecimal overtimeHours, BigDecimal overtimeRate);
    BigDecimal calculateHolidayAmount(BigDecimal holidayHours, BigDecimal holidayRate);
    BigDecimal calculateNHIMA(BigDecimal grossSalary, BigDecimal nhimaPercent);
    BigDecimal calculateNAPSA(BigDecimal grossSalary, BigDecimal napsaPercent, BigDecimal maxEarnings);
    BigDecimal calculateNetSalary(BigDecimal grossSalary, BigDecimal nhima, BigDecimal napsa, BigDecimal loanDeduction);
    BigDecimal calculateLoanDeduction(List<Loan> activeLoans, BigDecimal softLoanInterestRate);
    BigDecimal calculateTotalLoanBalance(List<Loan> activeLoans);
}
