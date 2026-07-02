package com.payroll.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CashflowSummaryResponse {

    private int month;
    private int year;
    private List<SiteRevenue> sites;
    private BigDecimal totalSubMonthlyAccumulated;
    private BigDecimal employeeGrossPay;
    private BigDecimal companyProfit;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SiteRevenue {
        private String site;
        private BigDecimal subTotal;
        private BigDecimal vatRate;
        private BigDecimal vatAmount;
        private BigDecimal total;
    }
}
