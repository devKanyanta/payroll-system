package com.payroll.service;

import com.payroll.entity.Expense;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDate;
import java.util.UUID;

public interface ExpenseService {
    Page<Expense> getAllExpenses(LocalDate start, LocalDate end, Pageable pageable);
    Expense getExpenseById(UUID id);
    Expense createExpense(Expense expense);
    Expense updateExpense(UUID id, Expense expense);
    void deleteExpense(UUID id);
}
