package com.payroll.repository;

import com.payroll.entity.PpeRequest;
import com.payroll.entity.PpeRequestStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
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

    /**
     * Find requests in a given status whose due date has already arrived (on or before the given date).
     * PESSIMISTIC_WRITE serializes concurrent runs (e.g. scheduler + API read) so the same request
     * is only flipped/notified once; the entity graph avoids lazy N+1 loading in the notification loop.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {"employee", "requestItems", "requestItems.catalogItem"})
    List<PpeRequest> findByStatusAndDueDateLessThanEqual(PpeRequestStatus status, LocalDate dueDate);
}
