package com.payroll.service;

import com.payroll.entity.Expense;
import com.payroll.entity.ExpenseStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDate;
import java.util.UUID;

public interface ExpenseService {
    Page<Expense> getAllExpenses(LocalDate start, LocalDate end, ExpenseStatus status, UUID userId, boolean isAdmin, Pageable pageable);
    Expense getExpenseById(UUID id);
    Expense createExpense(Expense expense, UUID userId);
    Expense updateExpense(UUID id, Expense expense, UUID userId);
    void deleteExpense(UUID id, UUID userId);
    Expense approveExpense(UUID id, UUID userId);
    Expense rejectExpense(UUID id, UUID userId, String reason);
    byte[] exportApprovedExpensesToExcel(Integer month, Integer year);
}
