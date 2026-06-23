package com.payroll.repository;

import com.payroll.entity.Department;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface DepartmentRepository extends JpaRepository<Department, UUID> {
    boolean existsByName(String name);
    Optional<Department> findByName(String name);
}
