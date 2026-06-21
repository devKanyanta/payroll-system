package com.payroll.service;

import com.payroll.entity.PayrollImport;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public interface PayrollImportService {
    PayrollImport uploadFile(MultipartFile file, UUID payrollRunId, UUID userId);
    PayrollImport processImport(UUID importId, UUID userId);
    List<PayrollImport> getImportsByPayrollRun(UUID payrollRunId);
    PayrollImport getImportById(UUID id);
}
