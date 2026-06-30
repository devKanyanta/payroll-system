package com.payroll.service.impl;

import com.payroll.dto.PpeCatalogItemRequest;
import com.payroll.dto.PpeCatalogItemResponse;
import com.payroll.entity.PpeCatalogItem;
import com.payroll.exception.DuplicateResourceException;
import com.payroll.exception.ResourceNotFoundException;
import com.payroll.repository.PpeCatalogItemRepository;
import com.payroll.service.PpeCatalogService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PpeCatalogServiceImpl implements PpeCatalogService {

    private final PpeCatalogItemRepository catalogItemRepository;

    @Override
    @Transactional(readOnly = true)
    public List<PpeCatalogItemResponse> getAllActiveItems() {
        return catalogItemRepository.findByIsActiveTrueOrderByNameAsc().stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<PpeCatalogItemResponse> getAllItems() {
        return catalogItemRepository.findAll().stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public PpeCatalogItemResponse getItemById(UUID id) {
        PpeCatalogItem item = catalogItemRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("PPE Catalog Item", id));
        return toResponse(item);
    }

    @Override
    @Transactional
    public PpeCatalogItemResponse createItem(PpeCatalogItemRequest request) {
        if (catalogItemRepository.existsByName(request.getName())) {
            throw new DuplicateResourceException("PPE catalog item with name '" + request.getName() + "' already exists");
        }

        PpeCatalogItem item = PpeCatalogItem.builder()
                .name(request.getName())
                .description(request.getDescription())
                .category(request.getCategory())
                .isActive(request.getIsActive() != null ? request.getIsActive() : true)
                .build();

        return toResponse(catalogItemRepository.save(item));
    }

    @Override
    @Transactional
    public PpeCatalogItemResponse updateItem(UUID id, PpeCatalogItemRequest request) {
        PpeCatalogItem item = catalogItemRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("PPE Catalog Item", id));

        // Check for duplicate name if the name is being changed
        if (!item.getName().equals(request.getName())
                && catalogItemRepository.existsByName(request.getName())) {
            throw new DuplicateResourceException("PPE catalog item with name '" + request.getName() + "' already exists");
        }

        item.setName(request.getName());
        if (request.getDescription() != null) {
            item.setDescription(request.getDescription());
        }
        if (request.getCategory() != null) {
            item.setCategory(request.getCategory());
        }
        if (request.getIsActive() != null) {
            item.setIsActive(request.getIsActive());
        }

        return toResponse(catalogItemRepository.save(item));
    }

    @Override
    @Transactional
    public void deactivateItem(UUID id) {
        PpeCatalogItem item = catalogItemRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("PPE Catalog Item", id));
        item.setIsActive(false);
        catalogItemRepository.save(item);
    }

    private PpeCatalogItemResponse toResponse(PpeCatalogItem item) {
        return PpeCatalogItemResponse.builder()
                .id(item.getId())
                .name(item.getName())
                .description(item.getDescription())
                .category(item.getCategory())
                .isActive(item.getIsActive())
                .createdAt(item.getCreatedAt())
                .build();
    }
}
