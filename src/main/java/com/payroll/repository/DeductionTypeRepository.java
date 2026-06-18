package com.payroll.repository;

import com.payroll.entity.DeductionType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface DeductionTypeRepository extends JpaRepository<DeductionType, UUID> {
    List<DeductionType> findByIsActiveTrue();
    boolean existsByName(String name);
}
