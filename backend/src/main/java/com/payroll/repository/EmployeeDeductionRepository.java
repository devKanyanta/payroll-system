package com.payroll.repository;

import com.payroll.entity.EmployeeDeduction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface EmployeeDeductionRepository extends JpaRepository<EmployeeDeduction, UUID> {
    List<EmployeeDeduction> findByPayrollEntryId(UUID payrollEntryId);
}
