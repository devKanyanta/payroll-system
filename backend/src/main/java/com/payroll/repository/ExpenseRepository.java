package com.payroll.repository;

import com.payroll.entity.Expense;
import com.payroll.entity.ExpenseStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public interface ExpenseRepository extends JpaRepository<Expense, UUID> {
    Page<Expense> findByExpenseDateBetween(LocalDate start, LocalDate end, Pageable pageable);

    Page<Expense> findByExpenseDateBetweenAndStatus(LocalDate start, LocalDate end, ExpenseStatus status, Pageable pageable);

    Page<Expense> findByExpenseDateBetweenAndCreatedById(LocalDate start, LocalDate end, UUID createdById, Pageable pageable);

    Page<Expense> findByExpenseDateBetweenAndStatusAndCreatedById(LocalDate start, LocalDate end, ExpenseStatus status, UUID createdById, Pageable pageable);

    List<Expense> findByStatus(ExpenseStatus status);

    @Query("SELECT COALESCE(SUM(e.amount), 0) FROM Expense e WHERE " +
           "e.expenseDate BETWEEN :start AND :end")
    BigDecimal sumExpensesBetween(@Param("start") LocalDate start, @Param("end") LocalDate end);

    @Query("SELECT COALESCE(SUM(e.amount), 0) FROM Expense e WHERE " +
           "EXTRACT(MONTH FROM e.expenseDate) = :month AND " +
           "EXTRACT(YEAR FROM e.expenseDate) = :year")
    BigDecimal sumExpensesByMonth(@Param("month") int month, @Param("year") int year);

    @Query("SELECT e FROM Expense e WHERE " +
           "e.status = 'APPROVED' AND " +
           "EXTRACT(MONTH FROM e.expenseDate) = :month AND " +
           "EXTRACT(YEAR FROM e.expenseDate) = :year")
    List<Expense> findApprovedByMonth(@Param("month") int month, @Param("year") int year);

    boolean existsByCreatedById(UUID createdById);
}
