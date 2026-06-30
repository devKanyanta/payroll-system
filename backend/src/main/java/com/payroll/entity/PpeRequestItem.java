package com.payroll.entity;

import jakarta.persistence.*;
import lombok.*;
import java.util.UUID;

@Entity
@Table(name = "ppe_request_items")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PpeRequestItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ppe_request_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private PpeRequest ppeRequest;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "catalog_item_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private PpeCatalogItem catalogItem;
}
