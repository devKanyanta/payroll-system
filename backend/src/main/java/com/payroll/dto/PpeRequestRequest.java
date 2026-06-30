package com.payroll.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Data
public class PpeRequestRequest {
    @NotNull(message = "Employee ID is required")
    private UUID employeeId;

    @NotNull(message = "Due date is required")
    private LocalDate dueDate;

    private String notes;

    @NotEmpty(message = "At least one PPE item must be selected")
    private List<UUID> catalogItemIds;
}
