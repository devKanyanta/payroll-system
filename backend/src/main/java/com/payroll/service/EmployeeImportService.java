package com.payroll.service;

import com.payroll.entity.EmployeeImport;
import org.springframework.core.io.Resource;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

public interface EmployeeImportService {
    EmployeeImport uploadFile(MultipartFile file, UUID userId);
    EmployeeImport processImport(UUID importId, UUID userId);
    EmployeeImport getImportById(UUID id);
    List<EmployeeImport> getImportsByUser(UUID userId);
    Resource downloadTemplate();
}
