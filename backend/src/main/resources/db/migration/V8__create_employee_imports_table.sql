-- Create employee_imports table for tracking employee import jobs
CREATE TABLE IF NOT EXISTS employee_imports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    total_rows INT NOT NULL DEFAULT 0,
    success_rows INT NOT NULL DEFAULT 0,
    error_rows INT NOT NULL DEFAULT 0,
    errors TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'UPLOADED' CHECK (status IN ('UPLOADED', 'VALIDATED', 'IMPORTED', 'FAILED')),
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
