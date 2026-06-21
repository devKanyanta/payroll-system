import api from './api';

export const employeeService = {
  getAll: (params) => api.get('/employees', { params }),
  getById: (id) => api.get(`/employees/${id}`),
  create: (data) => api.post('/employees', data),
  update: (id, data) => api.put(`/employees/${id}`, data),
  delete: (id) => api.delete(`/employees/${id}`),
  getNextNumber: () => api.get('/employees/next-number'),
  getAvailableForRun: (payrollRunId) => api.get(`/employees/available-for-run/${payrollRunId}`),
};
