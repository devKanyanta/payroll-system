package com.payroll.service;

import com.payroll.entity.PayrollSettings;
import java.util.UUID;

public interface PayrollSettingsService {
    PayrollSettings getLatestSettings();
    PayrollSettings getSettingsById(UUID id);
    PayrollSettings createSettings(PayrollSettings settings);
    PayrollSettings updateSettings(UUID id, PayrollSettings settings);
}
