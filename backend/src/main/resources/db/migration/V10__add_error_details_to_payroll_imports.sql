-- Add error_details column to payroll_imports for storing validation error messages
ALTER TABLE payroll_imports ADD COLUMN error_details TEXT;
