package com.payroll.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.Data;
import java.math.BigDecimal;

@Data
public class CashflowRevenueRequest {

    @NotBlank(message = "Site is required")
    private String site;

    @NotNull(message = "Sub total is required")
    @PositiveOrZero(message = "Sub total must be zero or positive")
    private BigDecimal subTotal;

    @NotNull(message = "VAT rate is required")
    @PositiveOrZero(message = "VAT rate must be zero or positive")
    private BigDecimal vatRate = new BigDecimal("16.00");

    @NotNull(message = "Month is required")
    private Integer month;

    @NotNull(message = "Year is required")
    private Integer year;
}


