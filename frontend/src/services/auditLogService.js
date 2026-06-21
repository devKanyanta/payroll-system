import api from './api';

export const auditLogService = {
  getAll: (params) => api.get('/audit-logs', { params }),
};
