package com.payroll.repository;

import com.payroll.entity.Payslip;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface PayslipRepository extends JpaRepository<Payslip, UUID> {
    List<Payslip> findByPayrollEntryId(UUID payrollEntryId);
    List<Payslip> findByPayrollEntryEmployeeIdOrderByCreatedAtDesc(UUID employeeId);
}
