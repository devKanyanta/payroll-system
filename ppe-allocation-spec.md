# PPE Allocation Tracking — Feature Specification

## 1. Overview

Implement a dynamic **Personal Protective Equipment (PPE) allocation tracking** feature integrated into the existing payroll & HR dashboard. The feature allows HR users to request PPE for employees, and System Admins to review and approve/reject those requests. A mutable catalog of PPE items is managed by both roles.

---

## 2. Data Model

### 2.1. PPE Catalog Items (`ppe_catalog_items`)

| Column        | Type          | Notes                                        |
|---------------|---------------|----------------------------------------------|
| `id`          | UUID (PK)     | Generated via `uuid_generate_v4()`           |
| `name`        | VARCHAR(255)  | Required, unique. E.g. "Working Suit", "Helmet" |
| `description` | TEXT          | Optional. Extensible for future use          |
| `category`    | VARCHAR(100)  | Optional. E.g. "Head", "Eye", "Foot", "Body" |
| `is_active`   | BOOLEAN       | Default TRUE. Soft-delete / disable items    |
| `created_at`  | TIMESTAMP     | Auto-set                                     |
| `updated_at`  | TIMESTAMP     | Auto-set                                     |

- Fully mutable: Admin & HR can add, edit, or deactivate items.
- New items immediately appear in request forms (no restart/deploy needed).
- Items are soft-deactivated via `is_active` rather than hard-deleted.

### 2.2. PPE Requests (`ppe_requests`)

Represents a single request initiated by an HR user for one employee.

| Column           | Type          | Notes                                                |
|------------------|---------------|------------------------------------------------------|
| `id`             | UUID (PK)     | Generated                                            |
| `employee_id`    | UUID (FK)     | References `employees(id)` — must be ACTIVE employee |
| `requested_by`   | UUID (FK)     | References `users(id)` — the HR user who initiated   |
| `reviewed_by`    | UUID (FK)     | Nullable. References `users(id)` — admin who acted   |
| `status`         | VARCHAR(20)   | `PENDING` → `ELIGIBLE` or `NOT_ELIGIBLE`             |
| `date_given`     | DATE          | Nullable. Set = date when admin approved (status→ELIGIBLE) |
| `due_date`       | DATE          | Required. The replacement/expiry date for the PPE    |
| `notes`          | TEXT          | Optional. Any additional HR/admin notes              |
| `created_at`     | TIMESTAMP     | Auto-set                                             |
| `updated_at`     | TIMESTAMP     | Auto-set                                             |

**Status flow:**
```
PENDING → ELIGIBLE (auto-set date_given = approved date)
PENDING → NOT_ELIGIBLE (HR can re-initiate a new request later)
```

- `date_given` is populated automatically on approval (date when admin clicks approve).
- `ELIGIBLE` maps to **green** status indicator.
- `NOT_ELIGIBLE` maps to **red** status indicator.

### 2.3. PPE Request Items (`ppe_request_items`)

Many-to-many join linking a PPE request to the catalog items selected.

| Column            | Type       | Notes                                          |
|-------------------|------------|------------------------------------------------|
| `id`              | UUID (PK)  | Generated                                      |
| `ppe_request_id`  | UUID (FK)  | References `ppe_requests(id)` — cascading delete |
| `catalog_item_id` | UUID (FK)  | References `ppe_catalog_items(id)`             |

Each request checks off one or more items from the catalog (no quantity dimension).

### 2.4. Audit Trail

- Approval/rejection events tracked via the existing `audit_logs` table:
  - `entity_name` = `"PPE_REQUEST"`
  - `entity_id` = the request UUID
  - `action` = `"APPROVED"` or `"REJECTED"`
  - `user_id` = the admin who acted
  - Audit already records `old_value` / `new_value` / `timestamp`.

---

## 3. Database Migrations

### Migration V11 (new)

```sql
-- Enable UUID extension (included in V1)
CREATE TABLE ppe_catalog_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    category VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE ppe_request_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ppe_request_id UUID NOT NULL REFERENCES ppe_requests(id) ON DELETE CASCADE,
    catalog_item_id UUID NOT NULL REFERENCES ppe_catalog_items(id)
);

CREATE INDEX idx_ppe_requests_employee ON ppe_requests(employee_id);
CREATE INDEX idx_ppe_requests_status ON ppe_requests(status);
CREATE INDEX idx_ppe_requests_reviewed_by ON ppe_requests(reviewed_by);
CREATE INDEX idx_ppe_request_items_request ON ppe_request_items(ppe_request_id);
CREATE INDEX idx_ppe_catalog_items_active ON ppe_catalog_items(is_active);
```

---

## 4. Seed Data

Pre-populate the `ppe_catalog_items` table with the following default items:
| Name          | Category | Description                   |
|---------------|----------|-------------------------------|
| Working Suit  | Body     | Standard work overalls        |
| Helmet        | Head     | Safety hard hat               |
| Safety Shoe   | Foot     | Steel-toe safety boots        |
| Goggles       | Eye      | Impact-resistant safety glasses |
| Ear Plugs     | Ear      | Hearing protection ear plugs  |
| Gloves        | Hand     | Heavy-duty work gloves        |
| Face Shield   | Face     | Full-face protection shield   |
| Hi-Vis Vest   | Body     | High-visibility safety vest   |

---

## 5. API Endpoints

### 5.1. PPE Catalog Management

| Method | Endpoint                          | Role    | Description                |
|--------|-----------------------------------|---------|----------------------------|
| GET    | `/api/ppe-catalog`                | HR,Admin| List all active items      |
| GET    | `/api/ppe-catalog/{id}`           | HR,Admin| Get single item            |
| POST   | `/api/ppe-catalog`                | HR,Admin| Create new catalog item    |
| PUT    | `/api/ppe-catalog/{id}`           | HR,Admin| Update catalog item        |
| DELETE | `/api/ppe-catalog/{id}`           | HR,Admin| Soft-deactivate (is_active=false) |

### 5.2. PPE Requests

| Method | Endpoint                            | Role     | Description                            |
|--------|-------------------------------------|----------|----------------------------------------|
| GET    | `/api/ppe-requests`                 | HR,Admin | List requests (filterable by status/employee) |
| GET    | `/api/ppe-requests/{id}`            | HR,Admin | Get request with items                 |
| GET    | `/api/ppe-requests/employee/{id}`   | HR,Admin | Get PPE history for one employee       |
| POST   | `/api/ppe-requests`                 | HR       | Create new request (with item IDs)     |
| PUT    | `/api/ppe-requests/{id}`           | HR       | Edit a PENDING request (items, due_date, notes) |
| DELETE | `/api/ppe-requests/{id}`           | HR       | Cancel/delete a PENDING request        |

### 5.3. Admin Review

| Method | Endpoint                                  | Role  | Description                                      |
|--------|-------------------------------------------|-------|--------------------------------------------------|
| PUT    | `/api/ppe-requests/{id}/approve`          | Admin | Set status=ELIGIBLE, date_given=today, reviewed_by=current user |
| PUT    | `/api/ppe-requests/{id}/reject`           | Admin | Set status=NOT_ELIGIBLE, reviewed_by=current user |
| GET    | `/api/ppe-requests/pending`               | Admin | Get all PENDING requests for review queue        |
| GET    | `/api/ppe-requests/pending/count`         | Admin | Get count of pending requests (for badge)        |

### 5.4. Pending Approval Notifications

When a new PPE request is created, the system auto-generates a `Notification` for **all ADMIN users** (notifications inserted into the `notifications` table with a link like `/ppe-requests/{id}`). This ensures the existing notification bell system picks up pending PPE approvals.

---

## 6. Security / Authorization (SecurityConfig)

Add these entries following the existing pattern:

```java
// PPE Catalog — both HR and Admin can manage
.requestMatchers("/api/ppe-catalog/**").hasAnyAuthority("ROLE_ADMIN", "ROLE_HR")

// PPE Requests — HR can create/edit/delete their own; Admin can review; Both can view
.requestMatchers(HttpMethod.GET, "/api/ppe-requests/**").hasAnyAuthority("ROLE_ADMIN", "ROLE_HR")
.requestMatchers(HttpMethod.POST, "/api/ppe-requests/**").hasAuthority("ROLE_HR")
.requestMatchers(HttpMethod.PUT, "/api/ppe-requests/**").hasAuthority("ROLE_HR")
.requestMatchers(HttpMethod.DELETE, "/api/ppe-requests/**").hasAuthority("ROLE_HR")

// Admin-specific review endpoints
.requestMatchers("/api/ppe-requests/{id}/approve").hasAuthority("ROLE_ADMIN")
.requestMatchers("/api/ppe-requests/{id}/reject").hasAuthority("ROLE_ADMIN")
.requestMatchers("/api/ppe-requests/pending/**").hasAuthority("ROLE_ADMIN")
```

**Alternative**: Simplify to:
```java
.requestMatchers("/api/ppe-requests/approve/**", "/api/ppe-requests/reject/**", "/api/ppe-requests/pending/**").hasAuthority("ROLE_ADMIN")
.requestMatchers("/api/ppe-requests/**").hasAnyAuthority("ROLE_ADMIN", "ROLE_HR")
```

---

## 7. Frontend Implementation

### 7.1. New Pages

| Route              | Page Component        | Roles     | Description                              |
|--------------------|-----------------------|-----------|------------------------------------------|
| `/ppe`             | `PpeRequests.jsx`     | HR, Admin | List all PPE requests (with filters)     |
| `/ppe/new`         | `PpeRequestForm.jsx`  | HR        | Create new PPE request form              |
| `/ppe/:id`         | `PpeRequestDetail.jsx`| HR, Admin | View/edit single request                 |
| `/ppe-catalog`     | `PpeCatalog.jsx`      | HR, Admin | Manage PPE catalog items                 |

### 7.2. Employee Details Page Changes (`EmployeeDetails.jsx`)

Add a **third card** in the right column (below Payroll History and Loans) — a "PPE History" card with a simple table showing:

| Column      | Content                                       |
|-------------|-----------------------------------------------|
| Items       | Comma-separated list of PPE item names        |
| Date Given  | `date_given` (or "-" if N/A)                  |
| Due Date    | Formatted date                                |
| Status      | Chip: ELIGIBLE (green) / NOT_ELIGIBLE (red) / PENDING (yellow/orange) |
| Approved By | Name of admin who reviewed (or "-")           |

Add a "Request PPE" button at the top-right of this card (navigates to `/ppe/new?employeeId={id}`).

### 7.3. Dashboard / Notification Integration

- When a PPE request is created, a notification is pushed to all ADMIN users via the existing `notifications` table.
- The notification title: `"New PPE Request — {employee name}"`
- The notification message: `"{employee name} needs {item count} PPE item(s)"`
- The notification link: `"/ppe/{requestId}"` so clicking the notification navigates to the request detail page for admin review.
- The existing `NotificationBell` component will automatically pick these up (no changes needed to NotificationBell).

### 7.4. Status Color Mapping

| Status         | Color  | Chip Color (MUI) |
|----------------|--------|------------------|
| ELIGIBLE       | Green  | `success`        |
| NOT_ELIGIBLE   | Red    | `error`          |
| PENDING        | Yellow/Orange | `warning` |

These colors apply consistently on:
- PPE request list page
- Employee Details PPE History table
- Request detail view

### 7.5. Catalog Management Page (`/ppe-catalog`)

A simple CRUD interface with:
- Table listing all catalog items (name, category, description, active status)
- Button to add new item
- Inline or modal edit for each item
- Toggle to activate/deactivate (soft-delete)

---

## 8. Service Layer Structure

### Backend Packages

```
com.payroll.entity
  ├── PpeCatalogItem.java      (new JPA entity)
  └── PpeRequest.java           (new JPA entity)

com.payroll.dto
  ├── PpeCatalogItemRequest.java
  ├── PpeCatalogItemResponse.java
  ├── PpeRequestRequest.java
  ├── PpeRequestResponse.java
  └── PpeRequestStatus.java     (enum: PENDING, ELIGIBLE, NOT_ELIGIBLE)

com.payroll.repository
  ├── PpeCatalogItemRepository.java
  └── PpeRequestRepository.java

com.payroll.service
  ├── PpeCatalogService.java
  └── PpeRequestService.java

com.payroll.service.impl
  ├── PpeCatalogServiceImpl.java
  └── PpeRequestServiceImpl.java

com.payroll.controller
  ├── PpeCatalogController.java
  └── PpeRequestController.java
```

### Frontend Files

```
src/services/
  ├── ppeCatalogService.js
  └── ppeRequestService.js

src/pages/
  ├── PpeRequests.jsx
  ├── PpeRequestForm.jsx
  ├── PpeRequestDetail.jsx
  └── PpeCatalog.jsx
```

---

## 9. Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Eligibility granularity | Per request, not per item | Keeping it simple. Admin reviews entire request. |
| Date Given | Auto-set on approval by system | Matches real-world: items can't be given until approved. |
| PPE catalog fields | Name, description, category + active flag | Extensible for future inventory tracking without over-engineering now. |
| Quantity per item | No (checkbox only) | Simple on/off selection. Can add quantity later if inventory tracking is added. |
| After rejection | HR can re-initiate (new request) | A "not eligible" status is a determination; HR can re-try with different justification. |
| After approval | Auto-complete (no delivery tracking) | Requests are decisions, not fulfillment workflows. |
| Approval queue | Notification bell (existing system) | Reuses existing pattern; no separate dashboard card needed. |
| Audit trail | Existing `audit_logs` table | Consistent with how Loans, Payroll runs, etc. are audited. |
| Pending request editing | HR can edit or delete pending requests | Allows correction before admin reviews. |
| Catalog management roles | Both Admin and HR can manage | Empowers HR to add new equipment without admin bottleneck. |

---

## 10. URL / Route Integration

Add new routes to `frontend/src/routes/index.jsx`:

```jsx
<Route path="/ppe" element={<PpeRequests />} />
<Route path="/ppe/new" element={<PpeRequestForm />} />
<Route path="/ppe/:id" element={<PpeRequestDetail />} />
<Route path="/ppe-catalog" element={<PpeCatalog />} />
```

These routes should be placed under the protected `DashboardLayout` wrapper and accessible to both ADMIN and HR. Use `<ProtectedRoute roles={['ADMIN', 'HR']}>` if needed.

---

## 11. Notification on Create

In `PpeRequestServiceImpl.createRequest()`, after saving the request:

1. Query all users with `ROLE_ADMIN`
2. For each admin user, call `notificationService.createNotification(...)` with:
   - `title`: `"New PPE Request — {employee.firstName} {employee.lastName}"`
   - `message`: `"{employee.firstName} {employee.lastName} is requesting {itemCount} PPE item(s)"`
   - `type`: `"PPE_REQUEST"`
   - `link`: `"/ppe/{requestId}"`

This ensures admins see the pending request in their notification bell dropdown.

---

## 12. Pending Requests Count for Admin

A dedicated endpoint `GET /api/ppe-requests/pending/count` returns `{ "count": N }`. This can be used by the notification bell or a future dashboard badge.

Alternatively, the existing notification count already includes the PPE_REQUEST notifications, so no separate count endpoint may be needed — admins see the unread bell count.

---

## 13. Edge Cases & Constraints

1. **Only ACTIVE employees**: The request creation form should only list employees with `status = ACTIVE`.
2. **No duplicate active requests**: An employee should not have more than one `PENDING` request at the same time (prevent spam). If there's already a PENDING request for employee X, HR must either wait or cancel the existing one.
3. **Catalog deactivation**: When a catalog item is deactivated (`is_active = false`), existing requests referencing it remain intact. It simply won't appear in new request checklists.
4. **Admin self-review**: An admin cannot approve/reject their own created request. The `requested_by` must differ from the current user.
5. **Status transitions**: Once `ELIGIBLE` or `NOT_ELIGIBLE`, no further status changes are allowed (terminal states).
6. **Due date validation**: `due_date` must be a future date (cannot be in the past when creating the request).
