package com.payroll.service;

import com.payroll.entity.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.UUID;

public interface AuditService {
    void logEvent(UUID userId, String action, String entityName, String entityId, String oldValue, String newValue, String ipAddress);
    Page<AuditLog> searchAuditLogs(UUID userId, String entityName, String action, LocalDateTime startDate, LocalDateTime endDate, Pageable pageable);
}
