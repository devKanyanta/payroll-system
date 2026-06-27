import { useState } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Button, TextField, Select, MenuItem, FormControl,
  InputLabel, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, IconButton, Chip, Card, CardContent,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TablePagination, Grid, Stack, Tooltip, alpha,
} from '@mui/material';
import {
  Add, Edit, Delete, Search, Visibility, Group, Badge, Business, TrendingUp,
} from '@mui/icons-material';
import { employeeService } from '../services/employeeService';
import { departmentService } from '../services/departmentService';
import LoadingScreen from '../components/LoadingScreen';
import ConfirmDialog from '../components/ConfirmDialog';
import { useNavigate } from 'react-router-dom';

const STATUS_COLORS = {
  ACTIVE: { color: '#059669', bg: '#d1fae5' },
  INACTIVE: { color: '#d97706', bg: '#fef3c7' },
  TERMINATED: { color: '#dc2626', bg: '#fee2e2' },
};

function StatusChip({ status }) {
  const colors = STATUS_COLORS[status] || { color: '#6b7280', bg: '#f3f4f6' };
  return (
    <Chip
      label={status}
      size="small"
      sx={{
        fontWeight: 600,
        fontSize: '0.75rem',
        color: colors.color,
        bgcolor: colors.bg,
        textTransform: 'capitalize',
      }}
    />
  );
}

const emptyEmployee = {
  firstName: '', lastName: '', email: '', phone: '', nrc: '',
  departmentId: '', position: '', site: '', employmentType: 'FULL_TIME',
  salaryType: 'MONTHLY', bankName: '', sortCode: '', accountNumber: '',
  dateHired: '', rate: '', status: 'ACTIVE', employeeNumber: '',
};

export default function Employees() {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyEmployee);
  const [deleteId, setDeleteId] = useState(null);
  const [errors, setErrors] = useState({});
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => { const res = await departmentService.getAll(); return res.data; },
  });

  const { data: pageData, isLoading } = useQuery({
    queryKey: ['employees', page, rowsPerPage, debouncedSearch, statusFilter, departmentFilter],
    queryFn: async () => {
      const params = {
        page, size: rowsPerPage, sort: 'lastName,asc',
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(statusFilter && { status: statusFilter }),
        ...(departmentFilter && { departmentId: departmentFilter }),
      };
      const res = await employeeService.getAll(params);
      return res.data;
    },
    // Pause background refetches while the form dialog is open
    // so typing in form fields doesn't trigger distracting data reloads
    enabled: !dialogOpen,
  });

  const createMutation = useMutation({
    mutationFn: (data) => employeeService.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['employees'] }); closeDialog(); },
    onError: (err) => setErrors(err.response?.data?.fieldErrors || { message: err.response?.data?.message }),
  });

  const updateMutation = useMutation({
    mutationFn: (data) => employeeService.update(editId, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['employees'] }); closeDialog(); },
    onError: (err) => setErrors(err.response?.data?.fieldErrors || { message: err.response?.data?.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => employeeService.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['employees'] }); setDeleteId(null); },
  });

  // ── Derived stats ──
  const total = pageData?.totalElements || 0;
  const activeCount = pageData?.content?.filter((e) => e.status === 'ACTIVE').length || 0;
  const deptCount = departments?.length || 0;

  const openCreate = async () => {
    setEditId(null);
    setForm(emptyEmployee);
    setErrors({});
    const today = new Date().toISOString().split('T')[0];
    setForm((prev) => ({ ...prev, dateHired: today }));
    try {
      const res = await employeeService.getNextNumber();
      setForm((prev) => ({ ...prev, employeeNumber: res.data }));
    } catch {}
    setDialogOpen(true);
  };

  const openEdit = (emp) => {
    setEditId(emp.id);
    setForm({
      firstName: emp.firstName, lastName: emp.lastName, email: emp.email,
      phone: emp.phone || '', nrc: emp.nrc, departmentId: emp.departmentId || '',
      position: emp.position || '', site: emp.site || '', employmentType: emp.employmentType,
      salaryType: emp.salaryType, bankName: emp.bankName || '',
      sortCode: emp.sortCode || '', accountNumber: emp.accountNumber || '',
      dateHired: emp.dateHired, rate: emp.rate || '',
      status: emp.status, employeeNumber: emp.employeeNumber,
    });
    setErrors({});
    setDialogOpen(true);
  };

  const closeDialog = () => { setDialogOpen(false); setEditId(null); setForm(emptyEmployee); setErrors({}); };

  const handleSubmit = () => {
    const data = {
      ...form,
      rate: parseFloat(form.rate) || null,
    };
    if (editId) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  // Only show loading screen on initial page load, not on background refetches
  if (isLoading && !pageData) return <LoadingScreen />;

  return (
    <Box>
      {/* ── Header ── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Employees</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your workforce — add, edit, and view employee profiles
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={openCreate}>
          Add Employee
        </Button>
      </Box>

      {/* ── Summary Cards ── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={6} md={3}>
          <Card sx={{ bgcolor: alpha('#2563eb', 0.08), border: '1px solid', borderColor: alpha('#2563eb', 0.2) }}>
            <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Box sx={{
                  width: 40, height: 40, borderRadius: 1.5,
                  bgcolor: alpha('#2563eb', 0.12),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Group sx={{ color: '#2563eb', fontSize: 20 }} />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={500}>Total</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>{total}</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <Card sx={{ bgcolor: alpha('#059669', 0.08), border: '1px solid', borderColor: alpha('#059669', 0.2) }}>
            <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Box sx={{
                  width: 40, height: 40, borderRadius: 1.5,
                  bgcolor: alpha('#059669', 0.12),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Badge sx={{ color: '#059669', fontSize: 20 }} />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={500}>Active</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>{activeCount}</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <Card>
            <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Box sx={{
                  width: 40, height: 40, borderRadius: 1.5,
                  bgcolor: alpha('#6b7280', 0.08),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Business sx={{ color: 'text.secondary', fontSize: 20 }} />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={500}>Departments</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>{deptCount}</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <Card>
            <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Box sx={{
                  width: 40, height: 40, borderRadius: 1.5,
                  bgcolor: alpha('#8b5cf6', 0.08),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <TrendingUp sx={{ color: '#8b5cf6', fontSize: 20 }} />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={500}>Inactive</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>{total - activeCount}</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ── Filters ── */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ pb: '12px !important' }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth placeholder="Search by name, email, or NRC..." size="small"
                value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                InputProps={{
                  startAdornment: (
                    <Box component="span" sx={{ mr: 1, display: 'flex', color: 'text.disabled' }}>
                      <Search fontSize="small" />
                    </Box>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel id="filter-status-label">Status</InputLabel>
                <Select labelId="filter-status-label" id="filter-status-select" value={statusFilter} label="Status" onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}>
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="ACTIVE">Active</MenuItem>
                  <MenuItem value="INACTIVE">Inactive</MenuItem>
                  <MenuItem value="TERMINATED">Terminated</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel id="filter-dept-label">Department</InputLabel>
                <Select labelId="filter-dept-label" id="filter-dept-select" value={departmentFilter} label="Department" onChange={(e) => { setDepartmentFilter(e.target.value); setPage(0); }}>
                  <MenuItem value="">All</MenuItem>
                  {departments?.map((d) => (
                    <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: { sm: 'right' } }}>
                {total} employee{total !== 1 ? 's' : ''}
                {statusFilter && ` · ${statusFilter.toLowerCase()}`}
                {departmentFilter && ` · filtered by department`}
                {debouncedSearch && ` · matching "${debouncedSearch}"`}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* ── Table ── */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Employee #</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Email / Phone</TableCell>
                <TableCell>Department</TableCell>
                <TableCell>Position</TableCell>
                <TableCell>Rate/Hr</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pageData?.content?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      {debouncedSearch || statusFilter || departmentFilter
                        ? 'No employees match your filters'
                        : 'No employees yet. Add your first employee to get started.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                pageData?.content?.map((emp) => (
                  <TableRow
                    key={emp.id}
                    hover
                    sx={{
                      cursor: 'pointer',
                      '&:last-child td': { border: 0 },
                      ...(emp.status === 'ACTIVE' && {
                        '&:hover': { bgcolor: alpha('#059669', 0.04) },
                      }),
                    }}
                  >
                    <TableCell onClick={() => navigate(`/employees/${emp.id}`)}>
                      <Typography variant="body2" fontWeight={600} sx={{ fontFamily: 'monospace' }}>
                        {emp.employeeNumber}
                      </Typography>
                    </TableCell>
                    <TableCell onClick={() => navigate(`/employees/${emp.id}`)}>
                      <Typography variant="body2" fontWeight={500}>
                        {emp.firstName} {emp.lastName}
                      </Typography>
                    </TableCell>
                    <TableCell onClick={() => navigate(`/employees/${emp.id}`)}>
                      <Typography variant="body2">{emp.email || '—'}</Typography>
                      {emp.phone && (
                        <Typography variant="caption" color="text.secondary">{emp.phone}</Typography>
                      )}
                    </TableCell>
                    <TableCell onClick={() => navigate(`/employees/${emp.id}`)}>
                      <Typography variant="body2">{emp.departmentName || '—'}</Typography>
                    </TableCell>
                    <TableCell onClick={() => navigate(`/employees/${emp.id}`)}>
                      <Typography variant="body2">{emp.position || '—'}</Typography>
                    </TableCell>
                    <TableCell onClick={() => navigate(`/employees/${emp.id}`)}>
                      <Typography variant="body2" fontWeight={600}>
                        {emp.rate != null
                          ? `ZMW ${Number(emp.rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <StatusChip status={emp.status} />
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Tooltip title="View employee details">
                          <IconButton size="small" onClick={() => navigate(`/employees/${emp.id}`)}>
                            <Visibility fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit employee">
                          <IconButton size="small" onClick={() => openEdit(emp)}>
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={emp.status === 'ACTIVE' ? 'Deactivate employee' : 'Delete'}>
                          <IconButton size="small" color="error" onClick={() => setDeleteId(emp.id)}>
                            <Delete fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={pageData?.totalElements || 0}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
        />
      </Card>

      {/* ── Create/Edit Dialog ── */}
      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editId ? 'Edit Employee' : 'Add Employee'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth label="Employee #" value={form.employeeNumber} onChange={handleChange('employeeNumber')}
                helperText={errors.employeeNumber} error={!!errors.employeeNumber} autoFocus />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth label="First Name *" value={form.firstName} onChange={handleChange('firstName')}
                helperText={errors.firstName} error={!!errors.firstName} required />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth label="Last Name *" value={form.lastName} onChange={handleChange('lastName')}
                helperText={errors.lastName} error={!!errors.lastName} required />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth label="Email *" type="email" value={form.email} onChange={handleChange('email')}
                helperText={errors.email} error={!!errors.email} required />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth label="Phone" value={form.phone} onChange={handleChange('phone')} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth label="NRC *" value={form.nrc} onChange={handleChange('nrc')}
                helperText={errors.nrc || 'Format: XXXXXX/XX/X'} error={!!errors.nrc} required />
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel id="form-dept-label">Department</InputLabel>
                <Select labelId="form-dept-label" id="form-dept-select" value={form.departmentId} label="Department" onChange={handleChange('departmentId')}>
                  <MenuItem value="">None</MenuItem>
                  {departments?.map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth label="Position" value={form.position} onChange={handleChange('position')} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth label="Site" value={form.site} onChange={handleChange('site')} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel id="form-employment-type-label">Employment Type *</InputLabel>
                <Select labelId="form-employment-type-label" id="form-employment-type-select" value={form.employmentType} label="Employment Type *" onChange={handleChange('employmentType')} required>
                  <MenuItem value="FULL_TIME">Full Time</MenuItem>
                  <MenuItem value="PART_TIME">Part Time</MenuItem>
                  <MenuItem value="CONTRACT">Contract</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel id="form-salary-type-label">Salary Type *</InputLabel>
                <Select labelId="form-salary-type-label" id="form-salary-type-select" value={form.salaryType} label="Salary Type *" onChange={handleChange('salaryType')} required>
                  <MenuItem value="MONTHLY">Monthly</MenuItem>
                  <MenuItem value="HOURLY">Hourly</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth label="Rate/Hr *" type="number" value={form.rate} onChange={handleChange('rate')}
                helperText={errors.rate || 'Hourly rate (matches RATE/HRS in Excel template)'} error={!!errors.rate} required />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth label="Date Hired *" type="date" value={form.dateHired} onChange={handleChange('dateHired')}
                InputLabelProps={{ shrink: true }} required />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth label="Bank Name" value={form.bankName} onChange={handleChange('bankName')} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth label="Sort Code" value={form.sortCode} onChange={handleChange('sortCode')}
                helperText="Format: XX-XX-XX" placeholder="00-00-00" />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth label="Account Number" value={form.accountNumber} onChange={handleChange('accountNumber')} />
            </Grid>
            {editId && (
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth>
                  <InputLabel id="form-status-label">Status</InputLabel>
                  <Select labelId="form-status-label" id="form-status-select" value={form.status} label="Status" onChange={handleChange('status')}>
                    <MenuItem value="ACTIVE">Active</MenuItem>
                    <MenuItem value="INACTIVE">Inactive</MenuItem>
                    <MenuItem value="TERMINATED">Terminated</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            )}
          </Grid>
          {errors.message && <Typography color="error" sx={{ mt: 1 }}>{errors.message}</Typography>}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" disabled={createMutation.isPending || updateMutation.isPending}>
            {editId ? 'Update Employee' : 'Create Employee'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Employee"
        message="Are you sure you want to deactivate this employee? They will be marked as inactive and excluded from payroll runs and active employee filters."
        onConfirm={() => deleteMutation.mutate(deleteId)}
        onCancel={() => setDeleteId(null)}
        color="error"
      />
    </Box>
  );
}
