package com.payroll.controller;

import com.payroll.entity.Payslip;
import com.payroll.service.PayslipService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.web.bind.annotation.RequestParam;

@RestController
@RequestMapping("/api/payslips")
@RequiredArgsConstructor
public class PayslipController {

    private final PayslipService payslipService;

    @GetMapping
    public ResponseEntity<List<Payslip>> getPayslipsByEmployee(@RequestParam UUID employeeId) {
        return ResponseEntity.ok(payslipService.getPayslipsByEmployee(employeeId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Payslip> getPayslipById(@PathVariable UUID id) {
        return ResponseEntity.ok(payslipService.getPayslipById(id));
    }

    @GetMapping("/{id}/download")
    public ResponseEntity<byte[]> downloadPayslip(@PathVariable UUID id) {
        byte[] pdf = payslipService.downloadPayslip(id);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=payslip-" + id + ".pdf")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    @PostMapping("/generate/{payrollRunId}")
    public ResponseEntity<Void> generatePayslips(@PathVariable UUID payrollRunId) {
        payslipService.generatePayslips(payrollRunId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/email")
    public ResponseEntity<Void> emailPayslip(@PathVariable UUID id) {
        payslipService.emailPayslip(id);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/download-zip/{payrollRunId}")
    public ResponseEntity<byte[]> downloadPayslipsZip(@PathVariable UUID payrollRunId) {
        byte[] zip = payslipService.downloadPayslipsZip(payrollRunId);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=payslips-" + payrollRunId + ".zip")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(zip);
    }

    @GetMapping("/download-by-month")
    public ResponseEntity<byte[]> downloadPayslipsByMonth(
            @RequestParam int month, @RequestParam int year) {
        byte[] zip = payslipService.downloadPayslipsByMonth(month, year);
        String[] monthNames = {"January","February","March","April","May","June",
                "July","August","September","October","November","December"};
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=payslips-" + monthNames[month - 1] + "-" + year + ".zip")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(zip);
    }

    @PostMapping("/email-all/{payrollRunId}")
    public ResponseEntity<Map<String, Object>> emailAllPayslipsForRun(@PathVariable UUID payrollRunId) {
        return ResponseEntity.ok(payslipService.emailAllPayslipsForRun(payrollRunId));
    }
}
