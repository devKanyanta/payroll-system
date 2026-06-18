package com.payroll.service.impl;

import com.payroll.entity.Expense;
import com.payroll.exception.ResourceNotFoundException;
import com.payroll.repository.ExpenseRepository;
import com.payroll.service.ExpenseService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ExpenseServiceImpl implements ExpenseService {

    private final ExpenseRepository expenseRepository;

    @Override
    public Page<Expense> getAllExpenses(LocalDate start, LocalDate end, Pageable pageable) {
        if (start == null) {
            start = LocalDate.of(2000, 1, 1);
        }
        if (end == null) {
            end = LocalDate.now().plusYears(10);
        }
        return expenseRepository.findByExpenseDateBetween(start, end, pageable);
    }

    @Override
    public Expense getExpenseById(UUID id) {
        return expenseRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Expense", id));
    }

    @Override
    @Transactional
    public Expense createExpense(Expense expense) {
        return expenseRepository.save(expense);
    }

    @Override
    @Transactional
    public Expense updateExpense(UUID id, Expense expense) {
        Expense existing = expenseRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Expense", id));

        existing.setItem(expense.getItem());
        existing.setAmount(expense.getAmount());
        existing.setRemarks(expense.getRemarks());
        existing.setExpenseDate(expense.getExpenseDate());

        return expenseRepository.save(existing);
    }

    @Override
    @Transactional
    public void deleteExpense(UUID id) {
        Expense expense = expenseRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Expense", id));
        expenseRepository.delete(expense);
    }
}
