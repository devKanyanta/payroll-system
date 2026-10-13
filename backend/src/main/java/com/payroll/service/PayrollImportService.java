package com.payroll.service;

import com.payroll.entity.PayrollImport;
import org.springframework.core.io.Resource;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

public interface PayrollImportService {
    PayrollImport uploadFile(MultipartFile file, UUID payrollRunId, UUID userId);
    PayrollImport processImport(UUID importId, UUID userId);

    /**
     * Re-parses the Company Cash Flow section from the most recent processed
     * payroll spreadsheet for the given month/year and replaces the stored
     * cashflow revenue rows. Used by the Cashflow page 'Recalculate' action
     * so stale revenue rows (e.g. from imports made by an older parser) can be
     * refreshed without re-uploading the file.
     */
    boolean resyncCashflowFromImport(int month, int year);
    List<PayrollImport> getImportsByPayrollRun(UUID payrollRunId);
    PayrollImport getImportById(UUID id);
    Resource downloadTemplate();
}
