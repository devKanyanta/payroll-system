-- ============================================
-- PPE Allocation Tracking
-- V11: PPE catalog, requests, and request items
-- ============================================

-- ============================================
-- PPE CATALOG ITEMS
-- ============================================
CREATE TABLE ppe_catalog_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    category VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- PPE REQUESTS
-- ============================================
CREATE TABLE ppe_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id),
    requested_by UUID NOT NULL REFERENCES users(id),
    reviewed_by UUID REFERENCES users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'ELIGIBLE', 'NOT_ELIGIBLE')),
    date_given DATE,
    due_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- PPE REQUEST ITEMS (join table)
-- ============================================
CREATE TABLE ppe_request_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ppe_request_id UUID NOT NULL REFERENCES ppe_requests(id) ON DELETE CASCADE,
    catalog_item_id UUID NOT NULL REFERENCES ppe_catalog_items(id)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_ppe_requests_employee ON ppe_requests(employee_id);
CREATE INDEX idx_ppe_requests_status ON ppe_requests(status);
CREATE INDEX idx_ppe_requests_reviewed_by ON ppe_requests(reviewed_by);
CREATE INDEX idx_ppe_request_items_request ON ppe_request_items(ppe_request_id);
CREATE INDEX idx_ppe_catalog_items_active ON ppe_catalog_items(is_active);

-- ============================================
-- SEED DATA — default PPE catalog items
-- ============================================
INSERT INTO ppe_catalog_items (name, description, category) VALUES
    ('Working Suit', 'Standard work overalls', 'Body'),
    ('Helmet', 'Safety hard hat', 'Head'),
    ('Safety Shoe', 'Steel-toe safety boots', 'Foot'),
    ('Goggles', 'Impact-resistant safety glasses', 'Eye'),
    ('Ear Plugs', 'Hearing protection ear plugs', 'Ear'),
    ('Gloves', 'Heavy-duty work gloves', 'Hand'),
    ('Face Shield', 'Full-face protection shield', 'Face'),
    ('Hi-Vis Vest', 'High-visibility safety vest', 'Body');
