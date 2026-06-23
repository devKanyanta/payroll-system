import api from './api';

export const employeeImportService = {
  upload: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/employees/import/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  process: (id) => api.post(`/employees/import/${id}/process`),
  getById: (id) => api.get(`/employees/import/${id}`),
  getByUser: () => api.get('/employees/import/by-user'),
  downloadTemplate: () => api.get('/employees/import/template', { responseType: 'blob' }),
};
