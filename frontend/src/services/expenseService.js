import api from './api';
import { downloadBlob } from './downloadUtils';

export const expenseService = {
  getAll: (params) => api.get('/expenses', { params }),
  getById: (id) => api.get(`/expenses/${id}`),
  create: (data) => api.post('/expenses', data),
  update: (id, data) => api.put(`/expenses/${id}`, data),
  delete: (id) => api.delete(`/expenses/${id}`),
  approve: (id) => api.put(`/expenses/${id}/approve`),
  reject: (id, reason) => api.put(`/expenses/${id}/reject`, { reason }),
  exportRangeExcel: async (start, end, status) => {
    const params = { start, end };
    if (status) params.status = status;
    const res = await api.get('/expenses/export/excel', {
      params,
      responseType: 'blob',
    });
    const statusSuffix = status ? `-${status.toLowerCase()}` : '';
    const filename = `expenses-${start}-to-${end}${statusSuffix}.xlsx`;
    downloadBlob(res.data, filename);
  },
};
