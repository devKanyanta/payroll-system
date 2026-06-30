package com.payroll.controller;

import com.payroll.entity.Expense;
import com.payroll.entity.ExpenseStatus;
import com.payroll.service.ExpenseService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/expenses")
@RequiredArgsConstructor
public class ExpenseController {

    private final ExpenseService expenseService;

    @GetMapping
    public ResponseEntity<Page<Expense>> getAllExpenses(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate start,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate end,
            @RequestParam(required = false) ExpenseStatus status,
            @RequestAttribute("userId") UUID userId,
            Pageable pageable) {
        boolean isAdmin = hasRole("ROLE_ADMIN");
        return ResponseEntity.ok(expenseService.getAllExpenses(start, end, status, userId, isAdmin, pageable));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Expense> getExpenseById(@PathVariable UUID id) {
        return ResponseEntity.ok(expenseService.getExpenseById(id));
    }

    @PostMapping
    public ResponseEntity<Expense> createExpense(
            @Valid @RequestBody Expense expense,
            @RequestAttribute("userId") UUID userId) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(expenseService.createExpense(expense, userId));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Expense> updateExpense(
            @PathVariable UUID id,
            @Valid @RequestBody Expense expense,
            @RequestAttribute("userId") UUID userId) {
        return ResponseEntity.ok(expenseService.updateExpense(id, expense, userId));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteExpense(
            @PathVariable UUID id,
            @RequestAttribute("userId") UUID userId) {
        expenseService.deleteExpense(id, userId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/approve")
    public ResponseEntity<Expense> approveExpense(
            @PathVariable UUID id,
            @RequestAttribute("userId") UUID userId) {
        return ResponseEntity.ok(expenseService.approveExpense(id, userId));
    }

    @PutMapping("/{id}/reject")
    public ResponseEntity<Expense> rejectExpense(
            @PathVariable UUID id,
            @RequestBody Map<String, String> request,
            @RequestAttribute("userId") UUID userId) {
        return ResponseEntity.ok(expenseService.rejectExpense(id, userId, request.get("reason")));
    }

    @GetMapping("/export/approved-excel")
    public ResponseEntity<byte[]> exportApprovedExpensesToExcel() {
        byte[] data = expenseService.exportApprovedExpensesToExcel();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=approved-expenses.xlsx")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(data);
    }

    private boolean hasRole(String role) {
        return SecurityContextHolder.getContext().getAuthentication().getAuthorities()
                .stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(a -> a.equals(role));
    }
}
