package com.payroll.repository;

import com.payroll.entity.Loan;
import com.payroll.entity.LoanStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Repository
public interface LoanRepository extends JpaRepository<Loan, UUID> {
    List<Loan> findByEmployeeId(UUID employeeId);
    List<Loan> findByEmployeeIdAndStatus(UUID employeeId, LoanStatus status);
    boolean existsByEmployeeIdAndStatus(UUID employeeId, LoanStatus status);

    @Query("SELECT COALESCE(SUM(l.balance), 0) FROM Loan l WHERE l.status = 'ACTIVE'")
    BigDecimal sumActiveLoanBalances();

    long countByStatus(LoanStatus status);
}
