import api from './api';
import { downloadBlob } from './downloadUtils';

export const payrollRunService = {
  getAll: (params) => api.get('/payroll-runs', { params }),
  getById: (id) => api.get(`/payroll-runs/${id}`),
  create: (data) => api.post('/payroll-runs', data),
  submit: (id) => api.put(`/payroll-runs/${id}/submit`),
  approve: (id) => api.put(`/payroll-runs/${id}/approve`),
  reject: (id, reason) => api.put(`/payroll-runs/${id}/reject`, { reason }),
  reopen: (id) => api.put(`/payroll-runs/${id}/reopen`),
  addEmployees: (id, employeeIds) => api.post(`/payroll-runs/${id}/add-employees`, { employeeIds }),
  removeEntry: (runId, entryId) => api.delete(`/payroll-runs/${runId}/entries/${entryId}`),
  updateEntry: (runId, entryId, data) => api.put(`/payroll-runs/${runId}/entries/${entryId}`, data),
  recalculateDeductions: (id) => api.put(`/payroll-runs/${id}/recalculate-deductions`),
  exportExcel: async (id) => {
    const res = await api.get(`/payroll-runs/${id}/export/excel`, {
      responseType: 'blob',
    });
    downloadBlob(res.data, `payroll-run-${id}.xlsx`);
  },
};
