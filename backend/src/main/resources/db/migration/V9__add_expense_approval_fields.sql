-- ============================================
-- Add expense approval workflow columns
-- ============================================

ALTER TABLE expenses
    ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    ADD COLUMN approved_by UUID REFERENCES users(id),
    ADD COLUMN approved_at TIMESTAMP,
    ADD COLUMN rejected_by UUID REFERENCES users(id),
    ADD COLUMN rejected_at TIMESTAMP,
    ADD COLUMN rejection_reason TEXT;

CREATE INDEX idx_expenses_status ON expenses(status);
CREATE INDEX idx_expenses_created_by ON expenses(created_by);
