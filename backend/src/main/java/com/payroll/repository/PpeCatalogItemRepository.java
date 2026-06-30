package com.payroll.repository;

import com.payroll.entity.PpeCatalogItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PpeCatalogItemRepository extends JpaRepository<PpeCatalogItem, UUID> {
    List<PpeCatalogItem> findByIsActiveTrueOrderByNameAsc();
    Optional<PpeCatalogItem> findByName(String name);
    boolean existsByName(String name);
}
