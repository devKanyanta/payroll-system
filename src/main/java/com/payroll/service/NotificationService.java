package com.payroll.service;

import com.payroll.dto.PagedResponse;
import com.payroll.entity.Notification;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.UUID;

public interface NotificationService {
    List<Notification> getUnreadNotifications(UUID userId);
    PagedResponse<Notification> getAllNotifications(UUID userId, Pageable pageable);
    long getUnreadCount(UUID userId);
    void markAsRead(UUID notificationId);
    void markAllAsRead(UUID userId);
    void createNotification(UUID userId, String title, String message, String type, String link);
}
