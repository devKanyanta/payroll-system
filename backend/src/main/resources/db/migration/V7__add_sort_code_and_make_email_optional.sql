-- Make email optional (remove NOT NULL, drop UNIQUE, add conditional unique index)
ALTER TABLE employees ALTER COLUMN email DROP NOT NULL;
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_email ON employees(email) WHERE email IS NOT NULL;

-- Add sort code column
ALTER TABLE employees ADD COLUMN IF NOT EXISTS sort_code VARCHAR(50);
