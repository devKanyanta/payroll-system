# Payroll Management System API

**Base URL:** `http://localhost:8080`  
**API Prefix:** `/api`  
**Authentication:** Bearer JWT Token  
**Date Format:** `yyyy-MM-dd`  
**Timezone:** `Africa/Lusaka`

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Employees](#2-employees)
3. [Departments](#3-departments)
4. [Users](#4-users)
5. [Payroll Runs](#5-payroll-runs)
6. [Payslips](#6-payslips)
7. [Loans](#7-loans)
8. [Expenses](#8-expenses)
9. [Tax Brackets](#9-tax-brackets)
10. [Payroll Settings](#10-payroll-settings)
11. [Dashboard](#11-dashboard)
12. [Reports](#12-reports)
13. [Audit Logs](#13-audit-logs)
14. [Payroll Imports](#14-payroll-imports)
15. [Error Responses](#15-error-responses)
16. [Enums Reference](#16-enums-reference)

---

## Authentication

All secured endpoints require the `Authorization: Bearer <token>` header.

### Role-based Access

| Role | Prefix |
|------|--------|
| `ADMIN` | `ROLE_ADMIN` — full system access |
| `HR` | `ROLE_HR` — employee & payroll operations |
| `MANAGER` | `ROLE_MANAGER` — reports & payroll review |

### Public Endpoints

The following are accessible without authentication:
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET /api-docs/**`
- `GET /swagger-ui/**`

---

## 1. Authentication

### POST /api/auth/login

Authenticate a user and receive JWT tokens.

**Request Body:**
```json
{
  "email": "admin@payroll.com",
  "password": "password123"
}
```

**Validation Rules:**
| Field | Rule |
|-------|------|
| `email` | Required, valid email format |
| `password` | Required |

**Response `200 OK`:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
  "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2g...",
  "tokenType": "Bearer",
  "email": "admin@payroll.com",
  "role": "ADMIN",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Example:**
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@payroll.com",
    "password": "password123"
  }'
```

**Error Responses:**
| Status | Description |
|--------|-------------|
| `401 Unauthorized` | Invalid email or password |
| `429 Too Many Requests` | Account is locked due to too many failed attempts |

---

### POST /api/auth/refresh

Refresh an expired access token using a valid refresh token.

**Request Body:**
```json
{
  "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2g..."
}
```

**Validation Rules:**
| Field | Rule |
|-------|------|
| `refreshToken` | Required |

**Response `200 OK`:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
  "refreshToken": "bmV3IHJlZnJlc2ggdG9rZW4...",
  "tokenType": "Bearer",
  "email": "admin@payroll.com",
  "role": "ADMIN",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Example:**
```bash
curl -X POST http://localhost:8080/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2g..."
  }'
```

---

### POST /api/auth/logout

Invalidate a refresh token.

**Request Body:**
```json
{
  "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2g..."
}
```

**Response `200 OK`** *(no body)*

**Example:**
```bash
curl -X POST http://localhost:8080/api/auth/logout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2g..."
  }'
```

---

### POST /api/auth/forgot-password

Request a password reset email.

**Request Body:**
```json
{
  "email": "user@payroll.com"
}
```

**Validation Rules:**
| Field | Rule |
|-------|------|
| `email` | Required, valid email format |

**Response `200 OK`** *(no body)*

**Example:**
```bash
curl -X POST http://localhost:8080/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@payroll.com"
  }'
```

---

### POST /api/auth/reset-password

Reset password using the token received via email.

**Request Body:**
```json
{
  "token": "reset-token-from-email",
  "newPassword": "NewSecurePass123"
}
```

**Validation Rules:**
| Field | Rule |
|-------|------|
| `token` | Required |
| `newPassword` | Required, minimum 8 characters |

**Response `200 OK`** *(no body)*

**Example:**
```bash
curl -X POST http://localhost:8080/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "abc123-reset-token",
    "newPassword": "NewSecurePass123"
  }'
```

---

### POST /api/auth/change-password

Change password for an authenticated user.

**Request Headers:**
`Authorization: Bearer <token>` (the email is extracted from the JWT automatically)

**Request Body:**
```json
{
  "currentPassword": "OldPass123",
  "newPassword": "NewSecurePass456"
}
```

**Validation Rules:**
| Field | Rule |
|-------|------|
| `currentPassword` | Required |
| `newPassword` | Required, minimum 8 characters |

**Response `200 OK`** *(no body)*

**Example:**
```bash
curl -X POST http://localhost:8080/api/auth/change-password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "currentPassword": "OldPass123",
    "newPassword": "NewSecurePass456"
  }'
```

---

## 2. Employees

**Required Role:** `ADMIN` or `HR`

### GET /api/employees

Get a paginated list of employees with optional filters.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `search` | String | No | Search by name, email, or employee number |
| `departmentId` | UUID | No | Filter by department |
| `status` | Enum | No | Filter by status: `ACTIVE`, `INACTIVE`, `TERMINATED` |
| `page` | Integer | No | Page number (0-based, default: 0) |
| `size` | Integer | No | Page size (default: 20) |
| `sort` | String | No | Sort criteria, e.g. `lastName,asc` |

**Response `200 OK`:**
```json
{
  "content": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "employeeNumber": "EMP-001",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@company.com",
      "phone": "+260977123456",
      "nrc": "123456/78/1",
      "departmentId": "550e8400-e29b-41d4-a716-446655440010",
      "departmentName": "Engineering",
      "position": "Senior Developer",
      "employmentType": "FULL_TIME",
      "salaryType": "MONTHLY",
      "bankName": "Zanaco",
      "accountNumber": "1234567890",
      "dateHired": "2023-01-15",
      "basicSalary": 15000.00,
      "status": "ACTIVE",
      "createdAt": "2023-01-15T08:30:00"
    }
  ],
  "page": 0,
  "size": 20,
  "totalElements": 50,
  "totalPages": 3,
  "last": false,
  "first": true
}
```

**Example:**
```bash
curl -X GET "http://localhost:8080/api/employees?search=John&departmentId=550e8400-e29b-41d4-a716-446655440010&status=ACTIVE&page=0&size=10&sort=lastName,asc" \
  -H "Authorization: Bearer <token>"
```

---

### GET /api/employees/{id}

Get a single employee by ID.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Employee ID |

**Response `200 OK`:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "employeeNumber": "EMP-001",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@company.com",
  "phone": "+260977123456",
  "nrc": "123456/78/1",
  "departmentId": "550e8400-e29b-41d4-a716-446655440010",
  "departmentName": "Engineering",
  "position": "Senior Developer",
  "employmentType": "FULL_TIME",
  "salaryType": "MONTHLY",
  "bankName": "Zanaco",
  "accountNumber": "1234567890",
  "dateHired": "2023-01-15",
  "basicSalary": 15000.00,
  "status": "ACTIVE",
  "createdAt": "2023-01-15T08:30:00"
}
```

**Example:**
```bash
curl -X GET http://localhost:8080/api/employees/550e8400-e29b-41d4-a716-446655440001 \
  -H "Authorization: Bearer <token>"
```

**Error:**
| Status | Description |
|--------|-------------|
| `404 Not Found` | Employee not found |

---

### POST /api/employees

Create a new employee.

**Request Body:**
```json
{
  "employeeNumber": "EMP-002",
  "firstName": "Jane",
  "lastName": "Smith",
  "email": "jane.smith@company.com",
  "phone": "+260977789012",
  "nrc": "654321/78/1",
  "departmentId": "550e8400-e29b-41d4-a716-446655440010",
  "position": "Software Developer",
  "employmentType": "FULL_TIME",
  "salaryType": "MONTHLY",
  "bankName": "Stanbic",
  "accountNumber": "0987654321",
  "dateHired": "2024-06-01",
  "basicSalary": 12000.00,
  "status": "ACTIVE"
}
```

**Validation Rules:**

| Field | Rule |
|-------|------|
| `firstName` | Required |
| `lastName` | Required |
| `email` | Required |
| `nrc` | Required |
| `employmentType` | Required. Valid values: `FULL_TIME`, `PART_TIME`, `CONTRACT` |
| `salaryType` | Required. Valid values: `MONTHLY`, `HOURLY` |
| `dateHired` | Required |
| `basicSalary` | Required |

**Response `201 Created`:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440002",
  "employeeNumber": "EMP-002",
  "firstName": "Jane",
  "lastName": "Smith",
  "email": "jane.smith@company.com",
  ...
}
```

**Example:**
```bash
curl -X POST http://localhost:8080/api/employees \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "firstName": "Jane",
    "lastName": "Smith",
    "email": "jane.smith@company.com",
    "phone": "+260977789012",
    "nrc": "654321/78/1",
    "departmentId": "550e8400-e29b-41d4-a716-446655440010",
    "position": "Software Developer",
    "employmentType": "FULL_TIME",
    "salaryType": "MONTHLY",
    "dateHired": "2024-06-01",
    "basicSalary": 12000.00
  }'
```

**Error Responses:**
| Status | Description |
|--------|-------------|
| `400 Bad Request` | Validation failed |
| `409 Conflict` | Duplicate email or employee number |

---

### PUT /api/employees/{id}

Update an existing employee.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Employee ID |

**Request Body:** Same schema as POST.

**Response `200 OK`:** Returns the updated employee object.

**Example:**
```bash
curl -X PUT http://localhost:8080/api/employees/550e8400-e29b-41d4-a716-446655440001 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.new@company.com",
    "nrc": "123456/78/1",
    "employmentType": "FULL_TIME",
    "salaryType": "MONTHLY",
    "dateHired": "2023-01-15",
    "basicSalary": 16000.00
  }'
```

---

### DELETE /api/employees/{id}

Delete an employee.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Employee ID |

**Response `204 No Content`**

**Example:**
```bash
curl -X DELETE http://localhost:8080/api/employees/550e8400-e29b-41d4-a716-446655440001 \
  -H "Authorization: Bearer <token>"
```

---

### GET /api/employees/next-number

Get the next auto-generated employee number.

**Response `200 OK`:**
```
"EMP-051"
```

**Example:**
```bash
curl -X GET http://localhost:8080/api/employees/next-number \
  -H "Authorization: Bearer <token>"
```

---

## 3. Departments

**Required Role:** `ADMIN` or `HR`

### GET /api/departments

Get all departments.

**Response `200 OK`:**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440010",
    "name": "Engineering",
    "description": "Software engineering and development",
    "createdAt": "2023-01-01T08:00:00",
    "updatedAt": "2024-01-15T10:30:00"
  },
  {
    "id": "550e8400-e29b-41d4-a716-446655440011",
    "name": "Human Resources",
    "description": "HR and personnel management",
    "createdAt": "2023-01-01T08:00:00",
    "updatedAt": "2024-01-15T10:30:00"
  }
]
```

**Example:**
```bash
curl -X GET http://localhost:8080/api/departments \
  -H "Authorization: Bearer <token>"
```

---

### GET /api/departments/{id}

Get a department by ID.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Department ID |

**Response `200 OK`:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440010",
  "name": "Engineering",
  "description": "Software engineering and development",
  "createdAt": "2023-01-01T08:00:00",
  "updatedAt": "2024-01-15T10:30:00"
}
```

**Example:**
```bash
curl -X GET http://localhost:8080/api/departments/550e8400-e29b-41d4-a716-446655440010 \
  -H "Authorization: Bearer <token>"
```

---

### POST /api/departments

Create a new department.

**Request Body:**
```json
{
  "name": "Finance",
  "description": "Finance and accounting department"
}
```

**Validation Rules:**

| Field | Rule |
|-------|------|
| `name` | Required, must be unique |

**Response `201 Created`:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440012",
  "name": "Finance",
  "description": "Finance and accounting department",
  "createdAt": "2024-06-18T12:00:00",
  "updatedAt": "2024-06-18T12:00:00"
}
```

**Example:**
```bash
curl -X POST http://localhost:8080/api/departments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "name": "Finance",
    "description": "Finance and accounting department"
  }'
```

---

### PUT /api/departments/{id}

Update a department.

**Request Body:** Same schema as POST.

**Response `200 OK`:** Returns the updated department.

**Example:**
```bash
curl -X PUT http://localhost:8080/api/departments/550e8400-e29b-41d4-a716-446655440010 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "name": "Engineering",
    "description": "Software engineering, development, and IT operations"
  }'
```

---

### DELETE /api/departments/{id}

Delete a department.

**Response `204 No Content`**

**Example:**
```bash
curl -X DELETE http://localhost:8080/api/departments/550e8400-e29b-41d4-a716-446655440010 \
  -H "Authorization: Bearer <token>"
```

---

## 4. Users

**Required Role:** `ADMIN`

### GET /api/users

Get a paginated list of system users.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | Integer | No | Page number (0-based) |
| `size` | Integer | No | Page size |
| `sort` | String | No | Sort criteria |

**Response `200 OK`:**
```json
{
  "content": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440020",
      "firstName": "Admin",
      "lastName": "User",
      "email": "admin@payroll.com",
      "role": "ADMIN",
      "active": true,
      "createdAt": "2023-01-01T08:00:00"
    }
  ],
  "page": 0,
  "size": 20,
  "totalElements": 5,
  "totalPages": 1,
  "last": true,
  "first": true
}
```

**Example:**
```bash
curl -X GET "http://localhost:8080/api/users?page=0&size=10" \
  -H "Authorization: Bearer <token>"
```

---

### GET /api/users/{id}

Get a user by ID.

**Response `200 OK`:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440020",
  "firstName": "Admin",
  "lastName": "User",
  "email": "admin@payroll.com",
  "role": "ADMIN",
  "active": true,
  "createdAt": "2023-01-01T08:00:00"
}
```

**Example:**
```bash
curl -X GET http://localhost:8080/api/users/550e8400-e29b-41d4-a716-446655440020 \
  -H "Authorization: Bearer <token>"
```

---

### POST /api/users

Create a new system user. A temporary password is generated and should be sent via email.

**Request Body:**
```json
{
  "firstName": "New",
  "lastName": "User",
  "email": "new.user@payroll.com",
  "role": "HR",
  "active": true
}
```

**Validation Rules:**

| Field | Rule |
|-------|------|
| `firstName` | Required |
| `lastName` | Required |
| `email` | Required, valid email format, must be unique |
| `role` | Required. Valid values: `ADMIN`, `HR`, `MANAGER` |
| `active` | Optional, defaults to `true` |

**Response `201 Created`:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440021",
  "firstName": "New",
  "lastName": "User",
  "email": "new.user@payroll.com",
  "role": "HR",
  "active": true,
  "createdAt": "2024-06-18T12:00:00"
}
```

**Example:**
```bash
curl -X POST http://localhost:8080/api/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "firstName": "New",
    "lastName": "User",
    "email": "new.user@payroll.com",
    "role": "HR",
    "active": true
  }'
```

---

### PUT /api/users/{id}

Update a user.

**Request Body:** Same schema as POST.

**Response `200 OK`:** Returns the updated user.

---

### DELETE /api/users/{id}

Delete a user.

**Response `204 No Content`**

**Example:**
```bash
curl -X DELETE http://localhost:8080/api/users/550e8400-e29b-41d4-a716-446655440021 \
  -H "Authorization: Bearer <token>"
```

---

## 5. Payroll Runs

**Required Role:** `ADMIN`, `HR`, or `MANAGER`

### GET /api/payroll-runs

Get a paginated list of payroll runs with optional filters.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `month` | Integer | No | Filter by month (1-12) |
| `year` | Integer | No | Filter by year |
| `status` | Enum | No | Filter by status: `DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED` |
| `page` | Integer | No | Page number (0-based) |
| `size` | Integer | No | Page size |

**Response `200 OK`:**
```json
{
  "content": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440030",
      "month": 6,
      "year": 2024,
      "status": "DRAFT",
      "createdBy": { "id": "...", "email": "admin@payroll.com" },
      "approvedBy": null,
      "approvedAt": null,
      "rejectedBy": null,
      "rejectedAt": null,
      "rejectionReason": null,
      "createdAt": "2024-06-18T10:00:00",
      "updatedAt": "2024-06-18T10:00:00"
    }
  ],
  "page": 0,
  "size": 20,
  "totalElements": 1,
  "totalPages": 1,
  "last": true,
  "first": true
}
```

**Example:**
```bash
curl -X GET "http://localhost:8080/api/payroll-runs?month=6&year=2024&status=DRAFT&page=0&size=10" \
  -H "Authorization: Bearer <token>"
```

---

### GET /api/payroll-runs/{id}

Get a payroll run by ID.

**Response `200 OK`:** Returns the payroll run object.

**Example:**
```bash
curl -X GET http://localhost:8080/api/payroll-runs/550e8400-e29b-41d4-a716-446655440030 \
  -H "Authorization: Bearer <token>"
```

---

### POST /api/payroll-runs

Create a new payroll run. The authenticated user is set as the creator.

**Request Body:**
```json
{
  "month": 6,
  "year": 2024
}
```

| Field | Rule |
|-------|------|
| `month` | Required, integer (1-12) |
| `year` | Required, integer |

**Response `201 Created`:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440030",
  "month": 6,
  "year": 2024,
  "status": "DRAFT",
  ...
  "createdAt": "2024-06-18T10:00:00",
  "updatedAt": "2024-06-18T10:00:00"
}
```

**Example:**
```bash
curl -X POST http://localhost:8080/api/payroll-runs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "month": 6,
    "year": 2024
  }'
```

---

### PUT /api/payroll-runs/{id}/submit

Submit a payroll run for approval (moves status from `DRAFT` to `SUBMITTED`).

**Response `200 OK`:** Returns the updated payroll run.

**Example:**
```bash
curl -X PUT http://localhost:8080/api/payroll-runs/550e8400-e29b-41d4-a716-446655440030/submit \
  -H "Authorization: Bearer <token>"
```

---

### PUT /api/payroll-runs/{id}/approve

Approve a submitted payroll run (moves status from `SUBMITTED` to `APPROVED`).

**Response `200 OK`:** Returns the updated payroll run.

**Example:**
```bash
curl -X PUT http://localhost:8080/api/payroll-runs/550e8400-e29b-41d4-a716-446655440030/approve \
  -H "Authorization: Bearer <token>"
```

---

### PUT /api/payroll-runs/{id}/reject

Reject a submitted payroll run (moves status from `SUBMITTED` to `REJECTED`).

**Request Body:**
```json
{
  "reason": "Incorrect salary figures for Engineering department"
}
```

**Response `200 OK`:** Returns the updated payroll run with rejection details.

**Example:**
```bash
curl -X PUT http://localhost:8080/api/payroll-runs/550e8400-e29b-41d4-a716-446655440030/reject \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "reason": "Incorrect salary figures for Engineering department"
  }'
```

---

### PUT /api/payroll-runs/{id}/reopen

Reopen a rejected payroll run (moves status from `REJECTED` back to `DRAFT`).

**Response `200 OK`:** Returns the updated payroll run.

**Example:**
```bash
curl -X PUT http://localhost:8080/api/payroll-runs/550e8400-e29b-41d4-a716-446655440030/reopen \
  -H "Authorization: Bearer <token>"
```

---

## 6. Payslips

**Required Role:** `ADMIN`, `HR`, or `MANAGER`

### GET /api/payslips?employeeId={employeeId}

Get all payslips for a specific employee.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `employeeId` | UUID | Yes | Employee ID |

**Response `200 OK`:**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440040",
    "payrollEntry": { "id": "550e8400-..." },
    "pdfPath": "payslips/2024/06/EMP-001.pdf",
    "generatedAt": "2024-06-30T15:00:00",
    "emailedAt": null,
    "createdAt": "2024-06-30T15:00:00"
  }
]
```

**Example:**
```bash
curl -X GET "http://localhost:8080/api/payslips?employeeId=550e8400-e29b-41d4-a716-446655440001" \
  -H "Authorization: Bearer <token>"
```

---

### GET /api/payslips/{id}

Get a payslip by ID.

**Example:**
```bash
curl -X GET http://localhost:8080/api/payslips/550e8400-e29b-41d4-a716-446655440040 \
  -H "Authorization: Bearer <token>"
```

---

### GET /api/payslips/{id}/download

Download a payslip as a PDF file.

**Response `200 OK`:** Binary PDF file with `Content-Disposition: attachment; filename=payslip-{id}.pdf` and `Content-Type: application/pdf`.

**Example:**
```bash
curl -X GET http://localhost:8080/api/payslips/550e8400-e29b-41d4-a716-446655440040/download \
  -H "Authorization: Bearer <token>" \
  -o payslip.pdf
```

---

### POST /api/payslips/generate/{payrollRunId}

Generate payslips for all employees in a payroll run.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `payrollRunId` | UUID | Payroll Run ID |

**Response `200 OK`** *(no body)*

**Example:**
```bash
curl -X POST http://localhost:8080/api/payslips/generate/550e8400-e29b-41d4-a716-446655440030 \
  -H "Authorization: Bearer <token>"
```

---

### POST /api/payslips/{id}/email

Email a payslip to the employee.

**Response `200 OK`** *(no body)*

**Example:**
```bash
curl -X POST http://localhost:8080/api/payslips/550e8400-e29b-41d4-a716-446655440040/email \
  -H "Authorization: Bearer <token>"
```

---

## 7. Loans

**Required Role:** `ADMIN` or `HR`

### GET /api/loans?employeeId={employeeId}

Get all loans for a specific employee.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `employeeId` | UUID | Yes | Employee ID |

**Response `200 OK`:**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440050",
    "employeeId": "550e8400-e29b-41d4-a716-446655440001",
    "employeeName": "John Doe",
    "loanAmount": 50000.00,
    "balance": 35000.00,
    "interestRate": 5.00,
    "monthlyDeduction": 5000.00,
    "startDate": "2024-01-01",
    "endDate": "2024-12-01",
    "status": "ACTIVE",
    "createdAt": "2024-01-01T09:00:00"
  }
]
```

**Example:**
```bash
curl -X GET "http://localhost:8080/api/loans?employeeId=550e8400-e29b-41d4-a716-446655440001" \
  -H "Authorization: Bearer <token>"
```

---

### GET /api/loans/{id}

Get a loan by ID.

**Example:**
```bash
curl -X GET http://localhost:8080/api/loans/550e8400-e29b-41d4-a716-446655440050 \
  -H "Authorization: Bearer <token>"
```

---

### POST /api/loans

Create a new loan.

**Request Body:**
```json
{
  "employeeId": "550e8400-e29b-41d4-a716-446655440001",
  "loanAmount": 50000.00,
  "interestRate": 5.00,
  "monthlyDeduction": 5000.00,
  "startDate": "2024-01-01",
  "endDate": "2024-12-01"
}
```

**Validation Rules:**

| Field | Rule |
|-------|------|
| `employeeId` | Required |
| `loanAmount` | Required |
| `monthlyDeduction` | Required |
| `startDate` | Required |
| `endDate` | Required |
| `interestRate` | Optional, defaults to 0 |

**Response `201 Created`:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440050",
  "employeeId": "550e8400-e29b-41d4-a716-446655440001",
  "employeeName": "John Doe",
  "loanAmount": 50000.00,
  "balance": 50000.00,
  "interestRate": 5.00,
  "monthlyDeduction": 5000.00,
  "startDate": "2024-01-01",
  "endDate": "2024-12-01",
  "status": "ACTIVE",
  "createdAt": "2024-06-18T12:00:00"
}
```

**Example:**
```bash
curl -X POST http://localhost:8080/api/loans \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "employeeId": "550e8400-e29b-41d4-a716-446655440001",
    "loanAmount": 50000.00,
    "interestRate": 5.00,
    "monthlyDeduction": 5000.00,
    "startDate": "2024-01-01",
    "endDate": "2024-12-01"
  }'
```

---

### PUT /api/loans/{id}

Update a loan.

**Request Body:** Same schema as POST.

**Response `200 OK`:** Returns the updated loan.

---

### DELETE /api/loans/{id}

Cancel a loan (sets status to `CANCELLED`).

**Response `204 No Content`**

**Example:**
```bash
curl -X DELETE http://localhost:8080/api/loans/550e8400-e29b-41d4-a716-446655440050 \
  -H "Authorization: Bearer <token>"
```

---

## 8. Expenses

**Required Role:** `ADMIN` or `HR`

### GET /api/expenses

Get a paginated list of expenses with optional date filters.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `start` | Date (ISO) | No | Filter by start date (e.g., `2024-01-01`) |
| `end` | Date (ISO) | No | Filter by end date (e.g., `2024-06-30`) |
| `page` | Integer | No | Page number (0-based) |
| `size` | Integer | No | Page size |
| `sort` | String | No | Sort criteria |

**Response `200 OK`:**
```json
{
  "content": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440060",
      "item": "Office Supplies",
      "amount": 2500.00,
      "remarks": "Stationery for Q2",
      "expenseDate": "2024-04-15",
      "createdBy": {
        "id": "550e8400-e29b-41d4-a716-446655440020",
        "firstName": "Admin",
        "lastName": "User",
        "email": "admin@payroll.com",
        "passwordHash": "...",
        ...
      },
      "createdAt": "2024-04-15T14:30:00",
      "updatedAt": "2024-04-15T14:30:00"
    }
  ],
  "pageable": {...},
  "totalElements": 1,
  "totalPages": 1,
  ...
}
```

> **Note:** The response includes the full `createdBy` User object (all fields).

**Example:**
```bash
curl -X GET "http://localhost:8080/api/expenses?start=2024-01-01&end=2024-06-30&page=0&size=20&sort=expenseDate,desc" \
  -H "Authorization: Bearer <token>"
```

---

### GET /api/expenses/{id}

Get an expense by ID.

**Example:**
```bash
curl -X GET http://localhost:8080/api/expenses/550e8400-e29b-41d4-a716-446655440060 \
  -H "Authorization: Bearer <token>"
```

---

### POST /api/expenses

Create a new expense.

**Request Body:**
```json
{
  "item": "Office Supplies",
  "amount": 2500.00,
  "remarks": "Stationery for Q2",
  "expenseDate": "2024-04-15"
}
```

**Validation Rules:**

| Field | Rule |
|-------|------|
| `item` | Required |
| `amount` | Required |
| `expenseDate` | Required |

**Response `201 Created`:** Returns the created expense.

**Example:**
```bash
curl -X POST http://localhost:8080/api/expenses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "item": "Office Supplies",
    "amount": 2500.00,
    "remarks": "Stationery for Q2",
    "expenseDate": "2024-04-15"
  }'
```

---

### PUT /api/expenses/{id}

Update an expense.

**Response `200 OK`**

---

### DELETE /api/expenses/{id}

Delete an expense.

**Response `204 No Content`**

**Example:**
```bash
curl -X DELETE http://localhost:8080/api/expenses/550e8400-e29b-41d4-a716-446655440060 \
  -H "Authorization: Bearer <token>"
```

---

## 9. Tax Brackets

**Required Role:** `ADMIN`

### GET /api/settings/tax-brackets

Get all tax brackets.

**Response `200 OK`:**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440070",
    "minAmount": 0.00,
    "maxAmount": 3000.00,
    "taxRate": 0.00,
    "effectiveDate": "2024-01-01",
    "createdAt": "2024-01-01T00:00:00"
  },
  {
    "id": "550e8400-e29b-41d4-a716-446655440071",
    "minAmount": 3001.00,
    "maxAmount": 5000.00,
    "taxRate": 10.00,
    "effectiveDate": "2024-01-01",
    "createdAt": "2024-01-01T00:00:00"
  },
  {
    "id": "550e8400-e29b-41d4-a716-446655440072",
    "minAmount": 5001.00,
    "maxAmount": null,
    "taxRate": 25.00,
    "effectiveDate": "2024-01-01",
    "createdAt": "2024-01-01T00:00:00"
  }
]
```

> **Note:** `maxAmount` is `null` for the highest bracket (no upper limit).

**Example:**
```bash
curl -X GET http://localhost:8080/api/settings/tax-brackets \
  -H "Authorization: Bearer <token>"
```

---

### GET /api/settings/tax-brackets/active

Get currently active tax brackets (ordered by `minAmount`).

**Response `200 OK`:** Returns an array of active tax brackets.

**Example:**
```bash
curl -X GET http://localhost:8080/api/settings/tax-brackets/active \
  -H "Authorization: Bearer <token>"
```

---

### GET /api/settings/tax-brackets/{id}

Get a tax bracket by ID.

**Example:**
```bash
curl -X GET http://localhost:8080/api/settings/tax-brackets/550e8400-e29b-41d4-a716-446655440070 \
  -H "Authorization: Bearer <token>"
```

---

### POST /api/settings/tax-brackets

Create a new tax bracket.

**Request Body:**
```json
{
  "minAmount": 5001.00,
  "maxAmount": 10000.00,
  "taxRate": 20.00,
  "effectiveDate": "2024-07-01"
}
```

**Validation Rules:**

| Field | Rule |
|-------|------|
| `minAmount` | Required |
| `taxRate` | Required |
| `effectiveDate` | Required |

**Response `201 Created`**

**Example:**
```bash
curl -X POST http://localhost:8080/api/settings/tax-brackets \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "minAmount": 5001.00,
    "maxAmount": 10000.00,
    "taxRate": 20.00,
    "effectiveDate": "2024-07-01"
  }'
```

---

### PUT /api/settings/tax-brackets/{id}

Update a tax bracket.

**Response `200 OK`**

---

### DELETE /api/settings/tax-brackets/{id}

Delete a tax bracket.

**Response `204 No Content`**

---

## 10. Payroll Settings

**Required Role:** `ADMIN`

### GET /api/settings/payroll/latest

Get the latest payroll settings.

**Response `200 OK`:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440080",
  "effectiveDate": "2024-01-01",
  "nhimaEmployeePercent": 1.00,
  "nhimaEmployerPercent": 1.00,
  "napsaEmployeePercent": 5.00,
  "napsaEmployerPercent": 5.00,
  "overtimeRate": 1.50,
  "holidayRate": 2.00,
  "workingDaysPerMonth": 22,
  "hoursPerDay": 8,
  "napsaMaxEarnings": 5000.00,
  "createdAt": "2024-01-01T00:00:00"
}
```

**Field Descriptions:**

| Field | Description |
|-------|-------------|
| `nhimaEmployeePercent` | NHIMA contribution % deducted from employee |
| `nhimaEmployerPercent` | NHIMA contribution % paid by employer |
| `napsaEmployeePercent` | NAPSA contribution % deducted from employee |
| `napsaEmployerPercent` | NAPSA contribution % paid by employer |
| `napsaMaxEarnings` | Maximum earnings subject to NAPSA |
| `overtimeRate` | Overtime pay multiplier (e.g., 1.5x) |
| `holidayRate` | Holiday pay multiplier (e.g., 2x) |
| `workingDaysPerMonth` | Standard working days per month |
| `hoursPerDay` | Standard hours per day |

**Example:**
```bash
curl -X GET http://localhost:8080/api/settings/payroll/latest \
  -H "Authorization: Bearer <token>"
```

---

### GET /api/settings/payroll/{id}

Get payroll settings by ID.

**Example:**
```bash
curl -X GET http://localhost:8080/api/settings/payroll/550e8400-e29b-41d4-a716-446655440080 \
  -H "Authorization: Bearer <token>"
```

---

### POST /api/settings/payroll

Create new payroll settings.

**Request Body:**
```json
{
  "effectiveDate": "2024-07-01",
  "nhimaEmployeePercent": 1.00,
  "nhimaEmployerPercent": 1.00,
  "napsaEmployeePercent": 5.00,
  "napsaEmployerPercent": 5.00,
  "overtimeRate": 1.50,
  "holidayRate": 2.00,
  "workingDaysPerMonth": 22,
  "hoursPerDay": 8,
  "napsaMaxEarnings": 5000.00
}
```

**Response `201 Created`**

**Example:**
```bash
curl -X POST http://localhost:8080/api/settings/payroll \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "effectiveDate": "2024-07-01",
    "nhimaEmployeePercent": 1.00,
    "nhimaEmployerPercent": 1.00,
    "napsaEmployeePercent": 5.00,
    "napsaEmployerPercent": 5.00,
    "overtimeRate": 1.50,
    "holidayRate": 2.00,
    "workingDaysPerMonth": 22,
    "hoursPerDay": 8,
    "napsaMaxEarnings": 5000.00
  }'
```

---

### PUT /api/settings/payroll/{id}

Update payroll settings.

**Response `200 OK`**

---

## 11. Dashboard

**Required Role:** Authenticated (`ADMIN`, `HR`, `MANAGER`, or any authenticated user)

### GET /api/dashboard

Get dashboard statistics and summary data.

**Response `200 OK`:**
```json
{
  "totalEmployees": 150,
  "activeEmployees": 145,
  "pendingPayrolls": 2,
  "totalDepartments": 8,
  "monthlyPayrollTotal": 850000.00,
  "activeLoansTotal": 250000.00,
  "recentActivity": [...]
}
```

> **Note:** The actual response fields depend on the `DashboardService` implementation.

**Example:**
```bash
curl -X GET http://localhost:8080/api/dashboard \
  -H "Authorization: Bearer <token>"
```

---

## 12. Reports

**Required Role:** `ADMIN`, `HR`, or `MANAGER`

### GET /api/reports/payroll-summary

Get a payroll summary for a specific month/year.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `month` | Integer | Yes | Month (1-12) |
| `year` | Integer | Yes | Year (e.g., 2024) |
| `departmentId` | UUID | No | Filter by department |

**Response `200 OK`:**
```json
{
  "totalEmployees": 45,
  "totalGrossSalary": 650000.00,
  "totalDeductions": 130000.00,
  "totalNetSalary": 520000.00,
  "totalNhima": 6500.00,
  "totalNapsa": 25000.00,
  "totalPaye": 85000.00,
  "totalLoanDeductions": 13500.00
}
```

**Example:**
```bash
curl -X GET "http://localhost:8080/api/reports/payroll-summary?month=6&year=2024&departmentId=550e8400-e29b-41d4-a716-446655440010" \
  -H "Authorization: Bearer <token>"
```

---

### GET /api/reports/employee-history/{employeeId}

Get the payroll history for a specific employee.

**Response `200 OK`:**
```json
[
  {
    "id": "550e8400-...",
    "payrollRun": { "id": "...", "month": 5, "year": 2024, "status": "APPROVED" },
    "employee": { "id": "...", "firstName": "John", "lastName": "Doe" },
    "basicSalary": 15000.00,
    "regularHours": 176.00,
    "regularAmount": 15000.00,
    "overtimeHours": 10.00,
    "overtimeAmount": 1278.41,
    "grossSalary": 16278.41,
    "nhima": 150.00,
    "napsa": 250.00,
    "paye": 2850.00,
    "loanDeduction": 500.00,
    "netSalary": 12528.41,
    "createdAt": "2024-05-31T15:00:00"
  }
]
```

**Example:**
```bash
curl -X GET http://localhost:8080/api/reports/employee-history/550e8400-e29b-41d4-a716-446655440001 \
  -H "Authorization: Bearer <token>"
```

---

### GET /api/reports/expenses

Get an expense report for a specific month/year.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `month` | Integer | Yes | Month (1-12) |
| `year` | Integer | Yes | Year (e.g., 2024) |

**Response `200 OK`:**
```json
{
  "totalExpenses": 45000.00,
  "expenseCount": 15,
  "expensesByCategory": {...}
}
```

**Example:**
```bash
curl -X GET "http://localhost:8080/api/reports/expenses?month=6&year=2024" \
  -H "Authorization: Bearer <token>"
```

---

### GET /api/reports/export/excel

Export payroll data as an Excel (.xlsx) file.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `month` | Integer | Yes | Month (1-12) |
| `year` | Integer | Yes | Year (e.g., 2024) |

**Response `200 OK`:** Binary Excel file with `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` and `Content-Disposition: attachment; filename=payroll-report.xlsx`.

**Example:**
```bash
curl -X GET "http://localhost:8080/api/reports/export/excel?month=6&year=2024" \
  -H "Authorization: Bearer <token>" \
  -o payroll-report.xlsx
```

---

### GET /api/reports/export/pdf

Export payroll data as a PDF file.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `month` | Integer | Yes | Month (1-12) |
| `year` | Integer | Yes | Year (e.g., 2024) |

**Response `200 OK`:** Binary PDF file with `Content-Type: application/pdf` and `Content-Disposition: attachment; filename=payroll-report.pdf`.

**Example:**
```bash
curl -X GET "http://localhost:8080/api/reports/export/pdf?month=6&year=2024" \
  -H "Authorization: Bearer <token>" \
  -o payroll-report.pdf
```

---

## 13. Audit Logs

**Required Role:** `ADMIN`

### GET /api/audit-logs

Search audit logs with optional filters.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | UUID | No | Filter by user |
| `entityName` | String | No | Filter by entity name (e.g., `Employee`, `PayrollRun`) |
| `action` | String | No | Filter by action (e.g., `CREATE`, `UPDATE`, `DELETE`) |
| `startDate` | DateTime (ISO) | No | Filter from date (e.g., `2024-01-01T00:00:00`) |
| `endDate` | DateTime (ISO) | No | Filter to date (e.g., `2024-06-30T23:59:59`) |
| `page` | Integer | No | Page number (0-based) |
| `size` | Integer | No | Page size |

**Response `200 OK`:**
```json
{
  "content": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440090",
      "user": { "id": "...", "firstName": "Admin", ... },
      "action": "UPDATE",
      "entityName": "Employee",
      "entityId": "550e8400-...",
      "oldValue": "{\"salary\": 14000}",
      "newValue": "{\"salary\": 15000}",
      "ipAddress": "192.168.1.100",
      "timestamp": "2024-06-18T10:30:00"
    }
  ],
  "pageable": {...},
  "totalElements": 1,
  "totalPages": 1,
  ...
}
```

**Example:**
```bash
curl -X GET "http://localhost:8080/api/audit-logs?action=UPDATE&entityName=Employee&startDate=2024-01-01T00:00:00&endDate=2024-06-30T23:59:59&page=0&size=20" \
  -H "Authorization: Bearer <token>"
```

---

## 14. Payroll Imports

**Required Role:** `ADMIN` or `HR`

### POST /api/payroll-import/upload

Upload a CSV/excel file for payroll data import.

**Form Data (multipart/form-data):**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `file` | File | Yes | CSV or Excel file |
| `payrollRunId` | UUID | Yes | Target payroll run ID |

> **Note:** The `userId` is extracted from the JWT token automatically.

**Response `201 Created`:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440100",
  "payrollRun": { "id": "550e8400-...", "month": 6, "year": 2024 },
  "fileName": "payroll-june-2024.csv",
  "filePath": "uploads/payroll-june-2024.csv",
  "totalRows": 50,
  "successRows": 45,
  "errorRows": 5,
  "status": "UPLOADED",
  "createdBy": { "id": "...", ... },
  "createdAt": "2024-06-18T12:00:00"
}
```

**Example:**
```bash
curl -X POST http://localhost:8080/api/payroll-import/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@payroll-june-2024.csv" \
  -F "payrollRunId=550e8400-e29b-41d4-a716-446655440030"
```

**Import Statuses:**
| Status | Description |
|--------|-------------|
| `UPLOADED` | File uploaded, pending validation |
| `VALIDATED` | File validated successfully |
| `IMPORTED` | Data imported into payroll entries |
| `FAILED` | Import failed |

---

### GET /api/payroll-import/by-run/{payrollRunId}

Get all imports for a specific payroll run.

**Example:**
```bash
curl -X GET http://localhost:8080/api/payroll-import/by-run/550e8400-e29b-41d4-a716-446655440030 \
  -H "Authorization: Bearer <token>"
```

---

### GET /api/payroll-import/{id}

Get an import record by ID.

**Example:**
```bash
curl -X GET http://localhost:8080/api/payroll-import/550e8400-e29b-41d4-a716-446655440100 \
  -H "Authorization: Bearer <token>"
```

---

## 15. Error Responses

### Standard Error Format

```json
{
  "timestamp": "2024-06-18T12:00:00",
  "status": 404,
  "error": "Not Found",
  "message": "Employee not found with id: 550e8400-..."
}
```

### Validation Error Format

```json
{
  "timestamp": "2024-06-18T12:00:00",
  "status": 400,
  "error": "Validation Failed",
  "fieldErrors": {
    "email": "Email is required",
    "firstName": "First name is required",
    "basicSalary": "Basic salary is required"
  }
}
```

### HTTP Status Code Reference

| Status Code | Description |
|-------------|-------------|
| `200 OK` | Request succeeded |
| `201 Created` | Resource created successfully |
| `204 No Content` | Request succeeded, no response body |
| `400 Bad Request` | Validation failed or malformed request |
| `401 Unauthorized` | Missing or invalid authentication token |
| `403 Forbidden` | Insufficient permissions |
| `404 Not Found` | Resource not found |
| `409 Conflict` | Duplicate resource (email, employee number) |
| `422 Unprocessable Entity` | Business rule violation |
| `429 Too Many Requests` | Account locked due to failed attempts |
| `500 Internal Server Error` | Unexpected server error |

---

## 16. Enums Reference

### Role

| Value | Description |
|-------|-------------|
| `ADMIN` | Full system access |
| `HR` | Employee & payroll operations |
| `MANAGER` | View reports & approve payrolls |

### EmployeeStatus

| Value | Description |
|-------|-------------|
| `ACTIVE` | Currently employed |
| `INACTIVE` | Not currently active |
| `TERMINATED` | Employment terminated |

### EmploymentType

| Value | Description |
|-------|-------------|
| `FULL_TIME` | Full-time employee |
| `PART_TIME` | Part-time employee |
| `CONTRACT` | Contract worker |

### SalaryType

| Value | Description |
|-------|-------------|
| `MONTHLY` | Paid monthly salary |
| `HOURLY` | Paid hourly wage |

### PayrollRunStatus

| Value | Description |
|-------|-------------|
| `DRAFT` | Initial draft, editable |
| `SUBMITTED` | Submitted for approval |
| `APPROVED` | Approved and finalized |
| `REJECTED` | Rejected, can be reopened |

### LoanStatus

| Value | Description |
|-------|-------------|
| `ACTIVE` | Loan being repaid |
| `COMPLETED` | Fully repaid |
| `CANCELLED` | Cancelled before completion |

### ImportStatus

| Value | Description |
|-------|-------------|
| `UPLOADED` | File uploaded, pending validation |
| `VALIDATED` | File validated |
| `IMPORTED` | Successfully imported |
| `FAILED` | Import processing failed |

---

## Quick Start Workflow

1. **Authenticate** — `POST /api/auth/login` to get your JWT token
2. **Create Departments** — `POST /api/departments`
3. **Add Employees** — `POST /api/employees` (get next number via `GET /api/employees/next-number`)
4. **Configure Settings** — `POST /api/settings/payroll` and `POST /api/settings/tax-brackets`
5. **Create Payroll Run** — `POST /api/payroll-runs`
6. **Import Data** — `POST /api/payroll-import/upload`
7. **Submit for Approval** — `PUT /api/payroll-runs/{id}/submit`
8. **Approve** — `PUT /api/payroll-runs/{id}/approve`
9. **Generate Payslips** — `POST /api/payslips/generate/{payrollRunId}`
10. **Download Reports** — `GET /api/reports/export/excel` or `GET /api/reports/export/pdf`

---

## Swagger UI

An interactive Swagger UI is available at:

**[http://localhost:8080/swagger-ui.html](http://localhost:8080/swagger-ui.html)**

The OpenAPI spec is available at:

**[http://localhost:8080/api-docs](http://localhost:8080/api-docs)**
