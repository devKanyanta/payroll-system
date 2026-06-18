package com.payroll.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "payslips")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Payslip {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "payroll_entry_id", nullable = false)
    private PayrollEntry payrollEntry;

    @Column(name = "pdf_path", length = 500)
    private String pdfPath;

    @Column(name = "generated_at")
    private LocalDateTime generatedAt;

    @Column(name = "emailed_at")
    private LocalDateTime emailedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
