package com.payroll.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class PpeCatalogItemRequest {
    @NotBlank(message = "Item name is required")
    private String name;

    private String description;

    private String category;

    private Boolean isActive;
}
