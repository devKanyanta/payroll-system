package com.payroll.controller;

import com.payroll.entity.EmployeeImport;
import com.payroll.service.EmployeeImportService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/employees/import")
@RequiredArgsConstructor
public class EmployeeImportController {

    private final EmployeeImportService employeeImportService;

    @PostMapping("/upload")
    public ResponseEntity<EmployeeImport> uploadFile(
            @RequestParam("file") MultipartFile file,
            @RequestAttribute("userId") UUID userId) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(employeeImportService.uploadFile(file, userId));
    }

    @PostMapping("/{id}/process")
    public ResponseEntity<EmployeeImport> processImport(
            @PathVariable UUID id,
            @RequestAttribute("userId") UUID userId) {
        return ResponseEntity.ok(employeeImportService.processImport(id, userId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<EmployeeImport> getImportById(@PathVariable UUID id) {
        return ResponseEntity.ok(employeeImportService.getImportById(id));
    }

    @GetMapping("/by-user")
    public ResponseEntity<List<EmployeeImport>> getImportsByUser(
            @RequestAttribute("userId") UUID userId) {
        return ResponseEntity.ok(employeeImportService.getImportsByUser(userId));
    }

    @GetMapping("/template")
    public ResponseEntity<Resource> downloadTemplate() {
        Resource resource = employeeImportService.downloadTemplate();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"employee-import-template.xlsx\"")
                .body(resource);
    }
}
