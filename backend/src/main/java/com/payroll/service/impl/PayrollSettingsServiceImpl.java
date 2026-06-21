package com.payroll.service.impl;

import com.payroll.entity.PayrollSettings;
import com.payroll.exception.ResourceNotFoundException;
import com.payroll.repository.PayrollSettingsRepository;
import com.payroll.service.PayrollSettingsService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PayrollSettingsServiceImpl implements PayrollSettingsService {

    private final PayrollSettingsRepository payrollSettingsRepository;

    @Override
    public PayrollSettings getLatestSettings() {
        return payrollSettingsRepository
                .findTopByEffectiveDateLessThanEqualOrderByEffectiveDateDesc(LocalDate.now())
                .orElseThrow(() -> new ResourceNotFoundException("PayrollSettings", "effective_date", LocalDate.now().toString()));
    }

    @Override
    public PayrollSettings getSettingsById(UUID id) {
        return payrollSettingsRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("PayrollSettings", id));
    }

    @Override
    @Transactional
    public PayrollSettings createSettings(PayrollSettings settings) {
        return payrollSettingsRepository.save(settings);
    }

    @Override
    @Transactional
    public PayrollSettings updateSettings(UUID id, PayrollSettings settings) {
        PayrollSettings existing = payrollSettingsRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("PayrollSettings", id));

        existing.setEffectiveDate(settings.getEffectiveDate());
        existing.setNhimaEmployeePercent(settings.getNhimaEmployeePercent());
        existing.setNhimaEmployerPercent(settings.getNhimaEmployerPercent());
        existing.setNapsaEmployeePercent(settings.getNapsaEmployeePercent());
        existing.setNapsaEmployerPercent(settings.getNapsaEmployerPercent());
        existing.setOvertimeRate(settings.getOvertimeRate());
        existing.setHolidayRate(settings.getHolidayRate());
        existing.setWorkingDaysPerMonth(settings.getWorkingDaysPerMonth());
        existing.setHoursPerDay(settings.getHoursPerDay());
        existing.setNapsaMaxEarnings(settings.getNapsaMaxEarnings());
        existing.setSoftLoanInterestRate(settings.getSoftLoanInterestRate());

        return payrollSettingsRepository.save(existing);
    }
}
