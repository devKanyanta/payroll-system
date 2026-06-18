package com.payroll.repository;

import com.payroll.entity.PayrollSettings;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PayrollSettingsRepository extends JpaRepository<PayrollSettings, UUID> {
    Optional<PayrollSettings> findTopByEffectiveDateLessThanEqualOrderByEffectiveDateDesc(LocalDate date);
}
