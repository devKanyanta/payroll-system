package com.payroll.config;

import com.payroll.security.JwtAuthenticationFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthFilter;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(
                    "/api/auth/**",
                    "/api-docs/**",
                    "/swagger-ui/**",
                    "/swagger-ui.html",
                    "/actuator/health"
                ).permitAll()
                .requestMatchers("/api/users/**").hasAuthority("ROLE_ADMIN")
                .requestMatchers(HttpMethod.GET, "/api/settings/**").hasAnyAuthority("ROLE_ADMIN", "ROLE_HR", "ROLE_MANAGER")
                .requestMatchers("/api/settings/**").hasAuthority("ROLE_ADMIN")
                .requestMatchers("/api/audit-logs/**").hasAuthority("ROLE_ADMIN")
                .requestMatchers("/api/employees/**").hasAnyAuthority("ROLE_ADMIN", "ROLE_HR")
                .requestMatchers("/api/loans/**").hasAnyAuthority("ROLE_ADMIN", "ROLE_HR")
                .requestMatchers("/api/payroll-runs/**").hasAnyAuthority("ROLE_ADMIN", "ROLE_HR", "ROLE_MANAGER")
                .requestMatchers(HttpMethod.POST, "/api/payroll-import/**").hasAnyAuthority("ROLE_ADMIN", "ROLE_HR")
                .requestMatchers(HttpMethod.GET, "/api/payroll-import/**").hasAnyAuthority("ROLE_ADMIN", "ROLE_HR")
                .requestMatchers("/api/payroll-import/**").hasAnyAuthority("ROLE_ADMIN", "ROLE_HR")
                .requestMatchers("/api/payslips/**").hasAnyAuthority("ROLE_ADMIN", "ROLE_HR", "ROLE_MANAGER")
                .requestMatchers("/api/expenses/**").hasAnyAuthority("ROLE_ADMIN", "ROLE_HR")
                .requestMatchers("/api/reports/**").hasAnyAuthority("ROLE_ADMIN", "ROLE_HR", "ROLE_MANAGER")
                .requestMatchers("/api/notifications/**").authenticated()
                .requestMatchers("/api/dashboard/**").authenticated()
                .anyRequest().authenticated()
            )
            .sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
            )
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(List.of("http://localhost:3000", "http://localhost:5173", "https://payroll.mesltd.co.zm"));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config)
            throws Exception {
        return config.getAuthenticationManager();
    }
}
