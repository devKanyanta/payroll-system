package com.payroll.controller;

import com.payroll.entity.PayrollImport;
import com.payroll.service.PayrollImportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/payroll-import")
@RequiredArgsConstructor
public class PayrollImportController {

    private final PayrollImportService payrollImportService;

    @PostMapping("/upload")
    public ResponseEntity<PayrollImport> uploadFile(
            @RequestParam("file") MultipartFile file,
            @RequestParam("payrollRunId") UUID payrollRunId,
            @RequestAttribute("userId") UUID userId) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(payrollImportService.uploadFile(file, payrollRunId, userId));
    }

    @GetMapping("/by-run/{payrollRunId}")
    public ResponseEntity<List<PayrollImport>> getImportsByPayrollRun(@PathVariable UUID payrollRunId) {
        return ResponseEntity.ok(payrollImportService.getImportsByPayrollRun(payrollRunId));
    }

    @PostMapping("/{id}/process")
    public ResponseEntity<PayrollImport> processImport(
            @PathVariable UUID id,
            @RequestAttribute("userId") UUID userId) {
        return ResponseEntity.ok(payrollImportService.processImport(id, userId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<PayrollImport> getImportById(@PathVariable UUID id) {
        return ResponseEntity.ok(payrollImportService.getImportById(id));
    }
}
