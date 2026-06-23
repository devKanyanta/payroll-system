import { Routes, Route, Navigate } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout';
import DashboardLayout from '../layouts/DashboardLayout';
import ProtectedRoute from '../components/ProtectedRoute';
import Login from '../pages/Login';
import ForgotPassword from '../pages/ForgotPassword';
import ResetPassword from '../pages/ResetPassword';
import ChangePassword from '../pages/ChangePassword';
import Dashboard from '../pages/Dashboard';
import Employees from '../pages/Employees';
import EmployeeDetails from '../pages/EmployeeDetails';
import EmployeeImport from '../pages/EmployeeImport';
import Departments from '../pages/Departments';
import Loans from '../pages/Loans';
import PayrollRuns from '../pages/PayrollRuns';
import PayrollRunDetails from '../pages/PayrollRunDetails';
import PayrollImport from '../pages/PayrollImport';
import Payslips from '../pages/Payslips';
import Expenses from '../pages/Expenses';
import Settings from '../pages/Settings';
import Users from '../pages/Users';
import Reports from '../pages/Reports';
import AuditLogs from '../pages/AuditLogs';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* Auth routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
      </Route>

      {/* Protected routes */}
      <Route element={
        <ProtectedRoute>
          <DashboardLayout />
        </ProtectedRoute>
      }>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/employees" element={<Employees />} />
        <Route path="/employees/:id" element={<EmployeeDetails />} />
        <Route path="/employees/import" element={<EmployeeImport />} />
        <Route path="/departments" element={<Departments />} />
        <Route path="/loans" element={<Loans />} />
        <Route path="/payroll-runs" element={<PayrollRuns />} />
        <Route path="/payroll-runs/new" element={<PayrollRunDetails />} />
        <Route path="/payroll-runs/:id" element={<PayrollRunDetails />} />
        <Route path="/payroll-import" element={<PayrollImport />} />
        <Route path="/payslips" element={<Payslips />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/change-password" element={<ChangePassword />} />

        {/* Admin-only routes */}
        <Route path="/users" element={
          <ProtectedRoute roles={['ADMIN']}>
            <Users />
          </ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute roles={['ADMIN']}>
            <Settings />
          </ProtectedRoute>
        } />
        <Route path="/audit-logs" element={
          <ProtectedRoute roles={['ADMIN']}>
            <AuditLogs />
          </ProtectedRoute>
        } />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
