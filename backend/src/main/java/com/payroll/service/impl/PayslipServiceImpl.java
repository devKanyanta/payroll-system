package com.payroll.service.impl;

import com.lowagie.text.*;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import com.payroll.entity.PayrollEntry;
import com.payroll.entity.Payslip;
import com.payroll.exception.ResourceNotFoundException;
import com.payroll.repository.PayrollEntryRepository;
import com.payroll.repository.PayslipRepository;
import com.payroll.exception.BusinessRuleException;
import com.payroll.service.EmailService;
import com.payroll.service.FileStorageService;
import com.payroll.service.PayslipService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Service
@RequiredArgsConstructor
public class PayslipServiceImpl implements PayslipService {

    private static final Logger log = LoggerFactory.getLogger(PayslipServiceImpl.class);
    private static final String[] MONTH_NAMES = {
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    };

    private final PayslipRepository payslipRepository;
    private final PayrollEntryRepository payrollEntryRepository;
    private final FileStorageService fileStorageService;
    private final EmailService emailService;

    @Override
    public List<Payslip> getPayslipsByEmployee(UUID employeeId) {
        return payslipRepository.findByPayrollEntryEmployeeIdOrderByCreatedAtDesc(employeeId);
    }

    @Override
    public Payslip getPayslipById(UUID id) {
        return payslipRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Payslip", id));
    }

    @Override
    public byte[] downloadPayslip(UUID id) {
        Payslip payslip = getPayslipById(id);

        // If PDF hasn't been generated yet (e.g. legacy payslips), generate on-demand
        if (payslip.getPdfPath() == null) {
            log.info("Payslip {} has no PDF file — generating on demand", id);
            generatePayslipPdf(payslip);
        }

        try {
            var resource = fileStorageService.loadFile(payslip.getPdfPath());
            try (var is = resource.getInputStream()) {
                return is.readAllBytes();
            }
        } catch (IOException e) {
            throw new RuntimeException("Failed to read payslip file", e);
        }
    }

    @Override
    @Transactional
    public void generatePayslips(UUID payrollRunId) {
        // First, clean up any existing payslips for this payroll run to prevent duplicates
        List<Payslip> existing = payslipRepository.findByPayrollRunId(payrollRunId);
        if (!existing.isEmpty()) {
            log.info("Cleaning up {} existing payslip(s) for payroll run {} before regenerating",
                    existing.size(), payrollRunId);
            for (Payslip payslip : existing) {
                // Delete the PDF file from storage if it exists
                if (payslip.getPdfPath() != null) {
                    try {
                        fileStorageService.deleteFile(payslip.getPdfPath());
                    } catch (Exception e) {
                        log.warn("Failed to delete old payslip file {}: {}", payslip.getPdfPath(), e.getMessage());
                    }
                }
                payslipRepository.delete(payslip);
            }
            payslipRepository.flush();
        }

        List<PayrollEntry> entries = payrollEntryRepository.findByPayrollRunId(payrollRunId);

        for (PayrollEntry entry : entries) {
            Payslip payslip = Payslip.builder()
                    .payrollEntry(entry)
                    .generatedAt(LocalDateTime.now())
                    .build();
            payslipRepository.save(payslip);

            try {
                generatePayslipPdf(payslip);
            } catch (Exception e) {
                log.error("Failed to generate PDF for payslip {} (employee: {})",
                        payslip.getId(), entry.getEmployee().getEmployeeNumber(), e);
            }
        }
    }

    /**
     * Generates a PDF for the given payslip, stores it, and updates the pdfPath.
     */
    private void generatePayslipPdf(Payslip payslip) {
        PayrollEntry entry = payslip.getPayrollEntry();
        var employee = entry.getEmployee();
        var payrollRun = entry.getPayrollRun();

        byte[] pdfBytes = buildPayslipPdf(entry, employee, payrollRun);

        String filename = "payslip-" + payslip.getId() + ".pdf";
        String relativePath = fileStorageService.storeFile(pdfBytes, "payslips", filename);

        payslip.setPdfPath(relativePath);
        payslipRepository.save(payslip);
    }

    private byte[] buildPayslipPdf(PayrollEntry entry, com.payroll.entity.Employee employee,
                                    com.payroll.entity.PayrollRun payrollRun) {
        NumberFormat fmt = NumberFormat.getCurrencyInstance(new Locale("en", "ZM"));

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        // Landscape orientation
        Document document = new Document(PageSize.A4.rotate(), 36, 36, 36, 36);
        PdfWriter.getInstance(document, baos);
        document.open();

        java.awt.Color navyColor = new java.awt.Color(13, 71, 161);
        java.awt.Color accentColor = new java.awt.Color(0, 150, 80);
        java.awt.Color lightGrayBg = new java.awt.Color(248, 249, 250);
        java.awt.Color headerBg = new java.awt.Color(13, 71, 161);
        java.awt.Color totalBg = new java.awt.Color(240, 244, 255);

        Font normalFont = new Font(Font.HELVETICA, 9, Font.NORMAL);
        Font boldFont = new Font(Font.HELVETICA, 9, Font.BOLD);
        Font whiteFont = new Font(Font.HELVETICA, 10, Font.BOLD, java.awt.Color.WHITE);
        Font labelFont = new Font(Font.HELVETICA, 9, Font.BOLD, new java.awt.Color(100, 100, 100));

        // ═══════════════════════════════════════════
        //  HEADER — Logo + Company + Title
        // ═══════════════════════════════════════════
        PdfPTable headerRow = new PdfPTable(3);
        headerRow.setWidthPercentage(100);
        headerRow.setWidths(new float[]{1.5f, 4f, 3f});
        headerRow.getDefaultCell().setBorder(Rectangle.NO_BORDER);
        headerRow.getDefaultCell().setPadding(2f);

        // Left: Logo
        PdfPCell logoCell = new PdfPCell();
        logoCell.setBorder(Rectangle.NO_BORDER);
        logoCell.setVerticalAlignment(Element.ALIGN_MIDDLE);
        try {
            InputStream logoStream = new ClassPathResource("MSL.png").getInputStream();
            byte[] logoBytes = logoStream.readAllBytes();
            Image logo = Image.getInstance(logoBytes);
            logo.scaleToFit(100, 45);
            logoCell.addElement(logo);
        } catch (Exception e) {
            // Fallback: just show company name
            logoCell.addElement(new Paragraph("MSL", new Font(Font.HELVETICA, 16, Font.BOLD, navyColor)));
        }
        headerRow.addCell(logoCell);

        // Center: Company name
        PdfPCell companyCell = new PdfPCell();
        companyCell.setBorder(Rectangle.NO_BORDER);
        companyCell.setVerticalAlignment(Element.ALIGN_MIDDLE);
        Paragraph companyName = new Paragraph("Musunga Engineering Services Ltd",
                new Font(Font.HELVETICA, 12, Font.BOLD, navyColor));
        companyName.setSpacingAfter(1f);
        companyCell.addElement(companyName);
        Paragraph tagline = new Paragraph("Payroll Department",
                new Font(Font.HELVETICA, 9, Font.NORMAL, new java.awt.Color(120, 120, 120)));
        companyCell.addElement(tagline);
        headerRow.addCell(companyCell);

        // Right: Payslip title + period (boxed)
        PdfPCell titleCell = new PdfPCell();
        titleCell.setBorder(Rectangle.NO_BORDER);
        titleCell.setVerticalAlignment(Element.ALIGN_MIDDLE);
        titleCell.setHorizontalAlignment(Element.ALIGN_RIGHT);

        PdfPTable titleBox = new PdfPTable(1);
        titleBox.setWidthPercentage(100);
        PdfPCell titleBoxCell = new PdfPCell();
        titleBoxCell.setBackgroundColor(new java.awt.Color(13, 71, 161));
        titleBoxCell.setPadding(8f);
        titleBoxCell.setHorizontalAlignment(Element.ALIGN_CENTER);
        titleBoxCell.setBorder(Rectangle.BOX);
        titleBoxCell.setBorderColor(navyColor);
        Paragraph titleText = new Paragraph("PAYSLIP", new Font(Font.HELVETICA, 16, Font.BOLD, java.awt.Color.WHITE));
        titleText.setSpacingAfter(2f);
        titleBoxCell.addElement(titleText);
        Paragraph periodText = new Paragraph(
                MONTH_NAMES[payrollRun.getMonth() - 1] + " " + payrollRun.getYear(),
                new Font(Font.HELVETICA, 10, Font.NORMAL, java.awt.Color.WHITE));
        titleBoxCell.addElement(periodText);
        titleBox.addCell(titleBoxCell);
        titleCell.addElement(titleBox);
        headerRow.addCell(titleCell);

        document.add(headerRow);

        // Thin navy line separator
        Paragraph lineSep = new Paragraph();
        lineSep.setSpacingBefore(6f);
        lineSep.setSpacingAfter(12f);
        Chunk lineChunk = new Chunk(new com.lowagie.text.pdf.draw.LineSeparator(1.5f, 100, navyColor, Element.ALIGN_CENTER, -2f));
        lineSep.add(lineChunk);
        document.add(lineSep);

        // ═══════════════════════════════════════════
        //  EMPLOYEE DETAILS — 2-column side-by-side
        // ═══════════════════════════════════════════
        PdfPTable infoPanel = new PdfPTable(2);
        infoPanel.setWidthPercentage(100);
        infoPanel.setWidths(new float[]{1, 1});
        infoPanel.setSpacingAfter(12f);

        // Left column: Employee info
        PdfPCell infoLeftCell = new PdfPCell();
        infoLeftCell.setBorder(Rectangle.BOX);
        infoLeftCell.setBorderColor(new java.awt.Color(220, 220, 220));
        infoLeftCell.setBackgroundColor(lightGrayBg);
        infoLeftCell.setPadding(10f);
        infoLeftCell.setPaddingLeft(14f);

        Paragraph empSectionTitle = new Paragraph("Employee Information",
                new Font(Font.HELVETICA, 10, Font.BOLD, navyColor));
        empSectionTitle.setSpacingAfter(6f);
        infoLeftCell.addElement(empSectionTitle);

        PdfPTable empInfoTable = new PdfPTable(2);
        empInfoTable.setWidthPercentage(100);
        empInfoTable.setWidths(new float[]{1, 2});
        empInfoTable.getDefaultCell().setBorder(Rectangle.NO_BORDER);
        empInfoTable.getDefaultCell().setPadding(2f);

        addLandscapeInfoCell(empInfoTable, "Employee", employee.getFirstName() + " " + employee.getLastName(), labelFont, normalFont);
        addLandscapeInfoCell(empInfoTable, "Employee #", employee.getEmployeeNumber(), labelFont, normalFont);
        addLandscapeInfoCell(empInfoTable, "Department",
                employee.getDepartment() != null ? employee.getDepartment().getName() : "-", labelFont, normalFont);
        addLandscapeInfoCell(empInfoTable, "Position",
                employee.getPosition() != null ? employee.getPosition() : "-", labelFont, normalFont);
        addLandscapeInfoCell(empInfoTable, "NRC", employee.getNrc(), labelFont, normalFont);
        addLandscapeInfoCell(empInfoTable, "Site",
                entry.getSite() != null ? entry.getSite() : "-", labelFont, normalFont);
        infoLeftCell.addElement(empInfoTable);
        infoPanel.addCell(infoLeftCell);

        // Right column: Bank & Loan info
        PdfPCell infoRightCell = new PdfPCell();
        infoRightCell.setBorder(Rectangle.BOX);
        infoRightCell.setBorderColor(new java.awt.Color(220, 220, 220));
        infoRightCell.setBackgroundColor(lightGrayBg);
        infoRightCell.setPadding(10f);
        infoRightCell.setPaddingLeft(14f);

        Paragraph paySectionTitle = new Paragraph("Payment Information",
                new Font(Font.HELVETICA, 10, Font.BOLD, navyColor));
        paySectionTitle.setSpacingAfter(6f);
        infoRightCell.addElement(paySectionTitle);

        PdfPTable payInfoTable = new PdfPTable(2);
        payInfoTable.setWidthPercentage(100);
        payInfoTable.setWidths(new float[]{1, 2});
        payInfoTable.getDefaultCell().setBorder(Rectangle.NO_BORDER);
        payInfoTable.getDefaultCell().setPadding(2f);

        addLandscapeInfoCell(payInfoTable, "Bank Name",
                employee.getBankName() != null ? employee.getBankName() : "-", labelFont, normalFont);
        addLandscapeInfoCell(payInfoTable, "Account #",
                employee.getAccountNumber() != null ? employee.getAccountNumber() : "-", labelFont, normalFont);

        BigDecimal loanBal = entry.getLoanBalance() != null ? entry.getLoanBalance() : BigDecimal.ZERO;
        BigDecimal loanDed = entry.getLoanDeduction() != null ? entry.getLoanDeduction() : BigDecimal.ZERO;
        boolean hasLoan = loanBal.compareTo(BigDecimal.ZERO) > 0 || loanDed.compareTo(BigDecimal.ZERO) > 0;
        if (hasLoan) {
            addLandscapeInfoCell(payInfoTable, "Loan Balance", fmt.format(loanBal), labelFont, normalFont);
            addLandscapeInfoCell(payInfoTable, "Loan Deduction", fmt.format(loanDed), labelFont, normalFont);
        }
        infoRightCell.addElement(payInfoTable);
        infoPanel.addCell(infoRightCell);

        document.add(infoPanel);

        // ═══════════════════════════════════════════
        //  EARNINGS & DEDUCTIONS — Side by side
        // ═══════════════════════════════════════════
        PdfPTable financialPanel = new PdfPTable(2);
        financialPanel.setWidthPercentage(100);
        financialPanel.setWidths(new float[]{1, 1});
        financialPanel.setSpacingAfter(8f);

        // ── Left: Earnings Table ──
        PdfPCell earningsCell = new PdfPCell();
        earningsCell.setBorder(Rectangle.NO_BORDER);
        earningsCell.setPaddingRight(6f);

        PdfPTable earningsTable = new PdfPTable(new float[]{3f, 1.2f, 1f, 1.5f});
        earningsTable.setWidthPercentage(100);
        earningsTable.setSpacingAfter(4f);

        // Earnings header
        addStyledHeader(earningsTable, new String[]{"Earnings", "Rate/Hr", "Hrs/Days", "Amount (ZMW)"}, headerBg, whiteFont);

        addAmountRow(earningsTable, "Present (" + entry.getPresentDays().stripTrailingZeros().toPlainString() + " days)",
                entry.getHourlyRate(), entry.getRegularHours(), entry.getRegularAmount(), normalFont);
        addAmountRow(earningsTable, "Overtime", entry.getHourlyRate() != null
                ? entry.getHourlyRate().multiply(new BigDecimal("1.5")) : BigDecimal.ZERO,
                entry.getOvertimeHours(), entry.getOvertimeAmount(), normalFont);
        addAmountRow(earningsTable, "Holiday", entry.getHourlyRate() != null
                ? entry.getHourlyRate().multiply(new BigDecimal("2.0")) : BigDecimal.ZERO,
                entry.getHolidayHours(), entry.getHolidayAmount(), normalFont);

        BigDecimal totalEarnings = entry.getRegularAmount()
                .add(entry.getOvertimeAmount() != null ? entry.getOvertimeAmount() : BigDecimal.ZERO)
                .add(entry.getHolidayAmount() != null ? entry.getHolidayAmount() : BigDecimal.ZERO);

        addStyledTotalRow(earningsTable, "Gross Salary", totalEarnings, fmt, boldFont, totalBg);
        earningsCell.addElement(earningsTable);
        financialPanel.addCell(earningsCell);

        // ── Right: Deductions Table ──
        PdfPCell deductionsCell = new PdfPCell();
        deductionsCell.setBorder(Rectangle.NO_BORDER);
        deductionsCell.setPaddingLeft(6f);

        PdfPTable deductionsTable = new PdfPTable(new float[]{3f, 1f, 1.5f});
        deductionsTable.setWidthPercentage(100);
        deductionsTable.setSpacingAfter(4f);

        // Deductions header
        addStyledHeader(deductionsTable, new String[]{"Deductions", "Rate", "Amount (ZMW)"}, headerBg, whiteFont);

        addDeductionRow(deductionsTable, "NHIMA", formatPercent(entry, e -> e.getNhima(), totalEarnings),
                entry.getNhima(), normalFont, fmt);
        addDeductionRow(deductionsTable, "NAPSA", formatPercent(entry, e -> e.getNapsa(), totalEarnings),
                entry.getNapsa(), normalFont, fmt);

        BigDecimal loan = entry.getLoanDeduction() != null ? entry.getLoanDeduction() : BigDecimal.ZERO;
        if (loan.compareTo(BigDecimal.ZERO) > 0) {
            addDeductionRow(deductionsTable, "Loan Deduction", "", loan, normalFont, fmt);
        }
        BigDecimal other = entry.getOtherDeductions() != null ? entry.getOtherDeductions() : BigDecimal.ZERO;
        if (other.compareTo(BigDecimal.ZERO) > 0) {
            addDeductionRow(deductionsTable, "Other Deductions", "", other, normalFont, fmt);
        }

        BigDecimal totalDeductions = entry.getNhima()
                .add(entry.getNapsa())
                .add(loan)
                .add(other);

        addStyledTotalRow(deductionsTable, "Total Deductions", totalDeductions, fmt, boldFont, totalBg);
        deductionsCell.addElement(deductionsTable);
        financialPanel.addCell(deductionsCell);

        document.add(financialPanel);

        // ═══════════════════════════════════════════
        //  NET SALARY — Highlighted Box
        // ═══════════════════════════════════════════
        PdfPTable netTable = new PdfPTable(1);
        netTable.setWidthPercentage(60);
        netTable.setHorizontalAlignment(Element.ALIGN_CENTER);
        netTable.setSpacingAfter(16f);

        PdfPCell netCell = new PdfPCell();
        netCell.setBackgroundColor(accentColor);
        netCell.setPadding(10f);
        netCell.setPaddingTop(6f);
        netCell.setPaddingBottom(6f);
        netCell.setHorizontalAlignment(Element.ALIGN_CENTER);
        netCell.setBorder(Rectangle.BOX);
        netCell.setBorderColor(accentColor);

        Paragraph netLabel = new Paragraph("NET SALARY",
                new Font(Font.HELVETICA, 11, Font.BOLD, java.awt.Color.WHITE));
        netLabel.setSpacingAfter(2f);
        netCell.addElement(netLabel);
        Paragraph netAmount = new Paragraph(fmt.format(entry.getNetSalary()),
                new Font(Font.HELVETICA, 22, Font.BOLD, java.awt.Color.WHITE));
        netCell.addElement(netAmount);
        netTable.addCell(netCell);
        document.add(netTable);

        // ═══════════════════════════════════════════
        //  FOOTER
        // ═══════════════════════════════════════════
        Paragraph footerLine = new Paragraph();
        footerLine.setSpacingBefore(4f);
        footerLine.setSpacingAfter(6f);
        Chunk footerChunk = new Chunk(new com.lowagie.text.pdf.draw.LineSeparator(0.5f, 100, new java.awt.Color(200, 200, 200), Element.ALIGN_CENTER, -2f));
        footerLine.add(footerChunk);
        document.add(footerLine);

        Paragraph footerCompany = new Paragraph(
                "Musunga Engineering Services Ltd | Payroll Department",
                new Font(Font.HELVETICA, 9, Font.BOLD, navyColor));
        footerCompany.setAlignment(Element.ALIGN_CENTER);
        footerCompany.setSpacingAfter(1f);
        document.add(footerCompany);
        Paragraph footerNote = new Paragraph(
                "Generated on " + LocalDateTime.now().toLocalDate() + " | This is a computer-generated document.",
                new Font(Font.HELVETICA, 7, Font.ITALIC, new java.awt.Color(150, 150, 150)));
        footerNote.setAlignment(Element.ALIGN_CENTER);
        document.add(footerNote);

        document.close();
        return baos.toByteArray();
    }

    // ── Landscape-optimized styled header ──
    private void addStyledHeader(PdfPTable table, String[] headers, java.awt.Color bgColor, Font font) {
        for (String header : headers) {
            PdfPCell cell = new PdfPCell(new Phrase(header, font));
            cell.setBackgroundColor(bgColor);
            cell.setPadding(6f);
            cell.setHorizontalAlignment(Element.ALIGN_CENTER);
            cell.setBorder(Rectangle.NO_BORDER);
            table.addCell(cell);
        }
    }

    // ── Employee info rows for landscape layout ──
    private void addLandscapeInfoCell(PdfPTable table, String label, String value, Font labelFont, Font valueFont) {
        PdfPCell labelCell = new PdfPCell(new Phrase(label, labelFont));
        labelCell.setBorder(Rectangle.NO_BORDER);
        labelCell.setPadding(2f);
        labelCell.setPaddingLeft(0f);
        labelCell.setFixedHeight(17f);
        labelCell.setHorizontalAlignment(Element.ALIGN_LEFT);
        table.addCell(labelCell);

        PdfPCell valueCell = new PdfPCell(new Phrase(value, valueFont));
        valueCell.setBorder(Rectangle.NO_BORDER);
        valueCell.setPadding(2f);
        valueCell.setFixedHeight(17f);
        table.addCell(valueCell);
    }

    // ── Earnings row ──
    private void addAmountRow(PdfPTable table, String label, BigDecimal rate, BigDecimal hours, BigDecimal amount, Font font) {
        table.addCell(new Phrase(label, font));
        PdfPCell rateCell = new PdfPCell(new Phrase(
                rate != null ? "ZMW " + rate.setScale(2, java.math.RoundingMode.HALF_UP).toPlainString() : "-", font));
        rateCell.setHorizontalAlignment(Element.ALIGN_RIGHT);
        table.addCell(rateCell);
        PdfPCell hoursCell = new PdfPCell(new Phrase(
                hours != null ? hours.stripTrailingZeros().toPlainString() : "0", font));
        hoursCell.setHorizontalAlignment(Element.ALIGN_RIGHT);
        table.addCell(hoursCell);
        PdfPCell amountCell = new PdfPCell(new Phrase(
                NumberFormat.getCurrencyInstance(new Locale("en", "ZM")).format(amount != null ? amount : BigDecimal.ZERO),
                font));
        amountCell.setHorizontalAlignment(Element.ALIGN_RIGHT);
        table.addCell(amountCell);
    }

    // ── Deduction row with rate column ──
    private void addDeductionRow(PdfPTable table, String label, String rateStr, BigDecimal amount, Font font, NumberFormat fmt) {
        table.addCell(new Phrase(label, font));
        PdfPCell rateCell = new PdfPCell(new Phrase(rateStr != null && !rateStr.isEmpty() ? rateStr : "", font));
        rateCell.setHorizontalAlignment(Element.ALIGN_CENTER);
        table.addCell(rateCell);
        PdfPCell amountCell = new PdfPCell(new Phrase(fmt.format(amount != null ? amount : BigDecimal.ZERO), font));
        amountCell.setHorizontalAlignment(Element.ALIGN_RIGHT);
        table.addCell(amountCell);
    }

    // ── Total row with background highlight ──
    private void addStyledTotalRow(PdfPTable table, String label, BigDecimal amount, NumberFormat fmt, Font font, java.awt.Color bgColor) {
        int cols = table.getNumberOfColumns();

        for (int i = 0; i < cols - 1; i++) {
            PdfPCell cell;
            if (i == 0) {
                cell = new PdfPCell(new Phrase(label, font));
            } else {
                cell = new PdfPCell(new Phrase("", font));
            }
            cell.setBorder(Rectangle.TOP);
            cell.setBorderColor(new java.awt.Color(13, 71, 161));
            cell.setPaddingTop(5f);
            cell.setPaddingBottom(3f);
            cell.setBackgroundColor(bgColor);
            table.addCell(cell);
        }

        PdfPCell amountCell = new PdfPCell(new Phrase(fmt.format(amount), font));
        amountCell.setHorizontalAlignment(Element.ALIGN_RIGHT);
        amountCell.setBorder(Rectangle.TOP);
        amountCell.setBorderColor(new java.awt.Color(13, 71, 161));
        amountCell.setPaddingTop(5f);
        amountCell.setPaddingBottom(3f);
        amountCell.setBackgroundColor(bgColor);
        table.addCell(amountCell);
    }

    private String formatPercent(PayrollEntry entry, java.util.function.Function<PayrollEntry, BigDecimal> extractor,
                                  BigDecimal total) {
        BigDecimal val = extractor.apply(entry);
        if (val == null || total.compareTo(BigDecimal.ZERO) == 0) return "0%";
        return val.multiply(BigDecimal.valueOf(100))
                .divide(total, 1, java.math.RoundingMode.HALF_UP)
                .stripTrailingZeros().toPlainString() + "%";
    }

    @Override
    public Map<String, Object> emailAllPayslipsForRun(UUID payrollRunId) {
        List<Payslip> payslips = payslipRepository.findByPayrollRunId(payrollRunId);

        if (payslips.isEmpty()) {
            throw new BusinessRuleException("No payslips found for this payroll run. Generate payslips first.");
        }

        int total = payslips.size();
        int succeeded = 0;
        List<Map<String, String>> errors = new ArrayList<>();

        for (Payslip payslip : payslips) {
            try {
                PayrollEntry entry = payslip.getPayrollEntry();
                String employeeEmail = entry.getEmployee().getEmail();
                String employeeName = entry.getEmployee().getFirstName() + " " + entry.getEmployee().getLastName();

                if (employeeEmail == null || employeeEmail.isBlank()) {
                    errors.add(Map.of(
                            "employee", employeeName,
                            "error", "No email address on file"
                    ));
                    continue;
                }

                byte[] pdf = downloadPayslip(payslip.getId());
                String monthYear = MONTH_NAMES[entry.getPayrollRun().getMonth() - 1]
                        + " " + entry.getPayrollRun().getYear();
                String subject = "Payslip for " + monthYear;
                String text = "Dear " + employeeName + ",\n\nPlease find your payslip for "
                        + monthYear + " attached.\n\nRegards,\nMusunga Engineering Payroll";

                emailService.sendPayslipEmail(employeeEmail, subject, text, pdf, "payslip.pdf");

                payslip.setEmailedAt(LocalDateTime.now());
                payslipRepository.save(payslip);
                succeeded++;
            } catch (Exception e) {
                log.error("Failed to email payslip {}: {}", payslip.getId(), e.getMessage());
                errors.add(Map.of(
                        "payslipId", payslip.getId().toString(),
                        "error", e.getMessage()
                ));
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("total", total);
        result.put("succeeded", succeeded);
        result.put("failed", total - succeeded);
        result.put("errors", errors);
        return result;
    }

    @Override
    @Transactional
    public void invalidatePayslipsForRun(UUID payrollRunId) {
        List<Payslip> payslips = payslipRepository.findByPayrollRunId(payrollRunId);
        for (Payslip payslip : payslips) {
            // Mark as invalid by clearing the pdfPath and setting generatedAt to null
            // New payslips will be generated on next approval
            payslip.setPdfPath(null);
            payslip.setGeneratedAt(null);
            payslip.setEmailedAt(null);
            payslipRepository.save(payslip);
        }
        log.info("Invalidated {} payslips for payroll run {}", payslips.size(), payrollRunId);
    }

    @Override
    @Transactional
    public void emailPayslip(UUID id) {
        Payslip payslip = getPayslipById(id);
        PayrollEntry entry = payslip.getPayrollEntry();
        String employeeEmail = entry.getEmployee().getEmail();
        String employeeName = entry.getEmployee().getFirstName() + " " + entry.getEmployee().getLastName();

        String subject = "Payslip for " + entry.getPayrollRun().getMonth() + "/" + entry.getPayrollRun().getYear();
        String text = "Dear " + employeeName + ",\n\nPlease find your payslip attached.";

        byte[] pdf = downloadPayslip(id);
        emailService.sendPayslipEmail(employeeEmail, subject, text, pdf, "payslip.pdf");

        payslip.setEmailedAt(LocalDateTime.now());
        payslipRepository.save(payslip);
    }

    @Override
    public byte[] downloadPayslipsByMonth(int month, int year) {
        List<Payslip> payslips = payslipRepository.findByMonthAndYear(month, year);

        if (payslips.isEmpty()) {
            throw new BusinessRuleException("No payslips found for " + MONTH_NAMES[month - 1] + " " + year);
        }

        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            try (ZipOutputStream zos = new ZipOutputStream(baos)) {
                for (Payslip payslip : payslips) {
                    String pdfPath = payslip.getPdfPath();
                    if (pdfPath == null) {
                        log.warn("Payslip {} has no PDF file — skipping", payslip.getId());
                        continue;
                    }

                    try {
                        var resource = fileStorageService.loadFile(pdfPath);
                        byte[] pdfBytes;
                        try (var is = resource.getInputStream()) {
                            pdfBytes = is.readAllBytes();
                        }

                        String employeeName = payslip.getPayrollEntry().getEmployee().getFirstName()
                                + "_" + payslip.getPayrollEntry().getEmployee().getLastName();
                        String entryName = employeeName + ".pdf";

                        ZipEntry zipEntry = new ZipEntry(entryName);
                        zipEntry.setSize(pdfBytes.length);
                        zos.putNextEntry(zipEntry);
                        zos.write(pdfBytes);
                        zos.closeEntry();
                    } catch (IOException e) {
                        log.error("Failed to read payslip {}: {}", payslip.getId(), e.getMessage());
                    }
                }
            }
            return baos.toByteArray();
        } catch (IOException e) {
            throw new RuntimeException("Failed to create ZIP file", e);
        }
    }

    @Override
    public byte[] downloadPayslipsZip(UUID payrollRunId) {
        List<Payslip> payslips = payslipRepository.findByPayrollRunId(payrollRunId);

        if (payslips.isEmpty()) {
            throw new BusinessRuleException("No payslips found for this payroll run.");
        }

        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            try (ZipOutputStream zos = new ZipOutputStream(baos)) {
                for (Payslip payslip : payslips) {
                    String pdfPath = payslip.getPdfPath();
                    if (pdfPath == null) {
                        log.warn("Payslip {} has no PDF file — skipping", payslip.getId());
                        continue;
                    }

                    try {
                        var resource = fileStorageService.loadFile(pdfPath);
                        byte[] pdfBytes;
                        try (var is = resource.getInputStream()) {
                            pdfBytes = is.readAllBytes();
                        }

                        String employeeName = payslip.getPayrollEntry().getEmployee().getFirstName()
                                + "_" + payslip.getPayrollEntry().getEmployee().getLastName();
                        String monthYear = MONTH_NAMES[payslip.getPayrollEntry().getPayrollRun().getMonth() - 1]
                                + "_" + payslip.getPayrollEntry().getPayrollRun().getYear();
                        String entryName = employeeName + "_" + monthYear + ".pdf";

                        ZipEntry zipEntry = new ZipEntry(entryName);
                        zipEntry.setSize(pdfBytes.length);
                        zos.putNextEntry(zipEntry);
                        zos.write(pdfBytes);
                        zos.closeEntry();
                    } catch (IOException e) {
                        log.error("Failed to read payslip {}: {}", payslip.getId(), e.getMessage());
                    }
                }
            }
            return baos.toByteArray();
        } catch (IOException e) {
            throw new RuntimeException("Failed to create ZIP file", e);
        }
    }
}
