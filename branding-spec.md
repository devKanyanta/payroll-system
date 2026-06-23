# Branding Specification — Musunga Engineering Services Ltd (MESL)

> **Last updated:** June 23, 2026
> **Status:** Spec complete, pending implementation

---

## 1. Company Information

| Field | Value |
|-------|-------|
| **Full Name** | Musunga Engineering Services Limited |
| **Abbreviation** | MESL |
| **System Name** | "Musunga Engineering Payroll" |
| **Browser Tab Title** | `Musunga Engineering Payroll` |

---

## 2. Brand Colors

The brand palette uses **deep navy**, **bright orange**, and **white**.

### Hex Codes

| Role | Hex | Usage |
|------|-----|-------|
| **Primary (Navy)** | `#0D47A1` | Main brand color — sidebar background, primary buttons, headings, active states |
| **Primary Light** | `#1565C0` | Hover states, lighter accents |
| **Primary Dark** | `#002171` | Deeper navy for pressed states, gradients |
| **Secondary (Orange)** | `#FF6F00` | Accent color — highlights, notifications, warnings, selected items |
| **Secondary Light** | `#FFA040` | Orange hover states, subtle highlights |
| **Secondary Dark** | `#C43E00` | Pressed orange states |
| **White** | `#FFFFFF` | Text on navy backgrounds, card backgrounds in light mode |

### Color Application Guidelines

- **Primary (navy)** should dominate structural elements: sidebar, app bar buttons, primary action buttons.
- **Secondary (orange)** should be used sparingly for emphasis: notification badges, active menu items, call-to-action highlights.
- **White** should be the primary background in light mode, with navy text for readability.

---

## 3. Logo

| Detail | Value |
|--------|-------|
| **Source File** | `MSL.png` (located at project root) |
| **Favicon** | Keep current SVG favicon — do NOT convert MSL logo to favicon |

### Logo Placement

| Surface | Display | Notes |
|---------|---------|-------|
| **Login Page** | Full logo + company name | Centered above the login form |
| **Sidebar Header** | Compact logo + system name | Top of the sidebar, alongside "Musunga Engineering Payroll" |
| **App Bar** | Logo as part of the header branding | May be a compact version or just the system name |

---

## 4. Typography

- **Font Family:** Keep `"Inter", "Roboto", "Helvetica", "Arial", sans-serif`
- No changes to font stack
- Headings can use the same font with bold weights

---

## 5. Layout & Component Styling

### 5.1 Sidebar (Navy Background)

The sidebar should switch to a **navy background with white text**:

| Element | Style |
|---------|-------|
| Sidebar background | `#0D47A1` (navy) |
| Text color | `#FFFFFF` (white) |
| Selected/active item | Orange highlight (`#FF6F00`) |
| Hover state | Darker navy (`#002171`) or slight lightening |
| Icons | White, orange on active |
| Collapse/expand chevron | White |

### 5.2 App Bar

- Keep the current clean style (white in light mode, dark in dark mode)
- Orange accent can be used for the active indicator
- System name "Musunga Engineering Payroll" could appear in the app bar

### 5.3 Login Page

Keep the **minimal layout** — just recolor with MESL brand:

| Element | Style |
|---------|-------|
| Background | Current light gray (`#f1f5f9`) |
| Card | White with navy border accent or subtle navy top border |
| Logo | MSL logo displayed prominently above the form |
| System name | "Musunga Engineering Payroll" below logo |
| Primary button | Navy background (`#0D47A1`) |
| Links | Navy or orange |

### 5.4 Primary Buttons

- Background: Navy (`#0D47A1`)
- Hover: Darker navy (`#002171`)
- Text: White
- Active/selected/focus ring: Orange accent

### 5.5 Secondary / Outline Buttons

- Border: Navy
- Text: Navy
- Hover: Light blue background tint

---

## 6. Dark Mode

Dark mode should be **kept and adapted** to use MESL colors:

| Element | Style |
|---------|-------|
| Background | Dark navy/gray (`#0f172a` or `#1e293b`) |
| Cards | Dark paper (`#1e293b`) |
| Primary interactions | Navy (`#1565C0` or lighter) |
| Accents | Orange (`#FF6F00`) |
| Text | Light (current dark mode text colors) |

---

## 7. Email Templates

Update the **password reset email** (and any other transactional emails) to MESL branding:

| Element | Style |
|---------|-------|
| Header background | Navy (`#0D47A1`) |
| Header text | White |
| Body | White with dark text |
| Primary button/link | Navy or orange |
| Footer | Light gray with company name |

Include:
- MSL logo at the top of the email
- "Musunga Engineering Services Ltd" as the sender name
- Company contact details in footer (optional, per discussion)

---

## 8. Document Exports — PDF Payslips

Brand the **PDF payslips** with MESL identity:

| Element | Style |
|---------|-------|
| Header area | MSL logo + "Musunga Engineering Services Ltd" at top |
| Color accents | Navy lines, orange highlights where appropriate |
| Footer | Company name, possibly "Payroll Department" |

Note: The payroll Excel export (`PAYROLL TEMPLATE.xlsx`) and bank payment export (`BANK_PAYMENT_TEMPLATE.xlsx`) are **not** being branded — they use bank/provided templates.

---

## 9. MUI Theme Configuration

The `frontend/src/theme.js` file needs to be updated to reflect the new palette:

```js
primary: {
  main: '#0D47A1',    // deep navy
  light: '#1565C0',   // lighter navy
  dark: '#002171',    // darker navy
  contrastText: '#ffffff',
},
secondary: {
  main: '#FF6F00',    // bright orange
  light: '#FFA040',   // lighter orange
  dark: '#C43E00',    // darker orange
},
```

---

## 10. Files to Modify

| File | Changes |
|------|---------|
| `frontend/src/theme.js` | Update primary/secondary color palette to MESL colors |
| `frontend/src/layouts/Sidebar.jsx` | Navy background, white text, orange active state |
| `frontend/src/layouts/DashboardLayout.jsx` | Update branding elements, system name |
| `frontend/src/layouts/AuthLayout.jsx` | MSL logo + "Musunga Engineering Payroll" |
| `frontend/src/pages/Login.jsx` | Recolor to MESL scheme |
| `frontend/index.html` | Update title to "Musunga Engineering Payroll" |
| `frontend/src/service/impl/EmailServiceImpl.java` | Update email template colors to navy/orange, add MESL logo |
| `backend/src/main/java/com/payroll/service/impl/PayslipServiceImpl.java` | Add MSL logo/header to PDF payslips |
| `MSL.png` | Copy to appropriate location (e.g., `frontend/public/` and `backend/src/main/resources/`) |

---

## 11. Implementation Notes

- The MSL logo file (`MSL.png`) should be copied to both:
  - `frontend/public/MSL.png` (for the web UI)
  - `backend/src/main/resources/templates/` or similar (for email/PDF)
- For PDF generation, the logo may need to be converted to a byte array or embedded image
- The bank payment Excel template (`BANK_PAYMENT_TEMPLATE.xlsx`) should **not** be modified
- The payroll Excel export template (`PAYROLL TEMPLATE.xlsx`) should **not** be modified
- Ensure sufficient contrast ratios for accessibility with the navy + orange scheme
