-- ============================================
-- Add soft loan interest rate to payroll settings
-- and duration_months to loans
-- ============================================

ALTER TABLE payroll_settings
ADD COLUMN IF NOT EXISTS soft_loan_interest_rate DECIMAL(5, 3) DEFAULT 0.300;

ALTER TABLE loans
ADD COLUMN IF NOT EXISTS duration_months INTEGER DEFAULT 1;
