package com.payroll.exception;

import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.LockedException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleResourceNotFound(ResourceNotFoundException ex) {
        return buildResponse(HttpStatus.NOT_FOUND, ex.getMessage());
    }

    @ExceptionHandler(BadRequestException.class)
    public ResponseEntity<ErrorResponse> handleBadRequest(BadRequestException ex) {
        return buildResponse(HttpStatus.BAD_REQUEST, ex.getMessage());
    }

    @ExceptionHandler(DuplicateResourceException.class)
    public ResponseEntity<ErrorResponse> handleDuplicate(DuplicateResourceException ex) {
        return buildResponse(HttpStatus.CONFLICT, ex.getMessage());
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponse> handleDataIntegrity(DataIntegrityViolationException ex) {
        // Extract the root cause message to identify which constraint was violated
        String message = ex.getMostSpecificCause().getMessage();
        if (message != null) {
            // PostgreSQL unique constraint violation pattern:
            // "ERROR: duplicate key value violates unique constraint "idx_employees_email""
            Matcher constraintMatcher = Pattern.compile("unique constraint \"([^\"]+)\"").matcher(message);
            String constraintName = constraintMatcher.find() ? constraintMatcher.group(1) : null;

            // Map known constraint names to user-friendly messages
            if ("idx_employees_email".equals(constraintName) || "employees_email_key".equals(constraintName)) {
                return buildResponse(HttpStatus.CONFLICT,
                        "This email is already in use by another employee. Each employee must have a unique email address.");
            }
            if ("idx_employees_employee_number".equals(constraintName) || "employees_employee_number_key".equals(constraintName)) {
                return buildResponse(HttpStatus.CONFLICT,
                        "This employee number already exists. Each employee must have a unique employee number.");
            }
            if ("idx_employees_nrc".equals(constraintName) || "employees_nrc_key".equals(constraintName)) {
                return buildResponse(HttpStatus.CONFLICT,
                        "This NRC is already in use by another employee.");
            }

            // Fallback: derive a readable name from the constraint name
            if (constraintName != null) {
                String readable = constraintName
                        .replace("idx_", "")
                        .replace("_", " ")
                        .replace("uk", "unique");
                return buildResponse(HttpStatus.CONFLICT,
                        "A duplicate value was found for '" + readable
                        + "'. Please ensure this value is unique.");
            }

            // Generic database constraint violation messages
            if (message.contains("duplicate key") || message.contains("unique constraint")) {
                return buildResponse(HttpStatus.CONFLICT,
                        "A record with this value already exists. Please use a different value.");
            }
            if (message.contains("not-null constraint")) {
                return buildResponse(HttpStatus.BAD_REQUEST,
                        "A required field is missing. Please fill in all required fields.");
            }
            if (message.contains("foreign key constraint")) {
                return buildResponse(HttpStatus.CONFLICT,
                        "This record is linked to other records and cannot be modified or deleted.");
            }
        }

        log.warn("Unhandled data integrity violation", ex);
        return buildResponse(HttpStatus.CONFLICT,
                "This operation could not be completed due to conflicting data. Please check your input and try again.");
    }

    @ExceptionHandler(BusinessRuleException.class)
    public ResponseEntity<ErrorResponse> handleBusinessRule(BusinessRuleException ex) {
        return buildResponse(HttpStatus.UNPROCESSABLE_ENTITY, ex.getMessage());
    }

    @ExceptionHandler(FileStorageException.class)
    public ResponseEntity<ErrorResponse> handleFileStorage(FileStorageException ex) {
        return buildResponse(HttpStatus.INTERNAL_SERVER_ERROR, ex.getMessage());
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ErrorResponse> handleBadCredentials(BadCredentialsException ex) {
        return buildResponse(HttpStatus.UNAUTHORIZED, "Invalid email or password");
    }

    @ExceptionHandler(LockedException.class)
    public ResponseEntity<ErrorResponse> handleLocked(LockedException ex) {
        return buildResponse(HttpStatus.TOO_MANY_REQUESTS, "Account is locked. Try again later.");
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> errors = new HashMap<>();
        for (FieldError error : ex.getBindingResult().getFieldErrors()) {
            errors.put(error.getField(), error.getDefaultMessage());
        }
        Map<String, Object> response = new HashMap<>();
        response.put("timestamp", LocalDateTime.now().toString());
        response.put("status", HttpStatus.BAD_REQUEST.value());
        response.put("error", "Validation Failed");
        response.put("fieldErrors", errors);
        return ResponseEntity.badRequest().body(response);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGeneral(Exception ex) {
        log.error("Unexpected error", ex);
        return buildResponse(HttpStatus.INTERNAL_SERVER_ERROR, "An unexpected error occurred");
    }

    private ResponseEntity<ErrorResponse> buildResponse(HttpStatus status, String message) {
        ErrorResponse response = new ErrorResponse(
                LocalDateTime.now().toString(),
                status.value(),
                status.getReasonPhrase(),
                message
        );
        return new ResponseEntity<>(response, status);
    }
}
