package com.payroll.repository;

import com.payroll.entity.PpeRequest;
import com.payroll.entity.PpeRequestStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface PpeRequestRepository extends JpaRepository<PpeRequest, UUID> {
    List<PpeRequest> findByEmployeeIdOrderByCreatedAtDesc(UUID employeeId);
    List<PpeRequest> findByStatusOrderByCreatedAtDesc(PpeRequestStatus status);
    List<PpeRequest> findAllByOrderByCreatedAtDesc();
    long countByEmployeeIdAndStatus(UUID employeeId, PpeRequestStatus status);
    long countByStatus(PpeRequestStatus status);
    boolean existsByEmployeeIdAndStatus(UUID employeeId, PpeRequestStatus status);
}
