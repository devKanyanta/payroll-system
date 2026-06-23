package com.payroll.service.impl;

import com.payroll.service.EmailService;
import com.resend.Resend;
import com.resend.services.emails.model.Attachment;
import com.resend.services.emails.model.CreateEmailOptions;
import com.resend.services.emails.model.CreateEmailResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Base64;

@Service
@Slf4j
public class EmailServiceImpl implements EmailService {

    private final Resend resend;
    private final String fromAddress;

    public EmailServiceImpl(
            @Value("${app.resend.api-key}") String apiKey,
            @Value("${app.resend.from-address}") String fromAddress) {
        this.resend = new Resend(apiKey);
        this.fromAddress = fromAddress;
    }

    @Override
    public void sendSimpleMessage(String to, String subject, String text) {
        try {
            CreateEmailOptions params = CreateEmailOptions.builder()
                    .from(fromAddress)
                    .to(to)
                    .subject(subject)
                    .text(text)
                    .build();

            CreateEmailResponse response = resend.emails().send(params);
            log.info("Email sent to {} — Resend ID: {}", to, response.getId());
        } catch (Exception e) {
            log.error("Failed to send email to {}: {}", to, e.getMessage());
        }
    }

    @Override
    public void sendPayslipEmail(String to, String subject, String text, byte[] pdfAttachment, String attachmentName) {
        try {
            String base64Content = Base64.getEncoder().encodeToString(pdfAttachment);

            Attachment attachment = Attachment.builder()
                    .fileName(attachmentName)
                    .content(base64Content)
                    .build();

            CreateEmailOptions params = CreateEmailOptions.builder()
                    .from(fromAddress)
                    .to(to)
                    .subject(subject)
                    .text(text)
                    .attachments(attachment)
                    .build();

            CreateEmailResponse response = resend.emails().send(params);
            log.info("Payslip email sent to {} — Resend ID: {}", to, response.getId());
        } catch (Exception e) {
            log.error("Failed to send payslip email to {}: {}", to, e.getMessage());
        }
    }

    @Override
    public void sendPasswordResetEmail(String to, String resetLink) {
        String subject = "Password Reset — Musunga Engineering Payroll";

        String html = buildResetEmailHtml(resetLink);

        try {
            CreateEmailOptions params = CreateEmailOptions.builder()
                    .from(fromAddress)
                    .to(to)
                    .subject(subject)
                    .html(html)
                    .build();

            CreateEmailResponse response = resend.emails().send(params);
            log.info("Password reset email sent to {} — Resend ID: {}", to, response.getId());
        } catch (Exception e) {
            log.error("Failed to send password reset email to {}: {}", to, e.getMessage());
        }
    }

    private String buildResetEmailHtml(String resetLink) {
        return """
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                </head>
                <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0;">
                    <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
                        <tr>
                            <td align="center">
                                <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                                    <tr>
                                        <td style="background-color: #0D47A1; padding: 24px; text-align: center;">
                                            <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700;">Musunga Engineering Payroll</h1>
                                            <p style="color: rgba(255,255,255,0.8); margin: 4px 0 0 0; font-size: 12px;">Musunga Engineering Services Limited</p>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 32px 24px;">
                                            <p style="font-size: 16px; color: #333333; margin: 0 0 16px 0;">You have requested to reset your password.</p>
                                            <p style="font-size: 16px; color: #333333; margin: 0 0 24px 0;">Click the button below to set a new password. This link will expire in <strong>1 hour</strong>.</p>
                                            <table role="presentation" width="100%%" cellpadding="0" cellspacing="0">
                                                <tr>
                                                    <td align="center">
                                                        <a href="%s" style="display: inline-block; background-color: #FF6F00; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 16px; font-weight: bold;">Reset Password</a>
                                                    </td>
                                                </tr>
                                            </table>
                                            <p style="font-size: 14px; color: #666666; margin: 24px 0 0 0; word-break: break-all;">
                                                Or copy this link into your browser:<br>
                                                <a href="%s" style="color: #0D47A1;">%s</a>
                                            </p>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 24px; border-top: 1px solid #e0e0e0; text-align: center;">
                                            <p style="font-size: 12px; color: #999999; margin: 0;">
                                                If you did not request a password reset, please ignore this email.<br>
                                                &copy; Musunga Engineering Services Limited
                                            </p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </body>
                </html>
                """.formatted(resetLink, resetLink, resetLink);
    }
}
