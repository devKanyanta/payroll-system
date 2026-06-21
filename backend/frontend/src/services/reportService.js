import api from './api';
import { downloadBlob } from './downloadUtils';

export const reportService = {
  getPayrollSummary: (params) => api.get('/reports/payroll-summary', { params }),
  getEmployeeHistory: (employeeId) => api.get(`/reports/employee-history/${employeeId}`),
  getExpenseReport: (params) => api.get('/reports/expenses', { params }),
  exportExcel: async (month, year) => {
    const res = await api.get('/reports/export/excel', {
      params: { month, year },
      responseType: 'blob',
    });
    downloadBlob(res.data, `payroll-report-${month}-${year}.xlsx`);
  },
  exportPdf: async (month, year) => {
    const res = await api.get('/reports/export/pdf', {
      params: { month, year },
      responseType: 'blob',
    });
    downloadBlob(res.data, `payroll-report-${month}-${year}.pdf`);
  },
};
