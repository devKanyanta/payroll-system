package com.payroll.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Data
public class EmployeeRequest {
    private String employeeNumber;
    @NotBlank(message = "First name is required")
    private String firstName;
    @NotBlank(message = "Last name is required")
    private String lastName;
    @NotBlank(message = "Email is required")
    private String email;
    private String phone;
    @NotBlank(message = "NRC is required")
    private String nrc;
    private UUID departmentId;
    private String position;
    @NotBlank(message = "Employment type is required")
    private String employmentType;
    @NotBlank(message = "Salary type is required")
    private String salaryType;
    private String bankName;
    private String accountNumber;
    @NotNull(message = "Date hired is required")
    private LocalDate dateHired;
    @NotNull(message = "Basic salary is required")
    private BigDecimal basicSalary;
    private String status;
    private String site;
}
