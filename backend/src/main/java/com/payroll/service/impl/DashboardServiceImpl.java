package com.payroll.service.impl;

import com.payroll.entity.ExpenseStatus;
import com.payroll.entity.LoanStatus;
import com.payroll.entity.PayrollRunStatus;
import com.payroll.entity.PpeRequestStatus;
import com.payroll.dto.CashflowSummaryResponse;
import com.payroll.repository.*;
import com.payroll.service.CashflowService;
import com.payroll.service.DashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class DashboardServiceImpl implements DashboardService {

    private final EmployeeRepository employeeRepository;
    private final PayrollRunRepository payrollRunRepository;
    private final PayrollEntryRepository payrollEntryRepository;
    private final ExpenseRepository expenseRepository;
    private final LoanRepository loanRepository;
    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final AuditLogRepository auditLogRepository;
    private final CashflowService cashflowService;
    private final PpeRequestRepository ppeRequestRepository;

    @Override
    public Map<String, Object> getDashboardStats() {
        Map<String, Object> stats = new LinkedHashMap<>();

        // ── Employee Stats ──
        long totalEmployees = employeeRepository.count();
        long activeEmployees = employeeRepository.countActiveEmployees();

        stats.put("totalEmployees", totalEmployees);
        stats.put("activeEmployees", activeEmployees);
        stats.put("inactiveEmployees", totalEmployees - activeEmployees);
        stats.put("totalDepartments", departmentRepository.count());

        // ── Loan Stats ──
        long activeLoans = loanRepository.countByStatus(LoanStatus.ACTIVE);
        BigDecimal activeLoanBalance = loanRepository.sumActiveLoanBalances();

        stats.put("activeLoans", activeLoans);
        stats.put("activeLoansTotal", activeLoanBalance);

        // ── Payroll Stats ──
        int currentMonth = LocalDate.now().getMonthValue();
        int currentYear = LocalDate.now().getYear();

        var currentRun = payrollRunRepository.findByMonthAndYear(currentMonth, currentYear);
        if (currentRun.isPresent()) {
            var run = currentRun.get();
            BigDecimal gross = payrollEntryRepository.sumGrossSalaryByRunId(run.getId());
            BigDecimal net = payrollEntryRepository.sumNetSalaryByRunId(run.getId());
            BigDecimal paye = payrollEntryRepository.sumPayeByRunId(run.getId());
            BigDecimal napsa = payrollEntryRepository.sumNapsaByRunId(run.getId());
            BigDecimal nhima = payrollEntryRepository.sumNhimaByRunId(run.getId());

            stats.put("currentPayrollRun", Map.of(
                    "id", run.getId(),
                    "status", run.getStatus(),
                    "month", run.getMonth(),
                    "year", run.getYear()
            ));
            stats.put("monthlyPayrollTotal", net);
            stats.put("payrollSummary", Map.of(
                    "grossSalary", gross,
                    "netSalary", net,
                    "paye", paye,
                    "napsa", napsa,
                    "nhima", nhima,
                    "totalDeductions", paye.add(napsa).add(nhima)
            ));
        } else {
            stats.put("currentPayrollRun", null);
            stats.put("monthlyPayrollTotal", BigDecimal.ZERO);
            stats.put("payrollSummary", Map.of(
                    "grossSalary", BigDecimal.ZERO,
                    "netSalary", BigDecimal.ZERO,
                    "paye", BigDecimal.ZERO,
                    "napsa", BigDecimal.ZERO,
                    "nhima", BigDecimal.ZERO,
                    "totalDeductions", BigDecimal.ZERO
            ));
        }

        // ── Pending approvals (payrolls submitted and awaiting review) ──
        long pendingPayrolls = payrollRunRepository.findByStatus(PayrollRunStatus.SUBMITTED).size();
        long pendingPpeRequests = ppeRequestRepository.countByStatus(PpeRequestStatus.PENDING);
        long pendingExpenses = expenseRepository.findByStatus(ExpenseStatus.PENDING).size();
        stats.put("pendingPayrolls", pendingPayrolls);
        stats.put("pendingPpeRequests", pendingPpeRequests);
        stats.put("pendingExpenses", pendingExpenses);
        stats.put("totalPending", pendingPayrolls + pendingPpeRequests + pendingExpenses);

        // ── Monthly expenses ──
        LocalDate monthStart = LocalDate.of(currentYear, currentMonth, 1);
        LocalDate monthEnd = monthStart.withDayOfMonth(monthStart.lengthOfMonth());
        BigDecimal monthlyExpenses = expenseRepository.sumExpensesBetween(monthStart, monthEnd);
        stats.put("totalExpenses", monthlyExpenses != null ? monthlyExpenses : BigDecimal.ZERO);

        // ── Total users ──
        stats.put("totalUsers", userRepository.count());

        // ── Employee distribution by department ──
        List<Map<String, Object>> deptBreakdown = new ArrayList<>();
        List<Object[]> deptData = employeeRepository.countActiveByDepartment();
        for (Object[] row : deptData) {
            Map<String, Object> dept = new LinkedHashMap<>();
            dept.put("name", row[0]);
            dept.put("count", row[1]);
            deptBreakdown.add(dept);
        }
        stats.put("employeeByDepartment", deptBreakdown);

        // ── Recent Activity ──
        List<Map<String, Object>> recentActivity = new ArrayList<>();
        var recentLogs = auditLogRepository.findTop10ByOrderByTimestampDesc();
        for (var log : recentLogs) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("action", log.getAction());
            entry.put("entity", log.getEntityName());
            entry.put("user", log.getUser() != null
                    ? log.getUser().getFirstName() + " " + log.getUser().getLastName()
                    : "System");
            entry.put("timestamp", log.getTimestamp() != null ? log.getTimestamp().toString() : null);
            recentActivity.add(entry);
        }
        stats.put("recentActivity", recentActivity);

        // ── Cashflow Summary (for admin dashboard) ──
        try {
            CashflowSummaryResponse cashflow = cashflowService.getCashflowSummary(currentMonth, currentYear);
            stats.put("cashflow", cashflow);
        } catch (Exception e) {
            // Don't fail dashboard if cashflow isn't available
            stats.put("cashflow", null);
        }

        return stats;
    }
}
