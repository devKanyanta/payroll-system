package com.payroll.controller;

import com.payroll.dto.CashflowRevenueRequest;
import com.payroll.dto.CashflowSummaryResponse;
import com.payroll.entity.CashflowRevenue;
import com.payroll.service.CashflowService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/cashflow")
@RequiredArgsConstructor
public class CashflowController {

    private final CashflowService cashflowService;

    @GetMapping
    public ResponseEntity<List<CashflowRevenue>> getCashflowRevenues(
            @RequestParam(required = false) Integer month,
            @RequestParam(required = false) Integer year) {
        if (month == null) month = LocalDate.now().getMonthValue();
        if (year == null) year = LocalDate.now().getYear();
        return ResponseEntity.ok(cashflowService.getRevenuesByMonth(month, year));
    }

    @GetMapping("/summary")
    public ResponseEntity<CashflowSummaryResponse> getCashflowSummary(
            @RequestParam(required = false) Integer month,
            @RequestParam(required = false) Integer year) {
        if (month == null) month = LocalDate.now().getMonthValue();
        if (year == null) year = LocalDate.now().getYear();
        return ResponseEntity.ok(cashflowService.getCashflowSummary(month, year));
    }

    @GetMapping("/{id}")
    public ResponseEntity<CashflowRevenue> getCashflowRevenueById(@PathVariable UUID id) {
        return ResponseEntity.ok(cashflowService.getRevenueById(id));
    }

    @PostMapping("/recalculate")
    public ResponseEntity<List<CashflowRevenue>> recalculateCashflowTotals(
            @RequestParam(required = false) Integer month,
            @RequestParam(required = false) Integer year) {
        if (month == null) month = LocalDate.now().getMonthValue();
        if (year == null) year = LocalDate.now().getYear();
        return ResponseEntity.ok(cashflowService.recalculateTotals(month, year));
    }

    @GetMapping("/years")
    public ResponseEntity<List<Integer>> getAvailableYears() {
        return ResponseEntity.ok(cashflowService.getAvailableYears());
    }

    @PostMapping
    public ResponseEntity<CashflowRevenue> createCashflowRevenue(
            @Valid @RequestBody CashflowRevenueRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(cashflowService.createRevenue(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<CashflowRevenue> updateCashflowRevenue(
            @PathVariable UUID id,
            @Valid @RequestBody CashflowRevenueRequest request) {
        return ResponseEntity.ok(cashflowService.updateRevenue(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCashflowRevenue(@PathVariable UUID id) {
        cashflowService.deleteRevenue(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/batch")
    public ResponseEntity<List<CashflowRevenue>> batchUpdateCashflowRevenues(
            @RequestBody List<@Valid CashflowRevenueRequest> requests) {
        // Delete existing entries for this month/year and recreate
        if (!requests.isEmpty()) {
            int month = requests.get(0).getMonth();
            int year = requests.get(0).getYear();
            List<CashflowRevenue> existing = cashflowService.getRevenuesByMonth(month, year);
            for (CashflowRevenue rev : existing) {
                if (rev.getId() != null) {
                    cashflowService.deleteRevenue(rev.getId());
                }
            }
        }

        List<CashflowRevenue> created = requests.stream()
                .map(cashflowService::createRevenue)
                .toList();
        return ResponseEntity.ok(created);
    }
}
