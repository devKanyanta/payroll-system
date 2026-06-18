-- ============================================
-- Add fields for the new payroll format
-- ============================================

-- Add site column to employees
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS site VARCHAR(200);

-- Add new columns to payroll_entries for the payroll format
ALTER TABLE payroll_entries
ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS present_days DECIMAL(8, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS loan_balance DECIMAL(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS site VARCHAR(200);
