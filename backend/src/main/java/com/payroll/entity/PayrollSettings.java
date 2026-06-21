package com.payroll.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "payroll_settings")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PayrollSettings {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "effective_date", nullable = false)
    private LocalDate effectiveDate;

    @Column(name = "nhima_employee_percent", nullable = false, precision = 5, scale = 2)
    private BigDecimal nhimaEmployeePercent;

    @Column(name = "nhima_employer_percent", nullable = false, precision = 5, scale = 2)
    private BigDecimal nhimaEmployerPercent;

    @Column(name = "napsa_employee_percent", nullable = false, precision = 5, scale = 2)
    private BigDecimal napsaEmployeePercent;

    @Column(name = "napsa_employer_percent", nullable = false, precision = 5, scale = 2)
    private BigDecimal napsaEmployerPercent;

    @Column(name = "overtime_rate", nullable = false, precision = 4, scale = 2)
    @Builder.Default
    private BigDecimal overtimeRate = new BigDecimal("1.50");

    @Column(name = "holiday_rate", nullable = false, precision = 4, scale = 2)
    @Builder.Default
    private BigDecimal holidayRate = new BigDecimal("2.00");

    @Column(name = "working_days_per_month", nullable = false)
    @Builder.Default
    private Integer workingDaysPerMonth = 22;

    @Column(name = "hours_per_day", nullable = false)
    @Builder.Default
    private Integer hoursPerDay = 8;

    @Column(name = "napsa_max_earnings", precision = 12, scale = 2)
    private BigDecimal napsaMaxEarnings;

    @Column(name = "soft_loan_interest_rate", nullable = false, precision = 5, scale = 3)
    @Builder.Default
    private BigDecimal softLoanInterestRate = new BigDecimal("0.300");

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
