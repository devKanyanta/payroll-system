import api from './api';

export const cashflowService = {
  getRevenues: (month, year) =>
    api.get('/cashflow', { params: { month, year } }),

  getSummary: (month, year) =>
    api.get('/cashflow/summary', { params: { month, year } }),

  getById: (id) =>
    api.get(`/cashflow/${id}`),

  create: (data) =>
    api.post('/cashflow', data),

  update: (id, data) =>
    api.put(`/cashflow/${id}`, data),

  delete: (id) =>
    api.delete(`/cashflow/${id}`),

  batchUpdate: (requests) =>
    api.post('/cashflow/batch', requests),

  recalculate: (month, year) =>
    api.post('/cashflow/recalculate', null, { params: { month, year } }),
};
