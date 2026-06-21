-- ============================================
-- Payroll Management System
-- Production Database Setup Script
-- ============================================
-- Usage:
--   1. Run as a PostgreSQL superuser (e.g. postgres):
--      psql -U postgres -f production-setup.sql
--
--   2. To run against an already-created database, skip the
--      first two sections and run from "CREATE EXTENSION" onward:
--      psql -U payroll_mapalo -d payroll_db -f production-setup.sql
--
-- IMPORTANT:
--   Change the database password below before running in production!
-- ============================================

BEGIN;

-- ============================================
-- 1. CREATE DATABASE USER (if not exists)
-- ============================================
-- Replace 'changeme_production_password' with a strong, generated password.
-- Store it securely in a password manager or vault.
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'payroll_mapalo') THEN
        CREATE ROLE payroll_mapalo WITH
            LOGIN
            NOSUPERUSER
            NOCREATEDB
            NOCREATEROLE
            INHERIT
            NOREPLICATION
            CONNECTION LIMIT -1
            PASSWORD 'changeme_production_password';
    END IF;
END
$$;

-- ============================================
-- 2. CREATE DATABASE (if not exists)
-- ============================================
-- Note: CREATE DATABASE cannot run inside a transaction block,
-- so we use a PL/pgSQL block outside the main transaction.
-- This section is intentionally outside the BEGIN/COMMIT block.
-- ============================================

-- SELECT 'CREATE DATABASE payroll_db'
-- WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'payroll_db')\gexec

-- Uncomment the line above or run separately:
--   psql -U postgres -c "CREATE DATABASE payroll_db OWNER payroll_mapalo;"

COMMIT;

-- ============================================
-- Now connect to the payroll_db and run:
--   psql -U payroll_mapalo -d payroll_db -f production-setup.sql
-- The rest assumes we are connected to payroll_db.
-- ============================================

\c payroll_db

BEGIN;

-- ============================================
-- 3. ENABLE EXTENSIONS
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 4. SCHEMA: USERS
-- ============================================
-- System users who log in to the payroll application.
-- Roles: ADMIN, HR, MANAGER
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN', 'HR', 'MANAGER')),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    failed_login_attempts INT NOT NULL DEFAULT 0,
    account_locked_until TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 5. SCHEMA: DEPARTMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 6. SCHEMA: EMPLOYEES
-- ============================================
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_number VARCHAR(20) NOT NULL UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20),
    nrc VARCHAR(20) NOT NULL,
    department_id UUID REFERENCES departments(id),
    position VARCHAR(200),
    employment_type VARCHAR(20) NOT NULL CHECK (employment_type IN ('FULL_TIME', 'PART_TIME', 'CONTRACT')),
    salary_type VARCHAR(20) NOT NULL CHECK (salary_type IN ('MONTHLY', 'HOURLY')),
    bank_name VARCHAR(200),
    account_number VARCHAR(50),
    date_hired DATE NOT NULL,
    basic_salary DECIMAL(12, 2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'TERMINATED')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 7. SCHEMA: LOANS
-- ============================================
CREATE TABLE IF NOT EXISTS loans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id),
    loan_amount DECIMAL(12, 2) NOT NULL,
    balance DECIMAL(12, 2) NOT NULL,
    interest_rate DECIMAL(5, 2) NOT NULL DEFAULT 0,
    monthly_deduction DECIMAL(12, 2) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'CANCELLED')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 8. SCHEMA: PAYROLL SETTINGS
-- ============================================
CREATE TABLE IF NOT EXISTS payroll_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    effective_date DATE NOT NULL,
    nhima_employee_percent DECIMAL(5, 2) NOT NULL,
    nhima_employer_percent DECIMAL(5, 2) NOT NULL,
    napsa_employee_percent DECIMAL(5, 2) NOT NULL,
    napsa_employer_percent DECIMAL(5, 2) NOT NULL,
    overtime_rate DECIMAL(4, 2) NOT NULL DEFAULT 1.50,
    holiday_rate DECIMAL(4, 2) NOT NULL DEFAULT 2.00,
    working_days_per_month INT NOT NULL DEFAULT 22,
    hours_per_day INT NOT NULL DEFAULT 8,
    napsa_max_earnings DECIMAL(12, 2),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 9. SCHEMA: TAX BRACKETS
-- ============================================
CREATE TABLE IF NOT EXISTS tax_brackets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    min_amount DECIMAL(12, 2) NOT NULL,
    max_amount DECIMAL(12, 2),
    tax_rate DECIMAL(5, 2) NOT NULL,
    effective_date DATE NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 10. SCHEMA: PAYROLL RUNS
-- ============================================
CREATE TABLE IF NOT EXISTS payroll_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    month INT NOT NULL CHECK (month >= 1 AND month <= 12),
    year INT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED')),
    created_by UUID NOT NULL REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    rejected_by UUID REFERENCES users(id),
    rejected_at TIMESTAMP,
    rejection_reason TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(month, year)
);

-- ============================================
-- 11. SCHEMA: PAYROLL IMPORTS
-- ============================================
CREATE TABLE IF NOT EXISTS payroll_imports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payroll_run_id UUID NOT NULL REFERENCES payroll_runs(id),
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    total_rows INT NOT NULL DEFAULT 0,
    success_rows INT NOT NULL DEFAULT 0,
    error_rows INT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'UPLOADED' CHECK (status IN ('UPLOADED', 'VALIDATED', 'IMPORTED', 'FAILED')),
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 12. SCHEMA: DEDUCTION TYPES
-- ============================================
CREATE TABLE IF NOT EXISTS deduction_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 13. SCHEMA: PAYROLL ENTRIES
-- ============================================
CREATE TABLE IF NOT EXISTS payroll_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payroll_run_id UUID NOT NULL REFERENCES payroll_runs(id),
    employee_id UUID NOT NULL REFERENCES employees(id),
    basic_salary DECIMAL(12, 2) NOT NULL,
    regular_hours DECIMAL(8, 2) DEFAULT 0,
    regular_amount DECIMAL(12, 2) DEFAULT 0,
    overtime_hours DECIMAL(8, 2) DEFAULT 0,
    overtime_amount DECIMAL(12, 2) DEFAULT 0,
    holiday_hours DECIMAL(8, 2) DEFAULT 0,
    holiday_amount DECIMAL(12, 2) DEFAULT 0,
    gross_salary DECIMAL(12, 2) NOT NULL,
    nhima DECIMAL(12, 2) NOT NULL DEFAULT 0,
    napsa DECIMAL(12, 2) NOT NULL DEFAULT 0,
    paye DECIMAL(12, 2) NOT NULL DEFAULT 0,
    loan_deduction DECIMAL(12, 2) DEFAULT 0,
    other_deductions DECIMAL(12, 2) DEFAULT 0,
    net_salary DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(payroll_run_id, employee_id)
);

-- ============================================
-- 14. SCHEMA: EMPLOYEE DEDUCTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS employee_deductions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payroll_entry_id UUID NOT NULL REFERENCES payroll_entries(id),
    deduction_type_id UUID NOT NULL REFERENCES deduction_types(id),
    amount DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 15. SCHEMA: PAYSLIPS
-- ============================================
CREATE TABLE IF NOT EXISTS payslips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payroll_entry_id UUID NOT NULL REFERENCES payroll_entries(id),
    pdf_path VARCHAR(500),
    generated_at TIMESTAMP,
    emailed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 16. SCHEMA: EXPENSES
-- ============================================
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item VARCHAR(255) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    remarks TEXT,
    expense_date DATE NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 17. SCHEMA: AUDIT LOGS
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(255) NOT NULL,
    entity_name VARCHAR(100) NOT NULL,
    entity_id VARCHAR(50),
    old_value TEXT,
    new_value TEXT,
    ip_address VARCHAR(45),
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 18. SCHEMA: NOTIFICATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'INFO',
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    link VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 19. SCHEMA: REFRESH TOKENS
-- ============================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    token VARCHAR(500) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 20. SCHEMA: PASSWORD RESET TOKENS
-- ============================================
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    token VARCHAR(500) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 21. INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_employee_number ON employees(employee_number);
CREATE INDEX IF NOT EXISTS idx_loans_employee ON loans(employee_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_status ON payroll_runs(status);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_month_year ON payroll_runs(month, year);
CREATE INDEX IF NOT EXISTS idx_payroll_entries_run ON payroll_entries(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_payroll_entries_employee ON payroll_entries(employee_id);
CREATE INDEX IF NOT EXISTS idx_payslips_entry ON payslips(payroll_entry_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_name, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_tax_brackets_effective ON tax_brackets(effective_date);
CREATE INDEX IF NOT EXISTS idx_payroll_settings_effective ON payroll_settings(effective_date);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);

-- ============================================
-- 22. SEED DATA: USERS
-- ============================================
-- These are DEVELOPMENT credentials. Generate new password
-- hashes for production using bcrypt and replace these.
-- ============================================
INSERT INTO users (id, first_name, last_name, email, password_hash, role, active)
VALUES
    (uuid_generate_v4(), 'System', 'Admin', 'admin@payroll.com', '$2a$10$QUsZiScZyHeEcWzF3/paxOcf8n5kEOI9nt9BE1VvuR.LrGpkyFwCG', 'ADMIN', TRUE)
ON CONFLICT (email) DO NOTHING;

-- ============================================
-- 23. SEED DATA: DEPARTMENTS
-- ============================================
INSERT INTO departments (id, name, description)
VALUES
    (uuid_generate_v4(), 'Human Resources', 'Human Resources Department'),
    (uuid_generate_v4(), 'Finance', 'Finance and Accounting'),
    (uuid_generate_v4(), 'Information Technology', 'IT Department'),
    (uuid_generate_v4(), 'Operations', 'Operations and Administration'),
    (uuid_generate_v4(), 'Sales & Marketing', 'Sales and Marketing Department')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 24. SEED DATA: TAX BRACKETS (Zambia PAYE)
-- ============================================
-- These are illustrative current rates. Verify with your
-- finance/accounts team before going live.
-- ============================================
INSERT INTO tax_brackets (id, min_amount, max_amount, tax_rate, effective_date)
VALUES
    (uuid_generate_v4(), 0, 4000.00, 0, '2024-01-01'),
    (uuid_generate_v4(), 4000.01, 8000.00, 20.00, '2024-01-01'),
    (uuid_generate_v4(), 8000.01, 20000.00, 30.00, '2024-01-01'),
    (uuid_generate_v4(), 20000.01, NULL, 37.50, '2024-01-01');

-- ============================================
-- 25. SEED DATA: PAYROLL SETTINGS (Zambia)
-- ============================================
INSERT INTO payroll_settings (id, effective_date, nhima_employee_percent, nhima_employer_percent, napsa_employee_percent, napsa_employer_percent, overtime_rate, holiday_rate, working_days_per_month, hours_per_day, napsa_max_earnings)
VALUES
    (uuid_generate_v4(), '2024-01-01', 1.00, 1.00, 5.00, 5.00, 1.50, 2.00, 22, 8, 10000.00);

-- ============================================
-- 26. SEED DATA: DEDUCTION TYPES
-- ============================================
INSERT INTO deduction_types (id, name, description, is_active)
VALUES
    (uuid_generate_v4(), 'Union Dues', 'Trade union membership fees', TRUE),
    (uuid_generate_v4(), 'Garnishment', 'Court-ordered wage garnishment', TRUE),
    (uuid_generate_v4(), 'Welfare Fund', 'Employee welfare contribution', TRUE),
    (uuid_generate_v4(), 'Transport Allowance Recovery', 'Recovery of transport advances', TRUE)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 27. SEED DATA: EMPLOYEES (Sample)
-- ============================================
INSERT INTO employees (id, employee_number, first_name, last_name, email, phone, nrc, department_id, position, employment_type, salary_type, bank_name, account_number, date_hired, basic_salary, status)
SELECT
    uuid_generate_v4(), 'EMP-001', 'Alice', 'Phiri', 'alice.phiri@company.com', '+260977100001', '100001/10/1', d.id, 'Software Engineer', 'FULL_TIME', 'MONTHLY', 'Zanaco', '1234567890', '2023-01-15', 15000.00, 'ACTIVE'
FROM departments d WHERE d.name = 'Information Technology'
ON CONFLICT (employee_number) DO NOTHING;

INSERT INTO employees (id, employee_number, first_name, last_name, email, phone, nrc, department_id, position, employment_type, salary_type, bank_name, account_number, date_hired, basic_salary, status)
SELECT
    uuid_generate_v4(), 'EMP-002', 'Bob', 'Mwila', 'bob.mwila@company.com', '+260977100002', '100002/10/1', d.id, 'Accountant', 'FULL_TIME', 'MONTHLY', 'Stanbic', '2234567890', '2023-03-01', 12000.00, 'ACTIVE'
FROM departments d WHERE d.name = 'Finance'
ON CONFLICT (employee_number) DO NOTHING;

INSERT INTO employees (id, employee_number, first_name, last_name, email, phone, nrc, department_id, position, employment_type, salary_type, bank_name, account_number, date_hired, basic_salary, status)
SELECT
    uuid_generate_v4(), 'EMP-003', 'Carol', 'Banda', 'carol.banda@company.com', '+260977100003', '100003/10/1', d.id, 'HR Officer', 'FULL_TIME', 'MONTHLY', 'ABSA', '3234567890', '2023-02-01', 10000.00, 'ACTIVE'
FROM departments d WHERE d.name = 'Human Resources'
ON CONFLICT (employee_number) DO NOTHING;

INSERT INTO employees (id, employee_number, first_name, last_name, email, phone, nrc, department_id, position, employment_type, salary_type, bank_name, account_number, date_hired, basic_salary, status)
SELECT
    uuid_generate_v4(), 'EMP-004', 'David', 'Zulu', 'david.zulu@company.com', '+260977100004', '100004/10/1', d.id, 'Operations Manager', 'FULL_TIME', 'MONTHLY', 'Zanaco', '4234567890', '2022-06-01', 18000.00, 'ACTIVE'
FROM departments d WHERE d.name = 'Operations'
ON CONFLICT (employee_number) DO NOTHING;

INSERT INTO employees (id, employee_number, first_name, last_name, email, phone, nrc, department_id, position, employment_type, salary_type, bank_name, account_number, date_hired, basic_salary, status)
SELECT
    uuid_generate_v4(), 'EMP-005', 'Eve', 'Kasonde', 'eve.kasonde@company.com', '+260977100005', '100005/10/1', d.id, 'Sales Representative', 'FULL_TIME', 'MONTHLY', 'Stanbic', '5234567890', '2024-01-10', 8000.00, 'ACTIVE'
FROM departments d WHERE d.name = 'Sales & Marketing'
ON CONFLICT (employee_number) DO NOTHING;

INSERT INTO employees (id, employee_number, first_name, last_name, email, phone, nrc, department_id, position, employment_type, salary_type, bank_name, account_number, date_hired, basic_salary, status)
SELECT
    uuid_generate_v4(), 'EMP-006', 'Frank', 'Tembo', 'frank.tembo@company.com', '+260977100006', '100006/10/1', d.id, 'Network Administrator', 'FULL_TIME', 'MONTHLY', 'ABSA', '6234567890', '2024-03-15', 11000.00, 'ACTIVE'
FROM departments d WHERE d.name = 'Information Technology'
ON CONFLICT (employee_number) DO NOTHING;

INSERT INTO employees (id, employee_number, first_name, last_name, email, phone, nrc, department_id, position, employment_type, salary_type, bank_name, account_number, date_hired, basic_salary, status)
SELECT
    uuid_generate_v4(), 'EMP-007', 'Grace', 'Chanda', 'grace.chanda@company.com', '+260977100007', '100007/10/1', d.id, 'Marketing Specialist', 'PART_TIME', 'HOURLY', 'Zanaco', '7234567890', '2024-05-01', 4500.00, 'ACTIVE'
FROM departments d WHERE d.name = 'Sales & Marketing'
ON CONFLICT (employee_number) DO NOTHING;

-- ============================================
-- 28. GRANT PERMISSIONS
-- ============================================
-- These ensure payroll_mapalo can read/write all data.
-- Sequences are granted separately for SERIAL columns (none here, but for completeness).
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO payroll_mapalo;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO payroll_mapalo;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO payroll_mapalo;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO payroll_mapalo;

COMMIT;

-- ============================================
-- 29. VERIFICATION QUERIES
-- ============================================
-- Run these after setup to confirm everything is in place.
-- ============================================
-- \dt                     -- list all tables
-- SELECT count(*) FROM users;
-- SELECT count(*) FROM departments;
-- SELECT count(*) FROM employees;
-- SELECT count(*) FROM tax_brackets;
-- SELECT count(*) FROM payroll_settings;
-- SELECT count(*) FROM deduction_types;
