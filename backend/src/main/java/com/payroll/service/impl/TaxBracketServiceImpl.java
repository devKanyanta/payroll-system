package com.payroll.service.impl;

import com.payroll.entity.TaxBracket;
import com.payroll.exception.ResourceNotFoundException;
import com.payroll.repository.TaxBracketRepository;
import com.payroll.service.TaxBracketService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TaxBracketServiceImpl implements TaxBracketService {

    private final TaxBracketRepository taxBracketRepository;

    @Override
    public List<TaxBracket> getAllBrackets() {
        return taxBracketRepository.findAll();
    }

    @Override
    public TaxBracket getBracketById(UUID id) {
        return taxBracketRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("TaxBracket", id));
    }

    @Override
    @Transactional
    public TaxBracket createBracket(TaxBracket bracket) {
        return taxBracketRepository.save(bracket);
    }

    @Override
    @Transactional
    public TaxBracket updateBracket(UUID id, TaxBracket bracket) {
        TaxBracket existing = taxBracketRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("TaxBracket", id));

        existing.setMinAmount(bracket.getMinAmount());
        existing.setMaxAmount(bracket.getMaxAmount());
        existing.setTaxRate(bracket.getTaxRate());
        existing.setEffectiveDate(bracket.getEffectiveDate());

        return taxBracketRepository.save(existing);
    }

    @Override
    @Transactional
    public void deleteBracket(UUID id) {
        TaxBracket bracket = taxBracketRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("TaxBracket", id));
        taxBracketRepository.delete(bracket);
    }

    @Override
    public List<TaxBracket> getActiveBrackets() {
        return taxBracketRepository.findLatestBrackets(LocalDate.now());
    }
}
