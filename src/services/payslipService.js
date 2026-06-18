import api from './api';

export const payslipService = {
  getByEmployee: (employeeId) => api.get('/payslips', { params: { employeeId } }),
  getById: (id) => api.get(`/payslips/${id}`),
  generate: (payrollRunId) => api.post(`/payslips/generate/${payrollRunId}`),
  email: (id) => api.post(`/payslips/${id}/email`),
  download: (id) => api.get(`/payslips/${id}/download`, { responseType: 'blob' }),
};
