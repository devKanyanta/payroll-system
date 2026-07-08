package com.payroll.repository;

import com.payroll.entity.PayrollRun;
import com.payroll.entity.PayrollRunStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PayrollRunRepository extends JpaRepository<PayrollRun, UUID> {
    Optional<PayrollRun> findByMonthAndYear(Integer month, Integer year);

    @Query("SELECT p FROM PayrollRun p WHERE " +
           "(:month IS NULL OR p.month = :month) AND " +
           "(:year IS NULL OR p.year = :year) AND " +
           "(:status IS NULL OR p.status = :status) " +
           "ORDER BY p.year DESC, p.month DESC")
    Page<PayrollRun> searchPayrollRuns(
            @Param("month") Integer month,
            @Param("year") Integer year,
            @Param("status") PayrollRunStatus status,
            Pageable pageable);

    List<PayrollRun> findByStatus(PayrollRunStatus status);

    long countByMonthAndYear(Integer month, Integer year);

    boolean existsByCreatedById(UUID createdById);
}
