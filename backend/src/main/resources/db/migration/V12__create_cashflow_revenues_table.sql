-- ============================================
-- Company Cashflow Revenue Tracking
-- V12: Stores monthly invoice/revenue data per site
-- ============================================
CREATE TABLE cashflow_revenues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site VARCHAR(100) NOT NULL,
    sub_total DECIMAL(14, 2) NOT NULL DEFAULT 0,
    vat_rate DECIMAL(5, 2) NOT NULL DEFAULT 16.00,
    vat_amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
    total DECIMAL(14, 2) NOT NULL DEFAULT 0,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- One entry per site per month/year
    CONSTRAINT uq_site_month_year UNIQUE (site, month, year)
);

CREATE INDEX idx_cashflow_revenues_month_year ON cashflow_revenues(month, year);

-- Seed default 4 sites for current month
INSERT INTO cashflow_revenues (site, sub_total, vat_rate, vat_amount, total, month, year)
VALUES
    ('Kitwe Invoice', 0, 16.00, 0, 0, EXTRACT(MONTH FROM CURRENT_DATE), EXTRACT(YEAR FROM CURRENT_DATE)),
    ('Mufulira Smelter', 0, 16.00, 0, 0, EXTRACT(MONTH FROM CURRENT_DATE), EXTRACT(YEAR FROM CURRENT_DATE)),
    ('Mufulira Mining', 0, 16.00, 0, 0, EXTRACT(MONTH FROM CURRENT_DATE), EXTRACT(YEAR FROM CURRENT_DATE)),
    ('Chingola', 0, 16.00, 0, 0, EXTRACT(MONTH FROM CURRENT_DATE), EXTRACT(YEAR FROM CURRENT_DATE));
