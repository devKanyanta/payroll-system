package com.payroll.service.impl;

import com.payroll.dto.PpeCatalogItemResponse;
import com.payroll.dto.PpeRequestRequest;
import com.payroll.dto.PpeRequestResponse;
import com.payroll.entity.*;
import com.payroll.exception.BadRequestException;
import com.payroll.exception.BusinessRuleException;
import com.payroll.exception.ResourceNotFoundException;
import com.payroll.repository.*;
import com.payroll.service.AuditService;
import com.payroll.service.NotificationService;
import com.payroll.service.PpeRequestService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PpeRequestServiceImpl implements PpeRequestService {

    private static final Logger log = LoggerFactory.getLogger(PpeRequestServiceImpl.class);

    private final PpeRequestRepository ppeRequestRepository;
    private final PpeCatalogItemRepository catalogItemRepository;
    private final EmployeeRepository employeeRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final AuditService auditService;

    @Override
    @Transactional(readOnly = true)
    public List<PpeRequestResponse> getAllRequests() {
        return ppeRequestRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<PpeRequestResponse> getRequestsByEmployee(UUID employeeId) {
        return ppeRequestRepository.findByEmployeeIdOrderByCreatedAtDesc(employeeId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<PpeRequestResponse> getPendingRequests() {
        return ppeRequestRepository.findByStatusOrderByCreatedAtDesc(PpeRequestStatus.PENDING).stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public long getPendingRequestCount() {
        return ppeRequestRepository.countByStatus(PpeRequestStatus.PENDING);
    }

    @Override
    @Transactional(readOnly = true)
    public PpeRequestResponse getRequestById(UUID id) {
        PpeRequest request = ppeRequestRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("PPE Request", id));
        return toResponse(request);
    }

    @Override
    @Transactional
    public PpeRequestResponse createRequest(PpeRequestRequest request, UUID requestedByUserId) {
        Employee employee = employeeRepository.findById(request.getEmployeeId())
                .orElseThrow(() -> new ResourceNotFoundException("Employee", request.getEmployeeId()));

        // Validate employee is active
        if (employee.getStatus() != EmployeeStatus.ACTIVE) {
            throw new BusinessRuleException("Cannot create PPE request for a non-active employee");
        }

        // Validate no duplicate pending request for same employee
        if (ppeRequestRepository.existsByEmployeeIdAndStatus(employee.getId(), PpeRequestStatus.PENDING)) {
            throw new BusinessRuleException("This employee already has a pending PPE request");
        }

        // Validate due date is in the future
        if (request.getDueDate() != null && request.getDueDate().isBefore(LocalDate.now())) {
            throw new BadRequestException("Due date must be in the future");
        }

        User requestedBy = userRepository.findById(requestedByUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User", requestedByUserId));

        // Resolve catalog items
        List<PpeCatalogItem> catalogItems = catalogItemRepository.findAllById(request.getCatalogItemIds());
        if (catalogItems.isEmpty()) {
            throw new BadRequestException("No valid PPE catalog items found");
        }

        // Build request
        PpeRequest ppeRequest = PpeRequest.builder()
                .employee(employee)
                .requestedBy(requestedBy)
                .status(PpeRequestStatus.PENDING)
                .dueDate(request.getDueDate())
                .notes(request.getNotes())
                .requestItems(new ArrayList<>())
                .build();

        // Build request items
        for (PpeCatalogItem catalogItem : catalogItems) {
            PpeRequestItem requestItem = PpeRequestItem.builder()
                    .ppeRequest(ppeRequest)
                    .catalogItem(catalogItem)
                    .build();
            ppeRequest.getRequestItems().add(requestItem);
        }

        PpeRequest saved = ppeRequestRepository.save(ppeRequest);

        // Notify all admin users
        notifyAdminsOfNewRequest(saved);

        // Audit log
        auditService.logEvent(
                requestedByUserId,
                "CREATE",
                "PPE_REQUEST",
                saved.getId().toString(),
                null,
                "Created PPE request for " + employee.getFirstName() + " " + employee.getLastName()
                        + " with " + catalogItems.size() + " item(s)",
                null
        );

        log.info("PPE request {} created for employee {} by user {}", saved.getId(), employee.getEmployeeNumber(), requestedByUserId);
        return toResponse(saved);
    }

    @Override
    @Transactional
    public PpeRequestResponse updateRequest(UUID id, PpeRequestRequest request) {
        PpeRequest ppeRequest = ppeRequestRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("PPE Request", id));

        // Only PENDING requests can be edited
        if (ppeRequest.getStatus() != PpeRequestStatus.PENDING) {
            throw new BusinessRuleException("Cannot edit a PPE request that is not in PENDING status");
        }

        // Update due date
        if (request.getDueDate() != null) {
            if (request.getDueDate().isBefore(LocalDate.now())) {
                throw new BadRequestException("Due date must be in the future");
            }
            ppeRequest.setDueDate(request.getDueDate());
        }

        if (request.getNotes() != null) {
            ppeRequest.setNotes(request.getNotes());
        }

        // Update catalog items if provided
        if (request.getCatalogItemIds() != null && !request.getCatalogItemIds().isEmpty()) {
            List<PpeCatalogItem> catalogItems = catalogItemRepository.findAllById(request.getCatalogItemIds());
            if (catalogItems.isEmpty()) {
                throw new BadRequestException("No valid PPE catalog items found");
            }

            // Remove old items
            ppeRequest.getRequestItems().clear();

            // Add new items
            for (PpeCatalogItem catalogItem : catalogItems) {
                PpeRequestItem requestItem = PpeRequestItem.builder()
                        .ppeRequest(ppeRequest)
                        .catalogItem(catalogItem)
                        .build();
                ppeRequest.getRequestItems().add(requestItem);
            }
        }

        PpeRequest saved = ppeRequestRepository.save(ppeRequest);
        return toResponse(saved);
    }

    @Override
    @Transactional
    public void deleteRequest(UUID id) {
        PpeRequest ppeRequest = ppeRequestRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("PPE Request", id));

        if (ppeRequest.getStatus() != PpeRequestStatus.PENDING) {
            throw new BusinessRuleException("Cannot delete a PPE request that is not in PENDING status");
        }

        ppeRequestRepository.delete(ppeRequest);
    }

    @Override
    @Transactional
    public PpeRequestResponse approveRequest(UUID id, UUID reviewedByUserId) {
        PpeRequest ppeRequest = ppeRequestRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("PPE Request", id));

        if (ppeRequest.getStatus() != PpeRequestStatus.PENDING) {
            throw new BusinessRuleException("PPE request is not in PENDING status");
        }

        // Admin cannot approve their own request
        if (ppeRequest.getRequestedBy().getId().equals(reviewedByUserId)) {
            throw new BusinessRuleException("An admin cannot approve their own PPE request");
        }

        User reviewedBy = userRepository.findById(reviewedByUserId)
                .orElseThrow(() -> new ResourceNotFoundException("User", reviewedByUserId));

        ppeRequest.setStatus(PpeRequestStatus.NOT_ELIGIBLE);
        ppeRequest.setReviewedBy(reviewedBy);
        ppeRequest.setDateGiven(LocalDate.now());

        PpeRequest saved = ppeRequestRepository.save(ppeRequest);

        // Audit log
        auditService.logEvent(
                reviewedByUserId,
                "APPROVED",
                "PPE_REQUEST",
                saved.getId().toString(),
                "PENDING",
                "NOT_ELIGIBLE",
                null
        );

        log.info("PPE request {} approved by user {}", saved.getId(), reviewedByUserId);
        return toResponse(saved);
    }

    @Override
    @Transactional
    public void rejectRequest(UUID id, UUID reviewedByUserId) {
        PpeRequest ppeRequest = ppeRequestRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("PPE Request", id));

        if (ppeRequest.getStatus() != PpeRequestStatus.PENDING) {
            throw new BusinessRuleException("PPE request is not in PENDING status");
        }

        // Admin cannot reject their own request
        if (ppeRequest.getRequestedBy().getId().equals(reviewedByUserId)) {
            throw new BusinessRuleException("An admin cannot reject their own PPE request");
        }

        // Audit log before deleting
        auditService.logEvent(
                reviewedByUserId,
                "REJECTED",
                "PPE_REQUEST",
                ppeRequest.getId().toString(),
                "PENDING",
                "DELETED",
                null
        );

        ppeRequestRepository.delete(ppeRequest);

        log.info("PPE request {} rejected and deleted by user {}", id, reviewedByUserId);
    }

    /**
     * Notify all admin users about a new PPE request.
     */
    private void notifyAdminsOfNewRequest(PpeRequest request) {
        List<User> admins = userRepository.findByRole(Role.ADMIN);
        String employeeName = request.getEmployee().getFirstName() + " " + request.getEmployee().getLastName();
        int itemCount = request.getRequestItems().size();

        for (User admin : admins) {
            notificationService.createNotification(
                    admin.getId(),
                    "New PPE Request — " + employeeName,
                    employeeName + " is requesting " + itemCount + " PPE item(s)",
                    "PPE_REQUEST",
                    "/ppe/" + request.getId()
            );
        }
    }

    private PpeRequestResponse toResponse(PpeRequest request) {
        List<PpeCatalogItemResponse> itemResponses = request.getRequestItems().stream()
                .map(item -> PpeCatalogItemResponse.builder()
                        .id(item.getCatalogItem().getId())
                        .name(item.getCatalogItem().getName())
                        .description(item.getCatalogItem().getDescription())
                        .category(item.getCatalogItem().getCategory())
                        .build())
                .toList();

        return PpeRequestResponse.builder()
                .id(request.getId())
                .employeeId(request.getEmployee().getId())
                .employeeName(request.getEmployee().getFirstName() + " " + request.getEmployee().getLastName())
                .employeeNumber(request.getEmployee().getEmployeeNumber())
                .requestedById(request.getRequestedBy().getId())
                .requestedByName(request.getRequestedBy().getFirstName() + " " + request.getRequestedBy().getLastName())
                .reviewedById(request.getReviewedBy() != null ? request.getReviewedBy().getId() : null)
                .reviewedByName(request.getReviewedBy() != null
                        ? request.getReviewedBy().getFirstName() + " " + request.getReviewedBy().getLastName()
                        : null)
                .status(request.getStatus().name())
                .dateGiven(request.getDateGiven())
                .dueDate(request.getDueDate())
                .notes(request.getNotes())
                .items(itemResponses)
                .createdAt(request.getCreatedAt())
                .updatedAt(request.getUpdatedAt())
                .build();
    }
}
