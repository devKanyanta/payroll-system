package com.payroll.service.impl;

import com.payroll.dto.CashflowRevenueRequest;
import com.payroll.dto.CashflowSummaryResponse;
import com.payroll.entity.CashflowRevenue;
import com.payroll.exception.BadRequestException;
import com.payroll.exception.ResourceNotFoundException;
import com.payroll.repository.CashflowRevenueRepository;
import com.payroll.repository.PayrollEntryRepository;
import com.payroll.repository.PayrollRunRepository;
import com.payroll.service.CashflowService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class CashflowServiceImpl implements CashflowService {

    private final CashflowRevenueRepository cashflowRevenueRepository;
    private final PayrollRunRepository payrollRunRepository;
    private final PayrollEntryRepository payrollEntryRepository;

    private static final List<String> DEFAULT_SITES = List.of(
            "Kitwe Invoice", "Mufulira Smelter", "Mufulira Mining", "Chingola"
    );

    @Override
    public List<CashflowRevenue> getRevenuesByMonth(int month, int year) {
        List<CashflowRevenue> existing = cashflowRevenueRepository.findByMonthAndYearOrderBySiteAsc(month, year);

        // If no data exists for this month, return empty entries for each default site
        if (existing.isEmpty()) {
            return DEFAULT_SITES.stream().map(site -> {
                CashflowRevenue rev = new CashflowRevenue();
                rev.setSite(site);
                rev.setSubTotal(BigDecimal.ZERO);
                rev.setVatRate(new BigDecimal("16.00"));
                rev.setVatAmount(BigDecimal.ZERO);
                rev.setTotal(BigDecimal.ZERO);
                rev.setMonth(month);
                rev.setYear(year);
                return rev;
            }).collect(Collectors.toList());
        }

        return existing;
    }

    @Override
    public CashflowRevenue getRevenueById(UUID id) {
        return cashflowRevenueRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("CashflowRevenue", id));
    }

    @Override
    @Transactional
    public CashflowRevenue createRevenue(CashflowRevenueRequest request) {
        // Check for duplicate
        if (cashflowRevenueRepository.findBySiteAndMonthAndYear(request.getSite(), request.getMonth(), request.getYear()).isPresent()) {
            throw new BadRequestException("Revenue entry already exists for " + request.getSite()
                    + " in " + request.getMonth() + "/" + request.getYear());
        }

        BigDecimal vatRate = request.getVatRate() != null ? request.getVatRate() : new BigDecimal("16.00");
        BigDecimal subTotal = request.getSubTotal() != null ? request.getSubTotal() : BigDecimal.ZERO;
        BigDecimal vatAmount = subTotal.multiply(vatRate).divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP);
        BigDecimal total = subTotal.add(vatAmount);

        CashflowRevenue revenue = CashflowRevenue.builder()
                .site(request.getSite())
                .subTotal(subTotal)
                .vatRate(vatRate)
                .vatAmount(vatAmount)
                .total(total)
                .month(request.getMonth())
                .year(request.getYear())
                .build();

        return cashflowRevenueRepository.save(revenue);
    }

    @Override
    @Transactional
    public CashflowRevenue updateRevenue(UUID id, CashflowRevenueRequest request) {
        CashflowRevenue revenue = cashflowRevenueRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("CashflowRevenue", id));

        BigDecimal vatRate = request.getVatRate() != null ? request.getVatRate() : revenue.getVatRate();
        BigDecimal subTotal = request.getSubTotal() != null ? request.getSubTotal() : BigDecimal.ZERO;
        BigDecimal vatAmount = subTotal.multiply(vatRate).divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP);
        BigDecimal total = subTotal.add(vatAmount);

        revenue.setSite(request.getSite());
        revenue.setSubTotal(subTotal);
        revenue.setVatRate(vatRate);
        revenue.setVatAmount(vatAmount);
        revenue.setTotal(total);

        return cashflowRevenueRepository.save(revenue);
    }

    @Override
    @Transactional
    public void deleteRevenue(UUID id) {
        CashflowRevenue revenue = cashflowRevenueRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("CashflowRevenue", id));
        cashflowRevenueRepository.delete(revenue);
    }

    @Override
    public CashflowSummaryResponse getCashflowSummary(int month, int year) {
        List<CashflowRevenue> revenues = cashflowRevenueRepository.findByMonthAndYearOrderBySiteAsc(month, year);

        List<CashflowSummaryResponse.SiteRevenue> siteRevenues = DEFAULT_SITES.stream().map(site -> {
            CashflowRevenue rev = revenues.stream()
                    .filter(r -> r.getSite().equals(site))
                    .findFirst().orElse(null);

            if (rev != null) {
                return CashflowSummaryResponse.SiteRevenue.builder()
                        .site(rev.getSite())
                        .subTotal(rev.getSubTotal())
                        .vatRate(rev.getVatRate())
                        .vatAmount(rev.getVatAmount())
                        .total(rev.getTotal())
                        .build();
            } else {
                return CashflowSummaryResponse.SiteRevenue.builder()
                        .site(site)
                        .subTotal(BigDecimal.ZERO)
                        .vatRate(new BigDecimal("16.00"))
                        .vatAmount(BigDecimal.ZERO)
                        .total(BigDecimal.ZERO)
                        .build();
            }
        }).collect(Collectors.toList());

        BigDecimal totalSubMonthly = cashflowRevenueRepository.sumSubTotalByMonthAndYear(month, year);

        // Get employee gross pay from this month's payroll run
        BigDecimal employeeGrossPay = BigDecimal.ZERO;
        var currentRun = payrollRunRepository.findByMonthAndYear(month, year);
        if (currentRun.isPresent()) {
            BigDecimal gross = payrollEntryRepository.sumGrossSalaryByRunId(currentRun.get().getId());
            employeeGrossPay = gross != null ? gross : BigDecimal.ZERO;
        }

        BigDecimal companyProfit = totalSubMonthly.subtract(employeeGrossPay);

        return CashflowSummaryResponse.builder()
                .month(month)
                .year(year)
                .sites(siteRevenues)
                .totalSubMonthlyAccumulated(totalSubMonthly)
                .employeeGrossPay(employeeGrossPay)
                .companyProfit(companyProfit)
                .build();
    }

    @Override
    public List<Integer> getAvailableYears() {
        Set<Integer> years = new HashSet<>();
        // Add current year always
        years.add(LocalDate.now().getYear());
        // Add years from cashflow data
        years.addAll(cashflowRevenueRepository.findDistinctYears());
        return years.stream().sorted(Comparator.reverseOrder()).collect(Collectors.toList());
    }
}
