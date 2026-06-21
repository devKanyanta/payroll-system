package com.payroll.service.impl;

import com.payroll.entity.PayrollRunStatus;
import com.payroll.repository.*;
import com.payroll.service.DashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class DashboardServiceImpl implements DashboardService {

    private final EmployeeRepository employeeRepository;
    private final PayrollRunRepository payrollRunRepository;
    private final PayrollEntryRepository payrollEntryRepository;
    private final ExpenseRepository expenseRepository;
    private final LoanRepository loanRepository;
    private final UserRepository userRepository;

    @Override
    public Map<String, Object> getDashboardStats() {
        Map<String, Object> stats = new HashMap<>();

        long totalEmployees = employeeRepository.count();
        long activeEmployees = employeeRepository.countActiveEmployees();
        long totalUsers = userRepository.count();
        long activePayrollRuns = payrollRunRepository.findByStatus(PayrollRunStatus.DRAFT).size();

        stats.put("totalEmployees", totalEmployees);
        stats.put("activeEmployees", activeEmployees);
        stats.put("totalUsers", totalUsers);
        stats.put("activePayrollRuns", activePayrollRuns);

        int currentMonth = LocalDate.now().getMonthValue();
        int currentYear = LocalDate.now().getYear();

        var currentRun = payrollRunRepository.findByMonthAndYear(currentMonth, currentYear);
        if (currentRun.isPresent()) {
            var run = currentRun.get();
            stats.put("currentPayrollRun", Map.of(
                    "id", run.getId(),
                    "status", run.getStatus(),
                    "month", run.getMonth(),
                    "year", run.getYear()
            ));
            stats.put("totalGrossSalary", payrollEntryRepository.sumGrossSalaryByRunId(run.getId()));
            stats.put("totalNetSalary", payrollEntryRepository.sumNetSalaryByRunId(run.getId()));
            stats.put("totalPaye", payrollEntryRepository.sumPayeByRunId(run.getId()));
            stats.put("totalNapsa", payrollEntryRepository.sumNapsaByRunId(run.getId()));
            stats.put("totalNhima", payrollEntryRepository.sumNhimaByRunId(run.getId()));
        }

        LocalDate monthStart = LocalDate.of(currentYear, currentMonth, 1);
        LocalDate monthEnd = monthStart.withDayOfMonth(monthStart.lengthOfMonth());
        stats.put("totalExpenses", expenseRepository.sumExpensesBetween(monthStart, monthEnd));

        return stats;
    }
}
