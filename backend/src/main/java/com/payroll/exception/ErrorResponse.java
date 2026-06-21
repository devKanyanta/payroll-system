package com.payroll.exception;

public record ErrorResponse(String timestamp, int status, String error, String message) {}
