package com.payroll.service.impl;

import com.payroll.entity.Employee;
import com.payroll.entity.Loan;
import com.payroll.entity.PayrollEntry;
import com.payroll.entity.PayrollSettings;
import com.payroll.service.PayrollCalculationService;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

@Service
public class PayrollCalculationServiceImpl implements PayrollCalculationService {

    @Override
    public PayrollEntry calculatePayrollEntry(Employee employee, PayrollSettings settings,
                                               BigDecimal overtimeHours, BigDecimal holidayHours,
                                               List<Loan> activeLoans, BigDecimal otherDeductions,
                                               BigDecimal presentDays) {
        BigDecimal hourlyRate = employee.getRate() != null ? employee.getRate() : BigDecimal.ZERO;
        if (presentDays == null) presentDays = BigDecimal.ZERO;
        if (overtimeHours == null) overtimeHours = BigDecimal.ZERO;
        if (holidayHours == null) holidayHours = BigDecimal.ZERO;
        if (otherDeductions == null) otherDeductions = BigDecimal.ZERO;

        BigDecimal normalHrsPerDay = BigDecimal.valueOf(settings.getHoursPerDay());
        BigDecimal overTimeRateHrly = hourlyRate.multiply(settings.getOvertimeRate());
        BigDecimal holidayRateHrly = hourlyRate.multiply(settings.getHolidayRate());

        BigDecimal regularHours = normalHrsPerDay.multiply(presentDays);
        BigDecimal regularAmount = calculateRegularAmount(hourlyRate, regularHours);
        BigDecimal overtimeAmount = calculateOvertimeAmount(
                overtimeHours, overTimeRateHrly);
        BigDecimal holidayAmount = calculateHolidayAmount(
                holidayHours, holidayRateHrly);
        BigDecimal grossSalary = calculateGrossSalary(regularAmount, overtimeAmount, holidayAmount);
        BigDecimal nhima = calculateNHIMA(grossSalary, settings.getNhimaEmployeePercent());
        BigDecimal napsa = calculateNAPSA(grossSalary, settings.getNapsaEmployeePercent(), settings.getNapsaMaxEarnings());

        // Calculate softloan deduction: (originalLoanAmount * (1 + softLoanInterestRate)) / durationMonths
        BigDecimal softloanDeduction = calculateLoanDeduction(activeLoans, settings.getSoftLoanInterestRate());
        BigDecimal loanBalance = calculateTotalLoanBalance(activeLoans);

        BigDecimal netSalary = calculateNetSalary(grossSalary, nhima, napsa, softloanDeduction);

        // Calculate monthly-equivalent salary from hourly rate for historical record
        BigDecimal monthlyEquivalent = hourlyRate.multiply(
                BigDecimal.valueOf(settings.getHoursPerDay() * settings.getWorkingDaysPerMonth()));

        return PayrollEntry.builder()
                .basicSalary(monthlyEquivalent)
                .hourlyRate(hourlyRate)
                .presentDays(presentDays)
                .loanBalance(loanBalance)
                .site(employee.getSite())
                .regularHours(regularHours)
                .regularAmount(regularAmount)
                .overtimeHours(overtimeHours)
                .overtimeAmount(overtimeAmount)
                .holidayHours(holidayHours)
                .holidayAmount(holidayAmount)
                .grossSalary(grossSalary)
                .nhima(nhima)
                .napsa(napsa)
                .paye(BigDecimal.ZERO)
                .loanDeduction(softloanDeduction)
                .otherDeductions(otherDeductions)
                .netSalary(netSalary)
                .build();
    }

    @Override
    public BigDecimal calculateGrossSalary(BigDecimal regularAmount, BigDecimal overtimeAmount, BigDecimal holidayAmount) {
        return regularAmount.add(overtimeAmount).add(holidayAmount);
    }

    @Override
    public BigDecimal calculateRegularAmount(BigDecimal hourlyRate, BigDecimal hours) {
        return hourlyRate.multiply(hours).setScale(2, RoundingMode.HALF_UP);
    }

    @Override
    public BigDecimal calculateOvertimeAmount(BigDecimal overtimeHours,
                                               BigDecimal overtimeRate) {
        return overtimeRate.multiply(overtimeHours).setScale(2, RoundingMode.HALF_UP);
    }

    @Override
    public BigDecimal calculateHolidayAmount(BigDecimal holidayHours,
                                              BigDecimal holidayRate) {
        return holidayRate.multiply(holidayHours).setScale(2, RoundingMode.HALF_UP);
    }

    @Override
    public BigDecimal calculateNHIMA(BigDecimal grossSalary, BigDecimal nhimaPercent) {
        return grossSalary.multiply(nhimaPercent).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
    }

    @Override
    public BigDecimal calculateNAPSA(BigDecimal grossSalary, BigDecimal napsaPercent, BigDecimal maxEarnings) {
        BigDecimal earnings = (maxEarnings != null && grossSalary.compareTo(maxEarnings) > 0)
                ? maxEarnings : grossSalary;
        return earnings.multiply(napsaPercent).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
    }

    @Override
    public BigDecimal calculateNetSalary(BigDecimal grossSalary, BigDecimal nhima, BigDecimal napsa,
                                          BigDecimal loanDeduction) {
        BigDecimal deductions = nhima.add(napsa).add(loanDeduction);
        return grossSalary.subtract(deductions).max(BigDecimal.ZERO);
    }

    @Override
    public BigDecimal calculateLoanDeduction(List<Loan> activeLoans, BigDecimal softLoanInterestRate) {
        BigDecimal softloanDeduction = BigDecimal.ZERO;
        if (activeLoans != null) {
            for (Loan loan : activeLoans) {
                if (loan.getLoanAmount() != null && loan.getDurationMonths() != null && loan.getDurationMonths() > 0) {
                    BigDecimal totalRepayment = loan.getLoanAmount()
                            .multiply(BigDecimal.ONE.add(softLoanInterestRate));
                    BigDecimal monthlyDeduction = totalRepayment.divide(
                            BigDecimal.valueOf(loan.getDurationMonths()), 2, RoundingMode.HALF_UP);
                    softloanDeduction = softloanDeduction.add(monthlyDeduction);
                }
            }
        }
        return softloanDeduction;
    }

    @Override
    public BigDecimal calculateTotalLoanBalance(List<Loan> activeLoans) {
        BigDecimal loanBalance = BigDecimal.ZERO;
        if (activeLoans != null) {
            for (Loan loan : activeLoans) {
                loanBalance = loanBalance.add(loan.getBalance() != null ? loan.getBalance() : BigDecimal.ZERO);
            }
        }
        return loanBalance;
    }
}
