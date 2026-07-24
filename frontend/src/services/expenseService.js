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
  exportMonthExcel: async (month, year) => {
    const res = await api.get('/expenses/export/excel', {
      params: { month, year },
      responseType: 'blob',
    });
    const monthNames = ['january','february','march','april','may','june','july','august','september','october','november','december'];
    const filename = `expenses-${monthNames[month - 1]}-${year}.xlsx`;
    downloadBlob(res.data, filename);
  },
};
