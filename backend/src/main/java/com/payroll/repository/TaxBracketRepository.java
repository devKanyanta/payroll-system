package com.payroll.repository;

import com.payroll.entity.TaxBracket;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public interface TaxBracketRepository extends JpaRepository<TaxBracket, UUID> {
    List<TaxBracket> findByEffectiveDateLessThanEqualOrderByEffectiveDateDesc(LocalDate date);

    @Query("SELECT t FROM TaxBracket t WHERE t.effectiveDate <= :date " +
           "ORDER BY t.effectiveDate DESC, t.minAmount ASC")
    List<TaxBracket> findActiveBrackets(@Param("date") LocalDate date);

    @Query("SELECT t FROM TaxBracket t WHERE t.effectiveDate = " +
           "(SELECT MAX(t2.effectiveDate) FROM TaxBracket t2 WHERE t2.effectiveDate <= :date) " +
           "ORDER BY t.minAmount ASC")
    List<TaxBracket> findLatestBrackets(@Param("date") LocalDate date);
}
