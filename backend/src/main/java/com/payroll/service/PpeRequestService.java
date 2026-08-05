package com.payroll.service;

import com.payroll.dto.PpeRequestRequest;
import com.payroll.dto.PpeRequestResponse;

import java.util.List;
import java.util.UUID;

public interface PpeRequestService {
    List<PpeRequestResponse> getAllRequests();
    List<PpeRequestResponse> getRequestsByEmployee(UUID employeeId);
    List<PpeRequestResponse> getPendingRequests();
    long getPendingRequestCount();
    PpeRequestResponse getRequestById(UUID id);
    PpeRequestResponse createRequest(PpeRequestRequest request, UUID requestedByUserId);
    PpeRequestResponse updateRequest(UUID id, PpeRequestRequest request);
    void deleteRequest(UUID id);
    PpeRequestResponse approveRequest(UUID id, UUID reviewedByUserId);
    void rejectRequest(UUID id, UUID reviewedByUserId);

    /**
     * Flip reviewed (NOT_ELIGIBLE) PPE requests to ELIGIBLE once their due date has arrived,
     * and notify admins (email + in-app notification) for each newly due request.
     *
     * @return the number of requests that became ELIGIBLE in this run
     */
    int processDuePpeRequests();
}
