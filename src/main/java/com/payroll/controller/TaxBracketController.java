package com.payroll.controller;

import com.payroll.entity.TaxBracket;
import com.payroll.service.TaxBracketService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/settings/tax-brackets")
@RequiredArgsConstructor
public class TaxBracketController {

    private final TaxBracketService taxBracketService;

    @GetMapping
    public ResponseEntity<List<TaxBracket>> getAllBrackets() {
        return ResponseEntity.ok(taxBracketService.getAllBrackets());
    }

    @GetMapping("/active")
    public ResponseEntity<List<TaxBracket>> getActiveBrackets() {
        return ResponseEntity.ok(taxBracketService.getActiveBrackets());
    }

    @GetMapping("/{id}")
    public ResponseEntity<TaxBracket> getBracketById(@PathVariable UUID id) {
        return ResponseEntity.ok(taxBracketService.getBracketById(id));
    }

    @PostMapping
    public ResponseEntity<TaxBracket> createBracket(@Valid @RequestBody TaxBracket bracket) {
        return ResponseEntity.status(HttpStatus.CREATED).body(taxBracketService.createBracket(bracket));
    }

    @PutMapping("/{id}")
    public ResponseEntity<TaxBracket> updateBracket(@PathVariable UUID id, @Valid @RequestBody TaxBracket bracket) {
        return ResponseEntity.ok(taxBracketService.updateBracket(id, bracket));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteBracket(@PathVariable UUID id) {
        taxBracketService.deleteBracket(id);
        return ResponseEntity.noContent().build();
    }
}
