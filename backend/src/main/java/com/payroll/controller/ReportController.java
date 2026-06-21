package com.payroll.controller;

import com.payroll.entity.PayrollEntry;
import com.payroll.service.ReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;

    @GetMapping("/payroll-summary")
    public ResponseEntity<Map<String, Object>> getPayrollSummary(
            @RequestParam int month,
            @RequestParam int year,
            @RequestParam(required = false) UUID departmentId) {
        return ResponseEntity.ok(reportService.getPayrollSummary(month, year, departmentId));
    }

    @GetMapping("/employee-history/{employeeId}")
    public ResponseEntity<List<PayrollEntry>> getEmployeePayrollHistory(@PathVariable UUID employeeId) {
        return ResponseEntity.ok(reportService.getEmployeePayrollHistory(employeeId));
    }

    @GetMapping("/expenses")
    public ResponseEntity<Map<String, Object>> getExpenseReport(
            @RequestParam int month,
            @RequestParam int year) {
        return ResponseEntity.ok(reportService.getExpenseReport(month, year));
    }

    @GetMapping("/export/excel")
    public ResponseEntity<byte[]> exportToExcel(@RequestParam int month, @RequestParam int year) {
        byte[] data = reportService.exportToExcel(month, year);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=payroll-report.xlsx")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(data);
    }

    @GetMapping("/export/pdf")
    public ResponseEntity<byte[]> exportToPdf(@RequestParam int month, @RequestParam int year) {
        byte[] data = reportService.exportToPdf(month, year);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=payroll-report.pdf")
                .contentType(MediaType.APPLICATION_PDF)
                .body(data);
    }
}
