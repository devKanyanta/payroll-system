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
        Document document = new Document(PageSize.A4);
        PdfWriter.getInstance(document, baos);
        document.open();

        // --- Company Header ---
        Font titleFont = new Font(Font.HELVETICA, 18, Font.BOLD);
        Font headerFont = new Font(Font.HELVETICA, 12, Font.BOLD);
        Font normalFont = new Font(Font.HELVETICA, 10, Font.NORMAL);
        Font boldFont = new Font(Font.HELVETICA, 10, Font.BOLD);
        Font highlightFont = new Font(Font.HELVETICA, 14, Font.BOLD);
        java.awt.Color navyColor = new java.awt.Color(13, 71, 161);

        // Try to load and embed the MSL logo
        try {
            InputStream logoStream = new ClassPathResource("MSL.png").getInputStream();
            byte[] logoBytes = logoStream.readAllBytes();
            Image logo = Image.getInstance(logoBytes);
            logo.scaleToFit(120, 50);
            logo.setAlignment(Element.ALIGN_LEFT);

            // Company name beside the logo
            PdfPTable headerTable = new PdfPTable(2);
            headerTable.setWidthPercentage(100);
            headerTable.setWidths(new float[]{1, 4});
            headerTable.getDefaultCell().setBorder(Rectangle.NO_BORDER);
            headerTable.getDefaultCell().setPadding(2f);

            PdfPCell logoCell = new PdfPCell(logo);
            logoCell.setBorder(Rectangle.NO_BORDER);
            logoCell.setVerticalAlignment(Element.ALIGN_MIDDLE);
            headerTable.addCell(logoCell);

            PdfPCell nameCell = new PdfPCell();
            nameCell.setBorder(Rectangle.NO_BORDER);
            nameCell.setVerticalAlignment(Element.ALIGN_MIDDLE);
            Paragraph companyName = new Paragraph("Musunga Engineering Services Ltd",
                    new Font(Font.HELVETICA, 14, Font.BOLD, navyColor));
            companyName.setSpacingAfter(2f);
            nameCell.addElement(companyName);
            Paragraph companyTagline = new Paragraph("Payroll Department",
                    new Font(Font.HELVETICA, 10, Font.NORMAL, new java.awt.Color(100, 100, 100)));
            nameCell.addElement(companyTagline);
            headerTable.addCell(nameCell);

            document.add(headerTable);
        } catch (Exception e) {
            // Fallback: just show company name if logo can't be loaded
            Paragraph companyFallback = new Paragraph("Musunga Engineering Services Ltd",
                    new Font(Font.HELVETICA, 14, Font.BOLD, navyColor));
            companyFallback.setAlignment(Element.ALIGN_CENTER);
            document.add(companyFallback);
        }

        // --- Separator line in navy ---
        Paragraph navSeparator = new Paragraph();
        navSeparator.setSpacingBefore(10f);
        navSeparator.setSpacingAfter(10f);
        Chunk line = new Chunk(new com.lowagie.text.pdf.draw.LineSeparator(1f, 100, navyColor, Element.ALIGN_CENTER, -2f));
        navSeparator.add(line);
        document.add(navSeparator);

        // --- Title ---
        Paragraph title = new Paragraph("PAYSLIP", titleFont);
        title.setAlignment(Element.ALIGN_CENTER);
        document.add(title);

        Paragraph period = new Paragraph(
                MONTH_NAMES[payrollRun.getMonth() - 1] + " " + payrollRun.getYear(),
                headerFont);
        period.setAlignment(Element.ALIGN_CENTER);
        period.setSpacingAfter(20f);
        document.add(period);

        // --- Employee Details ---
        PdfPTable infoTable = new PdfPTable(2);
        infoTable.setWidthPercentage(100);
        infoTable.setSpacingAfter(15f);
        infoTable.getDefaultCell().setBorder(Rectangle.NO_BORDER);
        infoTable.getDefaultCell().setPadding(2f);

        addInfoCell(infoTable, "Employee:", employee.getFirstName() + " " + employee.getLastName(), boldFont, normalFont);
        addInfoCell(infoTable, "Employee #:", employee.getEmployeeNumber(), boldFont, normalFont);
        addInfoCell(infoTable, "Department:",
                employee.getDepartment() != null ? employee.getDepartment().getName() : "-", boldFont, normalFont);
        addInfoCell(infoTable, "Position:",
                employee.getPosition() != null ? employee.getPosition() : "-", boldFont, normalFont);
        addInfoCell(infoTable, "NRC:", employee.getNrc(), boldFont, normalFont);
        addInfoCell(infoTable, "Site:",
                entry.getSite() != null ? entry.getSite() : "-", boldFont, normalFont);
        addInfoCell(infoTable, "Bank:",
                employee.getBankName() != null ? employee.getBankName() + " / " +
                        (employee.getAccountNumber() != null ? employee.getAccountNumber() : "-") : "-",
                boldFont, normalFont);

        // Add loan balance to employee info if present
        BigDecimal loanBal = entry.getLoanBalance() != null ? entry.getLoanBalance() : BigDecimal.ZERO;
        BigDecimal loanDed = entry.getLoanDeduction() != null ? entry.getLoanDeduction() : BigDecimal.ZERO;
        if (loanBal.compareTo(BigDecimal.ZERO) > 0 || loanDed.compareTo(BigDecimal.ZERO) > 0) {
            addInfoCell(infoTable, "Loan Balance:", fmt.format(loanBal), boldFont, normalFont);
            addInfoCell(infoTable, "Monthly Deduction:", fmt.format(loanDed), boldFont, normalFont);
        }

        document.add(infoTable);

        // --- Separator ---
        Paragraph separator = new Paragraph(new Chunk(new com.lowagie.text.pdf.draw.LineSeparator()));
        separator.setSpacingAfter(10f);
        document.add(separator);

        // --- Earnings Table ---
        PdfPTable earningsTable = createStyledTable(new float[]{3, 1, 1, 1});
        earningsTable.setSpacingAfter(10f);
        addTableHeader(earningsTable, new String[]{"Earnings", "Rate/Hr", "Hours/Days", "Amount"}, headerFont);

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

        addTotalRow(earningsTable, "Gross Salary", totalEarnings, fmt, boldFont);
        document.add(earningsTable);

        // --- Deductions Table ---
        PdfPTable deductionsTable = createStyledTable(new float[]{3, 1, 1});
        deductionsTable.setSpacingAfter(10f);
        addTableHeader(deductionsTable, new String[]{"Deductions", "", "Amount"}, headerFont);

        addDeductionRow(deductionsTable, "NHIMA (" + formatPercent(entry, e -> e.getNhima(), totalEarnings) + ")",
                entry.getNhima(), normalFont, fmt);
        addDeductionRow(deductionsTable, "NAPSA (" + formatPercent(entry, e -> e.getNapsa(), totalEarnings) + ")",
                entry.getNapsa(), normalFont, fmt);

        BigDecimal loan = entry.getLoanDeduction() != null ? entry.getLoanDeduction() : BigDecimal.ZERO;
        if (loan.compareTo(BigDecimal.ZERO) > 0) {
            addDeductionRow(deductionsTable, "Loan Deduction", loan, normalFont, fmt);
        }
        BigDecimal other = entry.getOtherDeductions() != null ? entry.getOtherDeductions() : BigDecimal.ZERO;
        if (other.compareTo(BigDecimal.ZERO) > 0) {
            addDeductionRow(deductionsTable, "Other Deductions", other, normalFont, fmt);
        }

        BigDecimal totalDeductions = entry.getNhima()
                .add(entry.getNapsa())
                .add(loan)
                .add(other);

        addTotalRow(deductionsTable, "Total Deductions", totalDeductions, fmt, boldFont);
        document.add(deductionsTable);

        // --- Separator ---
        document.add(separator);

        // --- Net Salary (highlighted) ---
        Paragraph netLabel = new Paragraph("Net Salary", headerFont);
        netLabel.setSpacingBefore(5f);
        document.add(netLabel);

        Paragraph netAmount = new Paragraph(fmt.format(entry.getNetSalary()), highlightFont);
        netAmount.setSpacingAfter(20f);
        document.add(netAmount);

        // --- Footer ---
        Font footerFont = new Font(Font.HELVETICA, 8, Font.ITALIC);
        Paragraph footerCompany = new Paragraph(
                "Musunga Engineering Services Ltd",
                new Font(Font.HELVETICA, 9, Font.BOLD, navyColor));
        footerCompany.setAlignment(Element.ALIGN_CENTER);
        footerCompany.setSpacingAfter(2f);
        document.add(footerCompany);
        Paragraph footer = new Paragraph(
                "Generated on " + LocalDateTime.now().toLocalDate() + " | This is a computer-generated document.",
                footerFont);
        footer.setAlignment(Element.ALIGN_CENTER);
        document.add(footer);

        document.close();
        return baos.toByteArray();
    }

    private PdfPTable createStyledTable(float[] widths) {
        PdfPTable table = new PdfPTable(widths);
        table.setWidthPercentage(100);
        return table;
    }

    private void addTableHeader(PdfPTable table, String[] headers, Font font) {
        java.awt.Color navyColor = new java.awt.Color(13, 71, 161);
        Font whiteFont = new Font(Font.HELVETICA, 12, Font.BOLD, java.awt.Color.WHITE);
        for (String header : headers) {
            PdfPCell cell = new PdfPCell(new Phrase(header, whiteFont));
            cell.setBackgroundColor(navyColor);
            cell.setPadding(5f);
            cell.setHorizontalAlignment(header.equals("Earnings") || header.equals("Deductions")
                    ? Element.ALIGN_LEFT : Element.ALIGN_RIGHT);
            table.addCell(cell);
        }
    }

    private void addInfoCell(PdfPTable table, String label, String value, Font labelFont, Font valueFont) {
        PdfPCell labelCell = new PdfPCell(new Phrase(label, labelFont));
        labelCell.setBorder(Rectangle.NO_BORDER);
        labelCell.setPadding(2f);
        labelCell.setFixedHeight(18f);
        labelCell.setHorizontalAlignment(Element.ALIGN_RIGHT);
        // label column width is controlled by the table's column widths
        table.addCell(labelCell);

        PdfPCell valueCell = new PdfPCell(new Phrase(value, valueFont));
        valueCell.setBorder(Rectangle.NO_BORDER);
        valueCell.setPadding(2f);
        valueCell.setFixedHeight(18f);
        table.addCell(valueCell);
    }

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

    private void addDeductionRow(PdfPTable table, String label, BigDecimal amount, Font font, NumberFormat fmt) {
        table.addCell(new Phrase(label, font));
        PdfPCell emptyCell = new PdfPCell(new Phrase("", font));
        emptyCell.setBorder(Rectangle.NO_BORDER);
        table.addCell(emptyCell);
        PdfPCell amountCell = new PdfPCell(new Phrase(fmt.format(amount != null ? amount : BigDecimal.ZERO), font));
        amountCell.setHorizontalAlignment(Element.ALIGN_RIGHT);
        table.addCell(amountCell);
    }

    private void addTotalRow(PdfPTable table, String label, BigDecimal amount, NumberFormat fmt, Font font) {
        PdfPCell labelCell = new PdfPCell(new Phrase(label, font));
        labelCell.setBorder(Rectangle.TOP);
        labelCell.setPaddingTop(4f);
        table.addCell(labelCell);

        PdfPCell spacerCell = new PdfPCell(new Phrase("", font));
        spacerCell.setBorder(Rectangle.TOP);
        spacerCell.setPaddingTop(4f);
        table.addCell(spacerCell);

        PdfPCell amountCell = new PdfPCell(new Phrase(fmt.format(amount), font));
        amountCell.setHorizontalAlignment(Element.ALIGN_RIGHT);
        amountCell.setBorder(Rectangle.TOP);
        amountCell.setPaddingTop(4f);
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
