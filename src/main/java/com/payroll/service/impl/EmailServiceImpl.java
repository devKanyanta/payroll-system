package com.payroll.service.impl;

import com.payroll.service.EmailService;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailServiceImpl implements EmailService {

    private final JavaMailSender mailSender;

    @Override
    public void sendSimpleMessage(String to, String subject, String text) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(to);
            message.setSubject(subject);
            message.setText(text);
            mailSender.send(message);
            log.info("Email sent to {}", to);
        } catch (Exception e) {
            log.error("Failed to send email to {}: {}", to, e.getMessage());
        }
    }

    @Override
    public void sendPayslipEmail(String to, String subject, String text, byte[] pdfAttachment, String attachmentName) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(text);

            if (pdfAttachment != null && attachmentName != null) {
                helper.addAttachment(attachmentName, () -> new java.io.ByteArrayInputStream(pdfAttachment));
            }

            mailSender.send(message);
            log.info("Payslip email sent to {}", to);
        } catch (MessagingException e) {
            log.error("Failed to send payslip email to {}: {}", to, e.getMessage());
        }
    }

    @Override
    public void sendPasswordResetEmail(String to, String resetLink) {
        String subject = "Password Reset Request";
        String text = "You have requested to reset your password. Click the link below to reset it:\n\n"
                + resetLink + "\n\n"
                + "This link will expire in 1 hour.\n\n"
                + "If you did not request a password reset, please ignore this email.";

        sendSimpleMessage(to, subject, text);
    }
}
