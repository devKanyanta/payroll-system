package com.payroll.service;

public interface EmailService {
    void sendSimpleMessage(String to, String subject, String text);
    void sendPayslipEmail(String to, String subject, String text, byte[] pdfAttachment, String attachmentName);
    void sendPasswordResetEmail(String to, String resetLink);
}
