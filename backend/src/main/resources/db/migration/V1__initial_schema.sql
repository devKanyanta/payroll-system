-- ============================================
-- Payroll Management System - Initial Schema
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS
-- ============================================
CREATE TABLE users (
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
-- DEPARTMENTS
-- ============================================
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- EMPLOYEES
-- ============================================
CREATE TABLE employees (
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
-- LOANS
-- ============================================
CREATE TABLE loans (
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
-- PAYROLL SETTINGS
-- ============================================
CREATE TABLE payroll_settings (
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
-- TAX BRACKETS
-- ============================================
CREATE TABLE tax_brackets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    min_amount DECIMAL(12, 2) NOT NULL,
    max_amount DECIMAL(12, 2),
    tax_rate DECIMAL(5, 2) NOT NULL,
    effective_date DATE NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- PAYROLL RUNS
-- ============================================
CREATE TABLE payroll_runs (
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
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- PAYROLL IMPORTS
-- ============================================
CREATE TABLE payroll_imports (
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
-- DEDUCTION TYPES
-- ============================================
CREATE TABLE deduction_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- PAYROLL ENTRIES
-- ============================================
CREATE TABLE payroll_entries (
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
-- EMPLOYEE DEDUCTIONS (per payroll entry)
-- ============================================
CREATE TABLE employee_deductions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payroll_entry_id UUID NOT NULL REFERENCES payroll_entries(id),
    deduction_type_id UUID NOT NULL REFERENCES deduction_types(id),
    amount DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- PAYSLIPS
-- ============================================
CREATE TABLE payslips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payroll_entry_id UUID NOT NULL REFERENCES payroll_entries(id),
    pdf_path VARCHAR(500),
    generated_at TIMESTAMP,
    emailed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- EXPENSES
-- ============================================
CREATE TABLE expenses (
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
-- AUDIT LOGS
-- ============================================
CREATE TABLE audit_logs (
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
-- NOTIFICATIONS
-- ============================================
CREATE TABLE notifications (
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
-- REFRESH TOKENS
-- ============================================
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    token VARCHAR(500) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- PASSWORD RESET TOKENS
-- ============================================
CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    token VARCHAR(500) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_employees_department ON employees(department_id);
CREATE INDEX idx_employees_status ON employees(status);
CREATE INDEX idx_employees_employee_number ON employees(employee_number);
CREATE INDEX idx_loans_employee ON loans(employee_id);
CREATE INDEX idx_loans_status ON loans(status);
CREATE INDEX idx_payroll_runs_status ON payroll_runs(status);
CREATE INDEX idx_payroll_runs_month_year ON payroll_runs(month, year);
CREATE INDEX idx_payroll_entries_run ON payroll_entries(payroll_run_id);
CREATE INDEX idx_payroll_entries_employee ON payroll_entries(employee_id);
CREATE INDEX idx_payslips_entry ON payslips(payroll_entry_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_name, entity_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(user_id, is_read);
CREATE INDEX idx_expenses_date ON expenses(expense_date);
CREATE INDEX idx_tax_brackets_effective ON tax_brackets(effective_date);
CREATE INDEX idx_payroll_settings_effective ON payroll_settings(effective_date);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX idx_password_reset_tokens_token ON password_reset_tokens(token);
