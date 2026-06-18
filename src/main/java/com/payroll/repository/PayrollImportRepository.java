package com.payroll.repository;

import com.payroll.entity.PayrollImport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface PayrollImportRepository extends JpaRepository<PayrollImport, UUID> {
    List<PayrollImport> findByPayrollRunIdOrderByCreatedAtDesc(UUID payrollRunId);
}
