package com.payroll.service;

import com.payroll.entity.TaxBracket;
import java.util.List;
import java.util.UUID;

public interface TaxBracketService {
    List<TaxBracket> getAllBrackets();
    TaxBracket getBracketById(UUID id);
    TaxBracket createBracket(TaxBracket bracket);
    TaxBracket updateBracket(UUID id, TaxBracket bracket);
    void deleteBracket(UUID id);
    List<TaxBracket> getActiveBrackets();
}
