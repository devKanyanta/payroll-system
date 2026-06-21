package com.payroll.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmployeeResponse {
    private UUID id;
    private String employeeNumber;
    private String firstName;
    private String lastName;
    private String email;
    private String phone;
    private String nrc;
    private UUID departmentId;
    private String departmentName;
    private String position;
    private String site;
    private String employmentType;
    private String salaryType;
    private String bankName;
    private String accountNumber;
    private LocalDate dateHired;
    private BigDecimal rate;
    private String status;
    private LocalDateTime createdAt;
}
