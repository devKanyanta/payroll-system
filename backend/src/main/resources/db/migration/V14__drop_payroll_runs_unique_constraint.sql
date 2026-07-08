-- ============================================
-- Drop the UNIQUE(month, year) constraint on payroll_runs
-- to allow up to 2 payroll runs per month.
-- The application now enforces the limit via
-- PayrollRunServiceImpl.countByMonthAndYear >= 2.
-- ============================================

ALTER TABLE payroll_runs DROP CONSTRAINT IF EXISTS payroll_runs_month_year_key;
