package com.payroll.service.impl;

import com.payroll.dto.*;
import com.payroll.entity.*;
import com.payroll.exception.*;
import com.payroll.repository.*;
import com.payroll.security.CustomUserDetails;
import com.payroll.security.JwtUtils;
import com.payroll.service.AuditService;
import com.payroll.service.AuthService;
import com.payroll.service.EmailService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.*;
import org.springframework.security.core.Authentication;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private final AuthenticationManager authenticationManager;
    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final AuditService auditService;
    private final JwtUtils jwtUtils;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;

    @Value("${app.base-url}")
    private String baseUrl;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    private static final int MAX_FAILED_ATTEMPTS = 5;
    private static final int LOCKOUT_DURATION_MINUTES = 30;
    private static final long REMEMBER_ME_ACCESS_EXPIRATION = 24 * 60 * 60 * 1000L; // 24 hours
    private static final long REMEMBER_ME_REFRESH_EXPIRATION = 30 * 24 * 60 * 60 * 1000L; // 30 days

    // Rate limiting: max 1 forgot-password request per email every 5 minutes
    private static final long RESET_COOLDOWN_MINUTES = 5;
    private final Map<String, LocalDateTime> lastResetRequest = new ConcurrentHashMap<>();

    @Override
    @Transactional
    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new BadCredentialsException("Invalid email or password"));

        if (user.getAccountLockedUntil() != null && user.getAccountLockedUntil().isAfter(LocalDateTime.now())) {
            throw new LockedException("Account is locked. Try again later.");
        }

        try {
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword()));
            CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();

            user.setFailedLoginAttempts(0);
            user.setAccountLockedUntil(null);
            userRepository.save(user);

            long accessTokenExpMs = request.isRememberMe()
                    ? REMEMBER_ME_ACCESS_EXPIRATION
                    : jwtUtils.getAccessTokenExpirationMs();
            long refreshTokenExpMs = request.isRememberMe()
                    ? REMEMBER_ME_REFRESH_EXPIRATION
                    : jwtUtils.getRefreshTokenExpirationMs();
            long refreshTokenDays = request.isRememberMe() ? 30 : 7;            String accessToken = jwtUtils.generateAccessToken(
                    user.getId(), user.getEmail(), user.getRole().name(), accessTokenExpMs);
            String refreshToken = jwtUtils.generateRefreshToken(
                    user.getId(), refreshTokenExpMs, request.isRememberMe());

            RefreshToken tokenEntity = RefreshToken.builder()
                    .user(user)
                    .token(refreshToken)
                    .expiresAt(LocalDateTime.now().plusDays(refreshTokenDays))
                    .build();
            refreshTokenRepository.save(tokenEntity);

            return AuthResponse.builder()
                    .id(user.getId())
                    .accessToken(accessToken)
                    .refreshToken(refreshToken)
                    .email(user.getEmail())
                    .role(user.getRole().name())
                    .firstName(user.getFirstName())
                    .lastName(user.getLastName())
                    .build();

        } catch (BadCredentialsException e) {
            user.setFailedLoginAttempts(user.getFailedLoginAttempts() + 1);
            if (user.getFailedLoginAttempts() >= MAX_FAILED_ATTEMPTS) {
                user.setAccountLockedUntil(LocalDateTime.now().plusMinutes(LOCKOUT_DURATION_MINUTES));
            }
            userRepository.save(user);
            throw new BadCredentialsException("Invalid email or password");
        }
    }

    @Override
    @Transactional
    public AuthResponse refreshToken(RefreshTokenRequest request) {
        RefreshToken tokenEntity = refreshTokenRepository.findByToken(request.getRefreshToken())
                .orElseThrow(() -> new BadRequestException("Invalid refresh token"));

        if (tokenEntity.getRevoked() || tokenEntity.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new BadRequestException("Refresh token is expired or revoked");
        }

        tokenEntity.setRevoked(true);
        refreshTokenRepository.save(tokenEntity);

        // Check if the original token had rememberMe enabled
        boolean wasRememberMe = jwtUtils.isRememberMeToken(request.getRefreshToken());

        User user = tokenEntity.getUser();
        long accessTokenExpMs = wasRememberMe
                ? REMEMBER_ME_ACCESS_EXPIRATION
                : jwtUtils.getAccessTokenExpirationMs();
        long refreshTokenExpMs = wasRememberMe
                ? REMEMBER_ME_REFRESH_EXPIRATION
                : jwtUtils.getRefreshTokenExpirationMs();
        long refreshTokenDays = wasRememberMe ? 30 : 7;

        String newAccessToken = jwtUtils.generateAccessToken(
                user.getId(), user.getEmail(), user.getRole().name(), accessTokenExpMs);
        String newRefreshToken = jwtUtils.generateRefreshToken(
                user.getId(), refreshTokenExpMs, wasRememberMe);

        RefreshToken newTokenEntity = RefreshToken.builder()
                .user(user)
                .token(newRefreshToken)
                .expiresAt(LocalDateTime.now().plusDays(refreshTokenDays))
                .build();
        refreshTokenRepository.save(newTokenEntity);

        return AuthResponse.builder()
                .accessToken(newAccessToken)
                .refreshToken(newRefreshToken)
                .email(user.getEmail())
                .role(user.getRole().name())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .build();
    }

    @Override
    @Transactional
    public void logout(String refreshToken) {
        refreshTokenRepository.findByToken(refreshToken)
                .ifPresent(token -> {
                    token.setRevoked(true);
                    refreshTokenRepository.save(token);
                });
    }

    @Override
    @Transactional
    public void forgotPassword(ForgotPasswordRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", request.getEmail()));

        // Rate limit: check if a reset was requested within the last 5 minutes
        String email = user.getEmail();
        LocalDateTime lastRequested = lastResetRequest.get(email);
        if (lastRequested != null && lastRequested.isAfter(LocalDateTime.now().minusMinutes(RESET_COOLDOWN_MINUTES))) {
            // Silently return to avoid revealing rate limit info to potential attackers
            return;
        }

        String token = UUID.randomUUID().toString();
        PasswordResetToken resetToken = PasswordResetToken.builder()
                .user(user)
                .token(token)
                .expiresAt(LocalDateTime.now().plusHours(1))
                .build();
        passwordResetTokenRepository.save(resetToken);

        String resetLink = frontendUrl + "/reset-password?token=" + token;
        emailService.sendPasswordResetEmail(email, resetLink);

        lastResetRequest.put(email, LocalDateTime.now());
    }

    @Override
    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        PasswordResetToken resetToken = passwordResetTokenRepository.findByToken(request.getToken())
                .orElseThrow(() -> new BadRequestException("Invalid reset token"));

        if (resetToken.getUsed() || resetToken.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new BadRequestException("Reset token is expired or already used");
        }

        User user = resetToken.getUser();
        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);

        resetToken.setUsed(true);
        passwordResetTokenRepository.save(resetToken);
    }

    @Override
    @Transactional
    public void changePassword(ChangePasswordRequest request, String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", userEmail));

        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPasswordHash())) {
            throw new BadRequestException("Current password is incorrect");
        }

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
    }
}
