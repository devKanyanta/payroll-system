package com.payroll.controller;

import com.payroll.entity.PayrollSettings;
import com.payroll.service.PayrollSettingsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/settings/payroll")
@RequiredArgsConstructor
public class PayrollSettingsController {

    private final PayrollSettingsService payrollSettingsService;

    @GetMapping("/latest")
    public ResponseEntity<PayrollSettings> getLatestSettings() {
        return ResponseEntity.ok(payrollSettingsService.getLatestSettings());
    }

    @GetMapping("/{id}")
    public ResponseEntity<PayrollSettings> getSettingsById(@PathVariable UUID id) {
        return ResponseEntity.ok(payrollSettingsService.getSettingsById(id));
    }

    @PostMapping
    public ResponseEntity<PayrollSettings> createSettings(@RequestBody PayrollSettings settings) {
        return ResponseEntity.status(HttpStatus.CREATED).body(payrollSettingsService.createSettings(settings));
    }

    @PutMapping("/{id}")
    public ResponseEntity<PayrollSettings> updateSettings(
            @PathVariable UUID id, @RequestBody PayrollSettings settings) {
        return ResponseEntity.ok(payrollSettingsService.updateSettings(id, settings));
    }
}
