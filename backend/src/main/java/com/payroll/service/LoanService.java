package com.payroll.service;

import com.payroll.dto.LoanRequest;
import com.payroll.dto.LoanResponse;

import java.util.List;
import java.util.UUID;

public interface LoanService {
    List<LoanResponse> getAllLoans();
    List<LoanResponse> getLoansByEmployee(UUID employeeId);
    LoanResponse getLoanById(UUID id);
    LoanResponse createLoan(LoanRequest request);
    LoanResponse updateLoan(UUID id, LoanRequest request);
    void cancelLoan(UUID id);
}
