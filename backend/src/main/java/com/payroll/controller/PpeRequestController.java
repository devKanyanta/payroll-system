package com.payroll.controller;

import com.payroll.dto.PpeRequestRequest;
import com.payroll.dto.PpeRequestResponse;
import com.payroll.service.PpeRequestService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/ppe-requests")
@RequiredArgsConstructor
public class PpeRequestController {

    private final PpeRequestService ppeRequestService;

    @GetMapping
    public ResponseEntity<List<PpeRequestResponse>> getAllRequests(
            @RequestParam(required = false) UUID employeeId) {
        if (employeeId != null) {
            return ResponseEntity.ok(ppeRequestService.getRequestsByEmployee(employeeId));
        }
        return ResponseEntity.ok(ppeRequestService.getAllRequests());
    }

    @GetMapping("/pending")
    public ResponseEntity<List<PpeRequestResponse>> getPendingRequests() {
        return ResponseEntity.ok(ppeRequestService.getPendingRequests());
    }

    @GetMapping("/pending/count")
    public ResponseEntity<Map<String, Long>> getPendingRequestCount() {
        return ResponseEntity.ok(Map.of("count", ppeRequestService.getPendingRequestCount()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<PpeRequestResponse> getRequestById(@PathVariable UUID id) {
        return ResponseEntity.ok(ppeRequestService.getRequestById(id));
    }

    @PostMapping
    public ResponseEntity<PpeRequestResponse> createRequest(
            @Valid @RequestBody PpeRequestRequest request,
            @RequestAttribute("userId") UUID userId) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ppeRequestService.createRequest(request, userId));
    }

    @PutMapping("/{id}")
    public ResponseEntity<PpeRequestResponse> updateRequest(
            @PathVariable UUID id,
            @Valid @RequestBody PpeRequestRequest request) {
        return ResponseEntity.ok(ppeRequestService.updateRequest(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteRequest(@PathVariable UUID id) {
        ppeRequestService.deleteRequest(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/approve")
    public ResponseEntity<PpeRequestResponse> approveRequest(
            @PathVariable UUID id,
            @RequestAttribute("userId") UUID userId) {
        return ResponseEntity.ok(ppeRequestService.approveRequest(id, userId));
    }

    @PutMapping("/{id}/reject")
    public ResponseEntity<Void> rejectRequest(
            @PathVariable UUID id,
            @RequestAttribute("userId") UUID userId) {
        ppeRequestService.rejectRequest(id, userId);
        return ResponseEntity.noContent().build();
    }
}
