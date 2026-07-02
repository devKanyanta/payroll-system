package com.payroll.repository;

import com.payroll.entity.CashflowRevenue;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CashflowRevenueRepository extends JpaRepository<CashflowRevenue, UUID> {

    List<CashflowRevenue> findByMonthAndYearOrderBySiteAsc(int month, int year);

    Optional<CashflowRevenue> findBySiteAndMonthAndYear(String site, int month, int year);

    @Query("SELECT COALESCE(SUM(c.total), 0) FROM CashflowRevenue c WHERE c.month = :month AND c.year = :year")
    java.math.BigDecimal sumTotalByMonthAndYear(@Param("month") int month, @Param("year") int year);

    @Query("SELECT COALESCE(SUM(c.subTotal), 0) FROM CashflowRevenue c WHERE c.month = :month AND c.year = :year")
    java.math.BigDecimal sumSubTotalByMonthAndYear(@Param("month") int month, @Param("year") int year);

    @Query("SELECT DISTINCT c.year FROM CashflowRevenue c ORDER BY c.year DESC")
    List<Integer> findDistinctYears();
}
