package com.payroll.service.impl;

import com.payroll.dto.LoanRequest;
import com.payroll.dto.LoanResponse;
import com.payroll.entity.Employee;
import com.payroll.entity.Loan;
import com.payroll.entity.LoanStatus;
import com.payroll.exception.ResourceNotFoundException;
import com.payroll.repository.EmployeeRepository;
import com.payroll.repository.LoanRepository;
import com.payroll.service.LoanService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class LoanServiceImpl implements LoanService {

    private final LoanRepository loanRepository;
    private final EmployeeRepository employeeRepository;

    @Override
    @Transactional(readOnly = true)
    public List<LoanResponse> getLoansByEmployee(UUID employeeId) {
        return loanRepository.findByEmployeeId(employeeId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public LoanResponse getLoanById(UUID id) {
        Loan loan = loanRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Loan", id));
        return toResponse(loan);
    }

    @Override
    @Transactional
    public LoanResponse createLoan(LoanRequest request) {
        Employee employee = employeeRepository.findById(request.getEmployeeId())
                .orElseThrow(() -> new ResourceNotFoundException("Employee", request.getEmployeeId()));

        Loan loan = Loan.builder()
                .employee(employee)
                .loanAmount(request.getLoanAmount())
                .balance(request.getLoanAmount())
                .interestRate(request.getInterestRate() != null ? request.getInterestRate() : java.math.BigDecimal.ZERO)
                .monthlyDeduction(request.getMonthlyDeduction() != null ? request.getMonthlyDeduction() : java.math.BigDecimal.ZERO)
                .durationMonths(request.getDurationMonths() != null ? request.getDurationMonths() : 1)
                .startDate(request.getStartDate())
                .endDate(request.getEndDate())
                .status(LoanStatus.ACTIVE)
                .build();

        return toResponse(loanRepository.save(loan));
    }

    @Override
    @Transactional
    public LoanResponse updateLoan(UUID id, LoanRequest request) {
        Loan loan = loanRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Loan", id));

        if (request.getLoanAmount() != null) {
            java.math.BigDecimal paidSoFar = loan.getLoanAmount().subtract(loan.getBalance());
            loan.setLoanAmount(request.getLoanAmount());
            loan.setBalance(request.getLoanAmount().subtract(paidSoFar));
        }
        if (request.getInterestRate() != null) {
            loan.setInterestRate(request.getInterestRate());
        }
        if (request.getMonthlyDeduction() != null) {
            loan.setMonthlyDeduction(request.getMonthlyDeduction());
        }
        if (request.getDurationMonths() != null) {
            loan.setDurationMonths(request.getDurationMonths());
        }
        if (request.getStartDate() != null) {
            loan.setStartDate(request.getStartDate());
        }
        if (request.getEndDate() != null) {
            loan.setEndDate(request.getEndDate());
        }

        return toResponse(loanRepository.save(loan));
    }

    @Override
    @Transactional
    public void cancelLoan(UUID id) {
        Loan loan = loanRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Loan", id));
        loan.setStatus(LoanStatus.CANCELLED);
        loanRepository.save(loan);
    }

    private LoanResponse toResponse(Loan loan) {
        return LoanResponse.builder()
                .id(loan.getId())
                .employeeId(loan.getEmployee().getId())
                .employeeName(loan.getEmployee().getFirstName() + " " + loan.getEmployee().getLastName())
                .loanAmount(loan.getLoanAmount())
                .balance(loan.getBalance())
                .interestRate(loan.getInterestRate())
                .monthlyDeduction(loan.getMonthlyDeduction())
                .durationMonths(loan.getDurationMonths())
                .startDate(loan.getStartDate())
                .endDate(loan.getEndDate())
                .status(loan.getStatus().name())
                .createdAt(loan.getCreatedAt())
                .build();
    }
}
