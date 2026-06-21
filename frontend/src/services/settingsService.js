import api from './api';

export const settingsService = {
  // Payroll settings
  getPayrollLatest: () => api.get('/settings/payroll/latest'),
  getPayrollById: (id) => api.get(`/settings/payroll/${id}`),
  createPayroll: (data) => api.post('/settings/payroll', data),
  updatePayroll: (id, data) => api.put(`/settings/payroll/${id}`, data),

  // Tax brackets
  getTaxBrackets: () => api.get('/settings/tax-brackets'),
  getActiveTaxBrackets: () => api.get('/settings/tax-brackets/active'),
  getTaxBracketById: (id) => api.get(`/settings/tax-brackets/${id}`),
  createTaxBracket: (data) => api.post('/settings/tax-brackets', data),
  updateTaxBracket: (id, data) => api.put(`/settings/tax-brackets/${id}`, data),
  deleteTaxBracket: (id) => api.delete(`/settings/tax-brackets/${id}`),

  // Email settings
  getEmailSettings: () => api.get('/settings/email'),
  updateEmailSettings: (data) => api.put('/settings/email', data),

  // Deduction types
  getDeductionTypes: () => api.get('/settings/deduction-types'),
  createDeductionType: (data) => api.post('/settings/deduction-types', data),
  updateDeductionType: (id, data) => api.put(`/settings/deduction-types/${id}`, data),
};
