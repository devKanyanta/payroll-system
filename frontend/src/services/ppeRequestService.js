import api from './api';

export const ppeRequestService = {
  getAll: (employeeId) =>
    api.get('/ppe-requests', { params: { employeeId } }),
  getPending: () => api.get('/ppe-requests/pending'),
  getPendingCount: () => api.get('/ppe-requests/pending/count'),
  getById: (id) => api.get(`/ppe-requests/${id}`),
  create: (data) => api.post('/ppe-requests', data),
  update: (id, data) => api.put(`/ppe-requests/${id}`, data),
  delete: (id) => api.delete(`/ppe-requests/${id}`),
  approve: (id) => api.put(`/ppe-requests/${id}/approve`),
  reject: (id) => api.put(`/ppe-requests/${id}/reject`),
};
