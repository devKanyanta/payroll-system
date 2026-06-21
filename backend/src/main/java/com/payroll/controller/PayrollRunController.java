package com.payroll.controller;

import com.payroll.dto.PagedResponse;
import com.payroll.entity.EmployeeDeduction;
import com.payroll.entity.PayrollEntry;
import com.payroll.entity.PayrollRun;
import com.payroll.entity.PayrollRunStatus;
import com.payroll.service.PayrollRunService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/payroll-runs")
@RequiredArgsConstructor
public class PayrollRunController {

    private final PayrollRunService payrollRunService;

    @GetMapping
    public ResponseEntity<PagedResponse<PayrollRun>> getAllPayrollRuns(
            @RequestParam(required = false) Integer month,
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) PayrollRunStatus status,
            Pageable pageable) {
        return ResponseEntity.ok(payrollRunService.getAllPayrollRuns(month, year, status, pageable));
    }

    @GetMapping("/{id}")
    public ResponseEntity<PayrollRun> getPayrollRunById(@PathVariable UUID id) {
        return ResponseEntity.ok(payrollRunService.getPayrollRunById(id));
    }

    @PostMapping
    public ResponseEntity<PayrollRun> createPayrollRun(
            @RequestBody Map<String, Integer> request,
            @RequestAttribute("userId") UUID userId) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(payrollRunService.createPayrollRun(request.get("month"), request.get("year"), userId));
    }

    @PutMapping("/{id}/submit")
    public ResponseEntity<PayrollRun> submitPayrollRun(
            @PathVariable UUID id, @RequestAttribute("userId") UUID userId) {
        return ResponseEntity.ok(payrollRunService.submitPayrollRun(id, userId));
    }

    // New: Validate before submit
    @PostMapping("/{id}/validate")
    public ResponseEntity<List<Map<String, String>>> validatePayrollRun(@PathVariable UUID id) {
        return ResponseEntity.ok(payrollRunService.validateBeforeSubmit(id));
    }

    @PutMapping("/{id}/approve")
    public ResponseEntity<PayrollRun> approvePayrollRun(
            @PathVariable UUID id, @RequestAttribute("userId") UUID userId) {
        return ResponseEntity.ok(payrollRunService.approvePayrollRun(id, userId));
    }

    @PutMapping("/{id}/reject")
    public ResponseEntity<PayrollRun> rejectPayrollRun(
            @PathVariable UUID id, @RequestBody Map<String, String> request,
            @RequestAttribute("userId") UUID userId) {
        return ResponseEntity.ok(payrollRunService.rejectPayrollRun(id, userId, request.get("reason")));
    }

    @PutMapping("/{id}/reopen")
    public ResponseEntity<PayrollRun> reopenPayrollRun(
            @PathVariable UUID id, @RequestAttribute("userId") UUID userId) {
        return ResponseEntity.ok(payrollRunService.reopenPayrollRun(id, userId));
    }

    @PostMapping("/{id}/add-employees")
    public ResponseEntity<List<PayrollEntry>> addEmployeesToPayrollRun(
            @PathVariable UUID id,
            @RequestBody Map<String, List<UUID>> request,
            @RequestAttribute("userId") UUID userId) {
        return ResponseEntity.ok(payrollRunService.addEmployeesToPayrollRun(id, request.get("employeeIds"), userId));
    }

    @DeleteMapping("/{id}/entries/{entryId}")
    public ResponseEntity<Void> removeEmployeeFromPayrollRun(
            @PathVariable UUID id,
            @PathVariable UUID entryId,
            @RequestAttribute("userId") UUID userId) {
        payrollRunService.removeEmployeeFromPayrollRun(id, entryId, userId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/entries/{entryId}")
    public ResponseEntity<PayrollEntry> updatePayrollEntry(
            @PathVariable UUID id,
            @PathVariable UUID entryId,
            @RequestBody Map<String, Object> request) {
        BigDecimal presentDays = request.containsKey("presentDays") && request.get("presentDays") != null
                ? BigDecimal.valueOf(((Number) request.get("presentDays")).doubleValue()) : null;
        BigDecimal overtimeHours = request.containsKey("overtimeHours") && request.get("overtimeHours") != null
                ? BigDecimal.valueOf(((Number) request.get("overtimeHours")).doubleValue()) : null;
        BigDecimal holidayHours = request.containsKey("holidayHours") && request.get("holidayHours") != null
                ? BigDecimal.valueOf(((Number) request.get("holidayHours")).doubleValue()) : null;
        return ResponseEntity.ok(payrollRunService.updatePayrollEntry(id, entryId, presentDays, overtimeHours, holidayHours));
    }

    // New: Add deduction to an entry
    @PostMapping("/{id}/entries/{entryId}/deductions")
    public ResponseEntity<EmployeeDeduction> addDeductionToEntry(
            @PathVariable UUID id,
            @PathVariable UUID entryId,
            @RequestBody Map<String, Object> request) {
        UUID deductionTypeId = UUID.fromString((String) request.get("deductionTypeId"));
        BigDecimal amount = BigDecimal.valueOf(((Number) request.get("amount")).doubleValue());
        return ResponseEntity.ok(payrollRunService.addDeductionToEntry(id, entryId, deductionTypeId, amount));
    }

    // New: Remove deduction from entry
    @DeleteMapping("/{id}/entries/{entryId}/deductions/{deductionId}")
    public ResponseEntity<Void> removeDeductionFromEntry(
            @PathVariable UUID id,
            @PathVariable UUID entryId,
            @PathVariable UUID deductionId) {
        payrollRunService.removeDeductionFromEntry(id, entryId, deductionId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/recalculate-deductions")
    public ResponseEntity<Void> recalculateLoanDeductions(@PathVariable UUID id) {
        payrollRunService.recalculateLoanDeductions(id);
        return ResponseEntity.ok().build();
    }

    // New: Bulk email all payslips
    @PostMapping("/{id}/email-payslips")
    public ResponseEntity<Map<String, Object>> emailAllPayslips(@PathVariable UUID id) {
        return ResponseEntity.ok(payrollRunService.emailAllPayslips(id));
    }

    @GetMapping("/{id}/export/excel")
    public ResponseEntity<byte[]> exportPayrollRunToExcel(@PathVariable UUID id) {
        byte[] data = payrollRunService.exportPayrollRunToExcel(id);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=payroll-run-" + id + ".xlsx")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(data);
    }
}
