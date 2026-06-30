package com.payroll.service;

import com.payroll.dto.PpeCatalogItemRequest;
import com.payroll.dto.PpeCatalogItemResponse;

import java.util.List;
import java.util.UUID;

public interface PpeCatalogService {
    List<PpeCatalogItemResponse> getAllActiveItems();
    List<PpeCatalogItemResponse> getAllItems();
    PpeCatalogItemResponse getItemById(UUID id);
    PpeCatalogItemResponse createItem(PpeCatalogItemRequest request);
    PpeCatalogItemResponse updateItem(UUID id, PpeCatalogItemRequest request);
    void deactivateItem(UUID id);
}
