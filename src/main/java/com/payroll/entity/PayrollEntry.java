package com.payroll.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "payroll_entries")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PayrollEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "payroll_run_id", nullable = false)
    private PayrollRun payrollRun;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", nullable = false)
    private Employee employee;

    @Column(name = "basic_salary", nullable = false, precision = 12, scale = 2)
    private BigDecimal basicSalary;

    @Column(name = "hourly_rate", precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal hourlyRate = BigDecimal.ZERO;

    @Column(name = "present_days", precision = 8, scale = 2)
    @Builder.Default
    private BigDecimal presentDays = BigDecimal.ZERO;

    @Column(name = "regular_hours", precision = 8, scale = 2)
    @Builder.Default
    private BigDecimal regularHours = BigDecimal.ZERO;

    @Column(name = "regular_amount", precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal regularAmount = BigDecimal.ZERO;

    @Column(name = "loan_balance", precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal loanBalance = BigDecimal.ZERO;

    @Column(length = 200)
    private String site;

    @Column(name = "overtime_hours", precision = 8, scale = 2)
    @Builder.Default
    private BigDecimal overtimeHours = BigDecimal.ZERO;

    @Column(name = "overtime_amount", precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal overtimeAmount = BigDecimal.ZERO;

    @Column(name = "holiday_hours", precision = 8, scale = 2)
    @Builder.Default
    private BigDecimal holidayHours = BigDecimal.ZERO;

    @Column(name = "holiday_amount", precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal holidayAmount = BigDecimal.ZERO;

    @Column(name = "gross_salary", nullable = false, precision = 12, scale = 2)
    private BigDecimal grossSalary;

    @Column(nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal nhima = BigDecimal.ZERO;

    @Column(nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal napsa = BigDecimal.ZERO;

    @Column(nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal paye = BigDecimal.ZERO;

    @Column(name = "loan_deduction", precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal loanDeduction = BigDecimal.ZERO;

    @Column(name = "other_deductions", precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal otherDeductions = BigDecimal.ZERO;

    @Column(name = "net_salary", nullable = false, precision = 12, scale = 2)
    private BigDecimal netSalary;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
