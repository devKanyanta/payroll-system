package com.payroll.repository;

import com.payroll.entity.EmployeeImport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface EmployeeImportRepository extends JpaRepository<EmployeeImport, UUID> {
    List<EmployeeImport> findByCreatedByIdOrderByCreatedAtDesc(UUID userId);
}
