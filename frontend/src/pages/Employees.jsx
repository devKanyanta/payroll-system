import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Button, TextField, Select, MenuItem, FormControl,
  InputLabel, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, IconButton, Chip, Card, CardContent,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TablePagination, Grid, InputAdornment,
} from '@mui/material';
import {
  Add, Edit, Delete, Search, Visibility, FilterList,
} from '@mui/icons-material';
import { employeeService } from '../services/employeeService';
import { departmentService } from '../services/departmentService';
import LoadingScreen from '../components/LoadingScreen';
import ConfirmDialog from '../components/ConfirmDialog';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

const statusColors = { ACTIVE: 'success', INACTIVE: 'warning', TERMINATED: 'error' };

const emptyEmployee = {
  firstName: '', lastName: '', email: '', phone: '', nrc: '',
  departmentId: '', position: '', site: '', employmentType: 'FULL_TIME',
  salaryType: 'MONTHLY', bankName: '', accountNumber: '',
  dateHired: '', rate: '', status: 'ACTIVE', employeeNumber: '',
};

export default function Employees() {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
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
    queryKey: ['employees', page, rowsPerPage, search, statusFilter, departmentFilter],
    queryFn: async () => {
      const params = {
        page, size: rowsPerPage, sort: 'lastName,asc',
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter }),
        ...(departmentFilter && { departmentId: departmentFilter }),
      };
      const res = await employeeService.getAll(params);
      return res.data;
    },
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

  const openCreate = async () => {
    setEditId(null);
    setForm(emptyEmployee);
    setErrors({});
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
      accountNumber: emp.accountNumber || '',
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

  if (isLoading) return <LoadingScreen />;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4">Employees</Typography>
          <Typography variant="body2" color="text.secondary">
            {pageData?.totalElements || 0} total employees
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={openCreate}>
          Add Employee
        </Button>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ pb: 1 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth placeholder="Search employees..." size="small"
                value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select value={statusFilter} label="Status" onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}>
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="ACTIVE">Active</MenuItem>
                  <MenuItem value="INACTIVE">Inactive</MenuItem>
                  <MenuItem value="TERMINATED">Terminated</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Department</InputLabel>
                <Select value={departmentFilter} label="Department" onChange={(e) => { setDepartmentFilter(e.target.value); setPage(0); }}>
                  <MenuItem value="">All</MenuItem>
                  {departments?.map((d) => (
                    <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Employee #</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Department</TableCell>
                <TableCell>Position</TableCell>
                <TableCell>Rate/Hr</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pageData?.content?.length === 0 ? (
                <TableRow><TableCell colSpan={8} align="center">No employees found</TableCell></TableRow>
              ) : (
                pageData?.content?.map((emp) => (
                  <TableRow key={emp.id} hover sx={{ cursor: 'pointer' }}>
                    <TableCell onClick={() => navigate(`/employees/${emp.id}`)}>
                      <Typography variant="body2" fontWeight={500}>{emp.employeeNumber}</Typography>
                    </TableCell>
                    <TableCell onClick={() => navigate(`/employees/${emp.id}`)}>
                      {emp.firstName} {emp.lastName}
                    </TableCell>
                    <TableCell onClick={() => navigate(`/employees/${emp.id}`)}>{emp.email}</TableCell>
                    <TableCell onClick={() => navigate(`/employees/${emp.id}`)}>{emp.departmentName || '-'}</TableCell>
                    <TableCell onClick={() => navigate(`/employees/${emp.id}`)}>{emp.position || '-'}</TableCell>
                    <TableCell onClick={() => navigate(`/employees/${emp.id}`)}>
                      ZMW {emp.rate?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) || '-'}
                    </TableCell>
                    <TableCell>
                      <Chip label={emp.status} color={statusColors[emp.status] || 'default'} size="small" />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => navigate(`/employees/${emp.id}`)}>
                        <Visibility />
                      </IconButton>
                      <IconButton size="small" onClick={() => openEdit(emp)}>
                        <Edit />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => setDeleteId(emp.id)}>
                        <Delete />
                      </IconButton>
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="md" fullWidth>
        <DialogTitle>{editId ? 'Edit Employee' : 'Add Employee'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth label="Employee #" value={form.employeeNumber} onChange={handleChange('employeeNumber')}
                helperText={errors.employeeNumber} error={!!errors.employeeNumber} />
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
                <InputLabel>Department</InputLabel>
                <Select value={form.departmentId} label="Department" onChange={handleChange('departmentId')}>
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
                <InputLabel>Employment Type *</InputLabel>
                <Select value={form.employmentType} label="Employment Type *" onChange={handleChange('employmentType')} required>
                  <MenuItem value="FULL_TIME">Full Time</MenuItem>
                  <MenuItem value="PART_TIME">Part Time</MenuItem>
                  <MenuItem value="CONTRACT">Contract</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Salary Type *</InputLabel>
                <Select value={form.salaryType} label="Salary Type *" onChange={handleChange('salaryType')} required>
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
              <TextField fullWidth label="Account Number" value={form.accountNumber} onChange={handleChange('accountNumber')} />
            </Grid>
            {editId && (
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select value={form.status} label="Status" onChange={handleChange('status')}>
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
            {editId ? 'Update' : 'Create'} Employee
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
