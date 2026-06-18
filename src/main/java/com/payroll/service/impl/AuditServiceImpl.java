package com.payroll.service.impl;

import com.payroll.entity.AuditLog;
import com.payroll.entity.User;
import com.payroll.repository.AuditLogRepository;
import com.payroll.repository.UserRepository;
import com.payroll.service.AuditService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuditServiceImpl implements AuditService {

    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;

    @Override
    @Transactional
    public void logEvent(UUID userId, String action, String entityName, String entityId, String oldValue, String newValue, String ipAddress) {
        User user = userId != null ? userRepository.findById(userId).orElse(null) : null;

        AuditLog auditLog = AuditLog.builder()
                .user(user)
                .action(action)
                .entityName(entityName)
                .entityId(entityId)
                .oldValue(oldValue)
                .newValue(newValue)
                .ipAddress(ipAddress)
                .build();

        auditLogRepository.save(auditLog);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AuditLog> searchAuditLogs(UUID userId, String entityName, String action, LocalDateTime startDate, LocalDateTime endDate, Pageable pageable) {
        return auditLogRepository.searchAuditLogs(userId, entityName, action, startDate, endDate, pageable);
    }
}
