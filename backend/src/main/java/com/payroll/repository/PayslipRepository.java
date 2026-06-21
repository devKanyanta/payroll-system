package com.payroll.repository;

import com.payroll.entity.Payslip;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface PayslipRepository extends JpaRepository<Payslip, UUID> {
    List<Payslip> findByPayrollEntryId(UUID payrollEntryId);
    List<Payslip> findByPayrollEntryEmployeeIdOrderByCreatedAtDesc(UUID employeeId);

    @Query("SELECT p FROM Payslip p WHERE p.payrollEntry.payrollRun.id = :payrollRunId")
    List<Payslip> findByPayrollRunId(@Param("payrollRunId") UUID payrollRunId);
}
