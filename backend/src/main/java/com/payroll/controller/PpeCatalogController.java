package com.payroll.controller;

import com.payroll.dto.PpeCatalogItemRequest;
import com.payroll.dto.PpeCatalogItemResponse;
import com.payroll.service.PpeCatalogService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/ppe-catalog")
@RequiredArgsConstructor
public class PpeCatalogController {

    private final PpeCatalogService ppeCatalogService;

    @GetMapping
    public ResponseEntity<List<PpeCatalogItemResponse>> getAllItems(
            @RequestParam(required = false, defaultValue = "false") boolean includeInactive) {
        if (includeInactive) {
            return ResponseEntity.ok(ppeCatalogService.getAllItems());
        }
        return ResponseEntity.ok(ppeCatalogService.getAllActiveItems());
    }

    @GetMapping("/{id}")
    public ResponseEntity<PpeCatalogItemResponse> getItemById(@PathVariable UUID id) {
        return ResponseEntity.ok(ppeCatalogService.getItemById(id));
    }

    @PostMapping
    public ResponseEntity<PpeCatalogItemResponse> createItem(
            @Valid @RequestBody PpeCatalogItemRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ppeCatalogService.createItem(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<PpeCatalogItemResponse> updateItem(
            @PathVariable UUID id,
            @Valid @RequestBody PpeCatalogItemRequest request) {
        return ResponseEntity.ok(ppeCatalogService.updateItem(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deactivateItem(@PathVariable UUID id) {
        ppeCatalogService.deactivateItem(id);
        return ResponseEntity.noContent().build();
    }
}
