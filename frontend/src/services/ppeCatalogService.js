import api from './api';

export const ppeCatalogService = {
  getAll: (includeInactive = false) =>
    api.get('/ppe-catalog', { params: { includeInactive } }),
  getById: (id) => api.get(`/ppe-catalog/${id}`),
  create: (data) => api.post('/ppe-catalog', data),
  update: (id, data) => api.put(`/ppe-catalog/${id}`, data),
  deactivate: (id) => api.delete(`/ppe-catalog/${id}`),
};
