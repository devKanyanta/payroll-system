-- ============================================
-- Seed Data for Payroll Management System
-- ============================================

-- ============================================
-- Seed Users
-- Each user has a unique, shareable password.
-- These are DEVELOPMENT/STAGING credentials only.
-- ============================================
-- Passwords:
--   Admin  -> Admin@123
--   HR     -> Hr@2024
--   Manager -> Manager@2024
-- ============================================
INSERT INTO users (id, first_name, last_name, email, password_hash, role, active)
VALUES
    (uuid_generate_v4(), 'System', 'Admin', 'admin@payroll.com', '$2a$10$QUsZiScZyHeEcWzF3/paxOcf8n5kEOI9nt9BE1VvuR.LrGpkyFwCG', 'ADMIN', TRUE),
    (uuid_generate_v4(), 'Jane', 'Mwamba', 'hr@payroll.com', '$2a$10$0L5pNDlco6bJX9mq3SujB.uPEEsIZOfhsIPAUK8dJYbt4iMgzoViW', 'HR', TRUE),
    (uuid_generate_v4(), 'John', 'Banda', 'manager@payroll.com', '$2a$10$ig3ZBcvwH.LJ0JPijRl5XOyyXow2Ms6m9m3DZvvt31PX/Zf4XSjz.', 'MANAGER', TRUE)
ON CONFLICT (email) DO NOTHING;

-- Seed Departments
INSERT INTO departments (id, name, description)
VALUES
    (uuid_generate_v4(), 'Human Resources', 'Human Resources Department'),
    (uuid_generate_v4(), 'Finance', 'Finance and Accounting'),
    (uuid_generate_v4(), 'Information Technology', 'IT Department'),
    (uuid_generate_v4(), 'Operations', 'Operations and Administration'),
    (uuid_generate_v4(), 'Sales & Marketing', 'Sales and Marketing Department')
ON CONFLICT (name) DO NOTHING;

-- Seed Zambia PAYE Tax Brackets (Current Rates - illustrative, to be confirmed by Admin)
INSERT INTO tax_brackets (id, min_amount, max_amount, tax_rate, effective_date)
VALUES
    (uuid_generate_v4(), 0, 4000.00, 0, '2024-01-01'),
    (uuid_generate_v4(), 4000.01, 8000.00, 20.00, '2024-01-01'),
    (uuid_generate_v4(), 8000.01, 20000.00, 30.00, '2024-01-01'),
    (uuid_generate_v4(), 20000.01, NULL, 37.50, '2024-01-01');

-- Seed Payroll Settings (Current Zambia rates - illustrative)
INSERT INTO payroll_settings (id, effective_date, nhima_employee_percent, nhima_employer_percent, napsa_employee_percent, napsa_employer_percent, overtime_rate, holiday_rate, working_days_per_month, hours_per_day, napsa_max_earnings)
VALUES
    (uuid_generate_v4(), '2024-01-01', 1.00, 1.00, 5.00, 5.00, 1.50, 2.00, 22, 8, 10000.00);

-- Seed Deduction Types
INSERT INTO deduction_types (id, name, description, is_active)
VALUES
    (uuid_generate_v4(), 'Union Dues', 'Trade union membership fees', TRUE),
    (uuid_generate_v4(), 'Garnishment', 'Court-ordered wage garnishment', TRUE),
    (uuid_generate_v4(), 'Welfare Fund', 'Employee welfare contribution', TRUE),
    (uuid_generate_v4(), 'Transport Allowance Recovery', 'Recovery of transport advances', TRUE)
ON CONFLICT (name) DO NOTHING;

-- Seed Sample Employees
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
