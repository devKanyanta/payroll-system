package com.payroll.repository;

import com.payroll.entity.PayrollEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PayrollEntryRepository extends JpaRepository<PayrollEntry, UUID> {
    List<PayrollEntry> findByPayrollRunId(UUID payrollRunId);
    Optional<PayrollEntry> findByPayrollRunIdAndEmployeeId(UUID payrollRunId, UUID employeeId);

    @Query("SELECT COALESCE(SUM(pe.grossSalary), 0) FROM PayrollEntry pe WHERE pe.payrollRun.id = :runId")
    BigDecimal sumGrossSalaryByRunId(@Param("runId") UUID runId);

    @Query("SELECT COALESCE(SUM(pe.netSalary), 0) FROM PayrollEntry pe WHERE pe.payrollRun.id = :runId")
    BigDecimal sumNetSalaryByRunId(@Param("runId") UUID runId);

    @Query("SELECT COALESCE(SUM(pe.paye), 0) FROM PayrollEntry pe WHERE pe.payrollRun.id = :runId")
    BigDecimal sumPayeByRunId(@Param("runId") UUID runId);

    @Query("SELECT COALESCE(SUM(pe.napsa), 0) FROM PayrollEntry pe WHERE pe.payrollRun.id = :runId")
    BigDecimal sumNapsaByRunId(@Param("runId") UUID runId);

    @Query("SELECT COALESCE(SUM(pe.nhima), 0) FROM PayrollEntry pe WHERE pe.payrollRun.id = :runId")
    BigDecimal sumNhimaByRunId(@Param("runId") UUID runId);

    List<PayrollEntry> findByEmployeeIdOrderByPayrollRunYearDescPayrollRunMonthDesc(UUID employeeId);
}
