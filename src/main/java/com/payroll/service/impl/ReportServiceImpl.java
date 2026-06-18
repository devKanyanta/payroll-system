package com.payroll.service.impl;

import com.payroll.entity.PayrollEntry;
import com.payroll.entity.PayrollRun;
import com.payroll.repository.ExpenseRepository;
import com.payroll.repository.PayrollEntryRepository;
import com.payroll.repository.PayrollRunRepository;
import com.payroll.service.ReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ReportServiceImpl implements ReportService {

    private final PayrollRunRepository payrollRunRepository;
    private final PayrollEntryRepository payrollEntryRepository;
    private final ExpenseRepository expenseRepository;

    @Override
    public Map<String, Object> getPayrollSummary(int month, int year, UUID departmentId) {
        Map<String, Object> summary = new HashMap<>();

        List<PayrollEntry> entries = List.of();

        Optional<PayrollRun> payrollRun = payrollRunRepository.findByMonthAndYear(month, year);
        if (payrollRun.isPresent()) {
            if (departmentId != null) {
                entries = payrollEntryRepository.findByPayrollRunId(payrollRun.get().getId()).stream()
                        .filter(e -> e.getEmployee().getDepartment() != null
                                && e.getEmployee().getDepartment().getId().equals(departmentId))
                        .toList();
            } else {
                entries = payrollEntryRepository.findByPayrollRunId(payrollRun.get().getId());
            }
        }

        BigDecimal totalGross = entries.stream()
                .map(PayrollEntry::getGrossSalary).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalNet = entries.stream()
                .map(PayrollEntry::getNetSalary).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalPaye = entries.stream()
                .map(PayrollEntry::getPaye).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalNapsa = entries.stream()
                .map(PayrollEntry::getNapsa).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalNhima = entries.stream()
                .map(PayrollEntry::getNhima).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalLoanDeductions = entries.stream()
                .map(e -> e.getLoanDeduction() != null ? e.getLoanDeduction() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalOtherDeductions = entries.stream()
                .map(e -> e.getOtherDeductions() != null ? e.getOtherDeductions() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        summary.put("month", month);
        summary.put("year", year);
        summary.put("totalEmployees", entries.size());
        summary.put("totalGrossSalary", totalGross);
        summary.put("totalNetSalary", totalNet);
        summary.put("totalPaye", totalPaye);
        summary.put("totalNapsa", totalNapsa);
        summary.put("totalNhima", totalNhima);
        summary.put("totalLoanDeductions", totalLoanDeductions);
        summary.put("totalOtherDeductions", totalOtherDeductions);
        summary.put("totalDeductions", totalPaye.add(totalNapsa).add(totalNhima)
                .add(totalLoanDeductions).add(totalOtherDeductions));

        return summary;
    }

    @Override
    public List<PayrollEntry> getEmployeePayrollHistory(UUID employeeId) {
        return payrollEntryRepository.findByEmployeeIdOrderByPayrollRunYearDescPayrollRunMonthDesc(employeeId);
    }

    @Override
    public Map<String, Object> getExpenseReport(int month, int year) {
        Map<String, Object> report = new HashMap<>();
        BigDecimal totalExpenses = expenseRepository.sumExpensesByMonth(month, year);
        report.put("month", month);
        report.put("year", year);
        report.put("totalExpenses", totalExpenses);
        return report;
    }

    @Override
    public byte[] exportToExcel(int month, int year) {
        throw new UnsupportedOperationException("Excel export not yet implemented");
    }

    @Override
    public byte[] exportToPdf(int month, int year) {
        throw new UnsupportedOperationException("PDF export not yet implemented");
    }
}
