# Employee Import Feature — Specification

## 1. Overview

Create a new **employee import** feature that allows users to upload Excel files containing employee data and create/update employee records in the system. This is separate from the existing payroll import (which processes payroll entries), though it can also be integrated as a step within the payroll import flow.

## 2. Schema Changes

### 2.1 Email — Make Optional

- **DB**: Remove `NOT NULL` constraint from `employees.email` column. The `UNIQUE` constraint should also be removed or changed to a conditional unique (or handled at the application layer) since emails will be null for imported employees.
- **Java entity** (`Employee.java`): Remove `nullable = false` from the `@Column` annotation on `email`.
- **Java DTO** (`EmployeeRequest.java`): Remove `@NotBlank` validation on `email`.
- **Service** (`EmployeeServiceImpl.java`): Remove the duplicate email check in `createEmployee` and `updateEmployee` — or make it conditional (only check if email is provided).
- **Repository** (`EmployeeRepository.java`): Update `existsByEmail` usage to handle null.

### 2.2 Add `sort_code` Field

- **DB**: Add a new `sort_code VARCHAR(50)` column to the `employees` table (nullable).
- **Java entity** (`Employee.java`): Add a new field:
  ```java
  @Column(name = "sort_code", length = 50)
  private String sortCode;
  ```
- **Keep existing** `bankName` field as-is.

### 2.3 Migration

Create `V7__add_sort_code_and_make_email_optional.sql`:

```sql
-- Make email optional
ALTER TABLE employees ALTER COLUMN email DROP NOT NULL;
ALTER TABLE employees DROP CONSTRAINT employees_email_key;
CREATE UNIQUE INDEX idx_employees_email ON employees(email) WHERE email IS NOT NULL;

-- Add sort code column
ALTER TABLE employees ADD COLUMN IF NOT EXISTS sort_code VARCHAR(50);
```

## 3. Employee Import Template (.xlsx Format)

A dedicated Excel template for employee imports. The template should have one header row and data rows below it.

### 3.1 Columns

| Column | Header           | Required | Description                              |
|--------|------------------|----------|------------------------------------------|
| A      | NAMES            | Yes      | Employee full name (e.g., "KELIES CHIKUMBI") |
| B      | NRC              | Yes      | National Registration Card number        |
| C      | JOB TITLE        | No       | Job position                             |
| D      | SITE             | No       | Work site/location                       |
| E      | RATE/HRS         | No       | Basic salary or hourly rate              |
| F      | SORT CODE        | No       | Bank sort code (branch identifier)       |
| G      | ACCOUNT NUMBER   | No       | Bank account number                      |
| H      | PHONE            | No       | Phone number                             |
| I      | DEPARTMENT       | No       | Department name (matched to DB)          |
| J      | EMPLOYMENT TYPE  | No       | FULL_TIME, PART_TIME, or CONTRACT        |
| K      | SALARY TYPE      | No       | MONTHLY or HOURLY                        |
| L      | DATE HIRED       | No       | Date of hire (DD/MM/YYYY format)         |

### 3.2 Template Structure

The .xlsx file should contain a single sheet named "EMPLOYEES" with:
- **Row 1**: Column headers (as above)
- **Row 2+**: Data rows

An empty template file should be downloadable from the UI.

## 4. Name Parsing

The `NAMES` column contains the full name (e.g., "KELIES CHIKUMBI").

- **Rule**: Split the full name on the **first space**.
  - "KELIES CHIKUMBI" → firstName: "KELIES", lastName: "CHIKUMBI"
  - "JOHN PAUL SMITH" → firstName: "JOHN", lastName: "PAUL SMITH"
  - Names with no space → firstName is the full name, lastName is ""

## 5. Auto-Generated Defaults

When a field is not provided in the import file, use these defaults:

| Field            | Default Value                    |
|------------------|----------------------------------|
| employeeNumber   | Auto-generated (EMP-XXXX format) |
| email            | null                             |
| phone            | null                             |
| department       | "General" (auto-created if missing) |
| position         | As provided or empty             |
| site             | As provided or empty             |
| employmentType   | FULL_TIME                        |
| salaryType       | MONTHLY                          |
| sortCode         | As provided or empty             |
| accountNumber    | As provided or empty             |
| dateHired        | Current date (LocalDate.now())   |
| rate             | As provided or 0.00             |
| status           | ACTIVE                           |

## 6. Matching & Deduplication

- **Matching key**: NRC (National Registration Card number).
- When a row has an NRC that **already exists** in the database, **update all fields** on the existing employee with the new values from the import (position, site, rate, sortCode, accountNumber, etc.).
- When a row has an NRC that **does not exist**, **create a new employee**.
- If NRC is missing or empty → skip the row and report as an error.

## 7. Error Handling

- **Strategy**: Skip bad rows, continue processing, and return a detailed list of which rows failed and why.
- **Errors to catch**:
  - Missing NRC
  - Missing/empty NAMES
  - Invalid employment type (not one of FULL_TIME, PART_TIME, CONTRACT)
  - Invalid salary type (not one of MONTHLY, HOURLY)
  - Invalid rate (non-numeric value)
  - Invalid date format (for DATE HIRED)
- **Response**: Return a count of total rows, success rows, error rows, **and a detailed error list** (row number + error message per failed row).

## 8. Backend API

### 8.1 New Endpoints

#### `POST /api/employees/import/upload`
Upload the employee import file (does not process it yet).

- **Request**: `multipart/form-data` with `file` field
- **Response**: `EmployeeImport` object with status `UPLOADED`

#### `POST /api/employees/import/{importId}/process`
Process the uploaded import file — parse rows, create/update employees.

- **Response**: `EmployeeImport` object with:
  - `totalRows`: Total rows processed
  - `successRows`: Successfully created/updated employees
  - `errorRows`: Rows with errors
  - `errors`: Array of `{ rowNumber, message }` for each failed row
  - `status`: `IMPORTED` or `FAILED`

#### `GET /api/employees/import/{importId}`
Get details of a specific import.

#### `GET /api/employees/import/by-user`
Get all imports by the current user, ordered by most recent.

#### `GET /api/employees/import/template`
Download the employee import template (.xlsx).

### 8.2 New Entity: `EmployeeImport`

Similar to `PayrollImport` but for employee data. Fields:
- `id` (UUID)
- `fileName` (String)
- `filePath` (String)
- `totalRows` (Integer)
- `successRows` (Integer)
- `errorRows` (Integer)
- `errors` (String/JSON — serialized list of errors)
- `status` (ImportStatus: UPLOADED, IMPORTED, FAILED)
- `createdBy` (User)
- `createdAt` (LocalDateTime)

### 8.3 New Service: `EmployeeImportService`

Interface and implementation for handling employee imports.

### 8.4 Reuse Existing Logic

- Reuse `FileStorageService` for storing uploaded files.
- Reuse `EmployeeService.createEmployee` / `updateEmployee` logic (or bypass for bulk operations).
- Reuse name generation logic from `EmployeeService.generateEmployeeNumber()`.

## 9. Frontend

### 9.1 New Page: Employee Import

A new page at `/employees/import` with a wizard-style flow:

**Step 1: Download Template**
- Show a button to download the employee import template (.xlsx)
- Brief explanation of the import process

**Step 2: Upload File**
- File upload area (accepts .xlsx)
- Validate file type on client side

**Step 3: Review Results**
- Show import summary: total rows, success, errors
- Show a table of any errors (row number + message)
- Button to proceed or cancel

**Step 4: Complete**
- Success message
- Button to view all employees or import another file

### 9.2 Integration with Existing Payroll Import

- On the payroll import flow (PayrollImport page), add an option to auto-create missing employees from the uploaded file before processing payroll entries.
- When enabled, any unmatched employees in the payroll data (existing behavior: "errorRows++") will instead trigger employee creation using the same template parsing logic.

### 9.3 Navigation

- Add a sidebar link under "Employees" → "Import Employees" (or similar).
- Alternatively, add an "Import" button on the Employees list page.

## 10. Backend Implementation Details

### 10.1 Excel Parsing

- Use Apache POI (already a dependency) to read the .xlsx file.
- Parse the "EMPLOYEES" sheet (or the first sheet if not found).
- Read header row (row 1) to map columns by name (for flexibility with column order).
- Process data starting from row 2.

### 10.2 Transaction Handling

- The entire import should be wrapped in a transaction.
- If a RuntimeException occurs (file read error, etc.), roll back the entire import.
- Individual row errors should NOT roll back the entire import — only skip that row.

### 10.3 Department Auto-Creation

- If the DEPARTMENT column is empty, assign the employee to the "General" department.
- If "General" doesn't exist, create it: `{ name: "General", description: "Default department for imported employees" }`.

## 11. Open Questions / Future Considerations

- Should we support CSV format as well, or only .xlsx?
- Should the employee import log audit events for each created/updated employee?
- Should the template include an optional `EMPLOYEE NUMBER` column for overriding auto-generation?
- Should we email notifications when employees are created via import?

---

## Appendix: Interview Answers Summary

| # | Question | Answer |
|---|----------|--------|
| 1 | Name parsing strategy | Split on first space |
| 2 | Handling missing template fields | Auto-generate sensible defaults |
| 3 | Duplicate NRC handling | Skip duplicates (update existing) |
| 4 | bank_name → sort_code | Keep bank_name, add separate sort_code column |
| 5 | Default values presets | Use sensible system defaults for missing fields |
| 6 | Email placeholder generation | Leave as empty/null (make DB column nullable) |
| 7 | Flow: standalone or integrated | Both — separate employee import page + payroll import can auto-create employees |
| 8 | Process payroll data too? | Employees only — ignore payroll calculation columns |
| 9 | Matching key for existing employees | NRC only |
| 10 | Field naming decision | Keep existing bank_name, add new sort_code column |
| 11 | Upload format | Separate employee-specific template (not the PAYROLL TEMPLATE) |
| 12 | Default department for imports | Create/use a 'General' department |
| 13 | Template columns | Full employee fields (names, nrc, job title, site, rate, sort code, account number, phone, department, employment type, salary type, date hired) |
| 14 | Error handling strategy | Skip bad rows + show detailed error list per row |
| 15 | Update existing employees | Update all fields if NRC matches |
