package com.payroll.service;

import com.payroll.dto.PagedResponse;
import com.payroll.dto.UserRequest;
import com.payroll.dto.UserResponse;
import org.springframework.data.domain.Pageable;

import java.util.UUID;

public interface UserService {
    PagedResponse<UserResponse> getAllUsers(Pageable pageable);
    UserResponse getUserById(UUID id);
    UserResponse createUser(UserRequest request);
    UserResponse updateUser(UUID id, UserRequest request);
    void deleteUser(UUID id);
}
