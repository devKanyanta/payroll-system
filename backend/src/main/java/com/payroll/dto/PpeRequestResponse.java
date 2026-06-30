package com.payroll.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PpeRequestResponse {
    private UUID id;
    private UUID employeeId;
    private String employeeName;
    private String employeeNumber;
    private UUID requestedById;
    private String requestedByName;
    private UUID reviewedById;
    private String reviewedByName;
    private String status;
    private LocalDate dateGiven;
    private LocalDate dueDate;
    private String notes;
    private List<PpeCatalogItemResponse> items;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
