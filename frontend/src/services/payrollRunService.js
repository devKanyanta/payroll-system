import api from './api';
import { downloadBlob } from './downloadUtils';

export const payrollRunService = {
  getAll: (params) => api.get('/payroll-runs', { params }),
  getById: (id) => api.get(`/payroll-runs/${id}`),
  create: (data) => api.post('/payroll-runs', data),
  submit: (id) => api.put(`/payroll-runs/${id}/submit`),
  validate: (id) => api.post(`/payroll-runs/${id}/validate`),
  approve: (id) => api.put(`/payroll-runs/${id}/approve`),
  reject: (id, reason) => api.put(`/payroll-runs/${id}/reject`, { reason }),
  reopen: (id) => api.put(`/payroll-runs/${id}/reopen`),
  addEmployees: (id, employeeIds) => api.post(`/payroll-runs/${id}/add-employees`, { employeeIds }),
  removeEntry: (runId, entryId) => api.delete(`/payroll-runs/${runId}/entries/${entryId}`),
  updateEntry: (runId, entryId, data) => api.put(`/payroll-runs/${runId}/entries/${entryId}`, data),
  recalculateDeductions: (id) => api.put(`/payroll-runs/${id}/recalculate-deductions`),
  addDeduction: (runId, entryId, deductionTypeId, amount) =>
    api.post(`/payroll-runs/${runId}/entries/${entryId}/deductions`, { deductionTypeId, amount }),
  removeDeduction: (runId, entryId, deductionId) =>
    api.delete(`/payroll-runs/${runId}/entries/${entryId}/deductions/${deductionId}`),
  emailPayslips: (id) => api.post(`/payroll-runs/${id}/email-payslips`),
  delete: (id) => api.delete(`/payroll-runs/${id}`),
  exportExcel: async (id) => {
    const res = await api.get(`/payroll-runs/${id}/export/excel`, {
      responseType: 'blob',
    });
    downloadBlob(res.data, `payroll-run-${id}.xlsx`);
  },

  exportBankPayment: async (id) => {
    const res = await api.get(`/payroll-runs/${id}/export/bank-payment`, {
      responseType: 'blob',
    });
    downloadBlob(res.data, `salary-upload-${id}.xlsx`);
  },
};
