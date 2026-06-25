package com.payroll.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.util.Date;
import java.util.UUID;

@Component
public class JwtUtils {

    private final SecretKey secretKey;
    private final long accessTokenExpiration;
    private final long refreshTokenExpiration;

    public JwtUtils(
            @Value("${app.jwt.secret}") String secret,
            @Value("${app.jwt.access-token-expiration}") long accessTokenExpiration,
            @Value("${app.jwt.refresh-token-expiration}") long refreshTokenExpiration) {
        this.secretKey = Keys.hmacShaKeyFor(Decoders.BASE64.decode(secret));
        this.accessTokenExpiration = accessTokenExpiration;
        this.refreshTokenExpiration = refreshTokenExpiration;
    }

    public String generateAccessToken(UUID userId, String email, String role) {
        return generateAccessToken(userId, email, role, accessTokenExpiration);
    }

    public String generateAccessToken(UUID userId, String email, String role, long customExpirationMs) {
        return Jwts.builder()
                .subject(userId.toString())
                .claim("email", email)
                .claim("role", role)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + customExpirationMs))
                .signWith(secretKey)
                .compact();
    }

    public String generateRefreshToken(UUID userId) {
        return generateRefreshToken(userId, refreshTokenExpiration, false);
    }

    public String generateRefreshToken(UUID userId, long customExpirationMs) {
        return generateRefreshToken(userId, customExpirationMs, false);
    }

    public String generateRefreshToken(UUID userId, long customExpirationMs, boolean rememberMe) {
        return Jwts.builder()
                .subject(userId.toString())
                .claim("rememberMe", rememberMe)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + customExpirationMs))
                .signWith(secretKey)
                .compact();
    }

    public boolean isRememberMeToken(String token) {
        try {
            Claims claims = parseToken(token);
            Boolean rememberMe = claims.get("rememberMe", Boolean.class);
            return rememberMe != null && rememberMe;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    public UUID getUserIdFromToken(String token) {
        Claims claims = parseToken(token);
        return UUID.fromString(claims.getSubject());
    }

    public String getEmailFromToken(String token) {
        Claims claims = parseToken(token);
        return claims.get("email", String.class);
    }

    public String getRoleFromToken(String token) {
        Claims claims = parseToken(token);
        return claims.get("role", String.class);
    }

    public boolean validateToken(String token) {
        try {
            parseToken(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    private Claims parseToken(String token) {
        return Jwts.parser()
                .verifyWith(secretKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public long getAccessTokenExpirationMs() {
        return accessTokenExpiration;
    }

    public long getRefreshTokenExpirationMs() {
        return refreshTokenExpiration;
    }
}
