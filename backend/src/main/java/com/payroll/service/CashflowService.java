package com.payroll.service;

import com.payroll.dto.CashflowRevenueRequest;
import com.payroll.dto.CashflowSummaryResponse;
import com.payroll.entity.CashflowRevenue;

import java.util.List;
import java.util.UUID;

public interface CashflowService {
    List<CashflowRevenue> getRevenuesByMonth(int month, int year);
    CashflowRevenue getRevenueById(UUID id);
    CashflowRevenue createRevenue(CashflowRevenueRequest request);
    CashflowRevenue updateRevenue(UUID id, CashflowRevenueRequest request);
    void deleteRevenue(UUID id);
    List<CashflowRevenue> recalculateTotals(int month, int year);
    CashflowSummaryResponse getCashflowSummary(int month, int year);
    List<Integer> getAvailableYears();
}
