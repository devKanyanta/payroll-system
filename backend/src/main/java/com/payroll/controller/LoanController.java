package com.payroll.controller;

import com.payroll.dto.LoanRequest;
import com.payroll.dto.LoanResponse;
import com.payroll.service.LoanService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/loans")
@RequiredArgsConstructor
public class LoanController {

    private final LoanService loanService;

    @GetMapping
    public ResponseEntity<List<LoanResponse>> getLoans(
            @RequestParam(required = false) UUID employeeId) {
        if (employeeId != null) {
            return ResponseEntity.ok(loanService.getLoansByEmployee(employeeId));
        }
        return ResponseEntity.ok(loanService.getAllLoans());
    }

    @GetMapping("/{id}")
    public ResponseEntity<LoanResponse> getLoanById(@PathVariable UUID id) {
        return ResponseEntity.ok(loanService.getLoanById(id));
    }

    @PostMapping
    public ResponseEntity<LoanResponse> createLoan(@Valid @RequestBody LoanRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(loanService.createLoan(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<LoanResponse> updateLoan(@PathVariable UUID id, @Valid @RequestBody LoanRequest request) {
        return ResponseEntity.ok(loanService.updateLoan(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> cancelLoan(@PathVariable UUID id) {
        loanService.cancelLoan(id);
        return ResponseEntity.noContent().build();
    }
}
