package com.payroll.service.impl;

import com.payroll.dto.PagedResponse;
import com.payroll.dto.UserRequest;
import com.payroll.dto.UserResponse;
import com.payroll.entity.Role;
import com.payroll.entity.User;
import com.payroll.exception.BusinessRuleException;
import com.payroll.exception.DuplicateResourceException;
import com.payroll.exception.ResourceNotFoundException;
import com.payroll.repository.*;
import com.payroll.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final NotificationRepository notificationRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final AuditLogRepository auditLogRepository;
    private final ExpenseRepository expenseRepository;
    private final PayrollRunRepository payrollRunRepository;
    private final PayrollImportRepository payrollImportRepository;

    @Override
    public PagedResponse<UserResponse> getAllUsers(Pageable pageable) {
        var page = userRepository.findAll(pageable);
        return PagedResponse.from(page.map(this::toResponse));
    }

    @Override
    public UserResponse getUserById(UUID id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User", id));
        return toResponse(user);
    }

    @Override
    @Transactional
    public UserResponse createUser(UserRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new DuplicateResourceException("User with email '" + request.getEmail() + "' already exists");
        }

        User user = User.builder()
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode("default123"))
                .role(Role.valueOf(request.getRole()))
                .active(request.isActive())
                .build();

        return toResponse(userRepository.save(user));
    }

    @Override
    @Transactional
    public UserResponse updateUser(UUID id, UserRequest request) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User", id));

        if (!user.getEmail().equalsIgnoreCase(request.getEmail())
                && userRepository.existsByEmail(request.getEmail())) {
            throw new DuplicateResourceException("User with email '" + request.getEmail() + "' already exists");
        }

        user.setFirstName(request.getFirstName());
        user.setLastName(request.getLastName());
        user.setEmail(request.getEmail());
        user.setRole(Role.valueOf(request.getRole()));
        user.setActive(request.isActive());

        return toResponse(userRepository.save(user));
    }

    @Override
    @Transactional
    public void deleteUser(UUID id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User", id));

        UUID userId = user.getId();

        // Check for business-critical records referencing this user
        List<String> conflicts = new ArrayList<>();
        if (payrollRunRepository.existsByCreatedById(userId)) {
            conflicts.add("payroll runs");
        }
        if (expenseRepository.existsByCreatedById(userId)) {
            conflicts.add("expenses");
        }
        if (payrollImportRepository.existsByCreatedById(userId)) {
            conflicts.add("payroll imports");
        }

        if (!conflicts.isEmpty()) {
            throw new BusinessRuleException(
                    "Cannot delete user '" + user.getEmail() + "': they have associated " +
                    String.join(", ", conflicts) +
                    ". Please reassign or remove these records before deleting the user."
            );
        }

        // Clean up ephemeral records
        notificationRepository.deleteByUserId(userId);
        refreshTokenRepository.deleteByUserId(userId);
        passwordResetTokenRepository.deleteByUserId(userId);

        // Nullify audit log references (nullable FK)
        auditLogRepository.nullifyUserId(userId);

        userRepository.delete(user);
    }

    private UserResponse toResponse(User user) {
        return UserResponse.builder()
                .id(user.getId())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .email(user.getEmail())
                .role(user.getRole().name())
                .active(user.getActive())
                .createdAt(user.getCreatedAt())
                .build();
    }
}
