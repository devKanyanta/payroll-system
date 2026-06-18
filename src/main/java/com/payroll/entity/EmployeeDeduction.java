package com.payroll.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "employee_deductions")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EmployeeDeduction {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "payroll_entry_id", nullable = false)
    private PayrollEntry payrollEntry;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "deduction_type_id", nullable = false)
    private DeductionType deductionType;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
