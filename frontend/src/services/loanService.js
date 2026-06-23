import api from './api';

export const loanService = {
  getAll: () => api.get('/loans'),
  getByEmployee: (employeeId) => api.get('/loans', { params: { employeeId } }),
  getById: (id) => api.get(`/loans/${id}`),
  create: (data) => api.post('/loans', data),
  update: (id, data) => api.put(`/loans/${id}`, data),
  cancel: (id) => api.delete(`/loans/${id}`),
};
