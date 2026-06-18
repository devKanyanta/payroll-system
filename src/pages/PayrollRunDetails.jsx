import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Button, TextField, Card, CardContent, Grid,
  Chip, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Divider, Alert, Dialog, DialogTitle, DialogContent, DialogActions,
  Checkbox, List, ListItem, ListItemIcon, ListItemText, Paper, Snackbar,
} from '@mui/material';
import {
  ArrowBack, Send, CheckCircle, Cancel, Refresh, PictureAsPdf, Add,
  Delete, Download, PersonAdd,
} from '@mui/icons-material';
import { payrollRunService } from '../services/payrollRunService';
import { payslipService } from '../services/payslipService';
import { employeeService } from '../services/employeeService';
import LoadingScreen from '../components/LoadingScreen';
import { useAuth } from '../contexts/AuthContext';
import dayjs from 'dayjs';

const statusColors = {
  DRAFT: 'default', SUBMITTED: 'warning', APPROVED: 'success', REJECTED: 'error',
};

const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function PayrollRunDetails() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [rejectDialog, setRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [createMonth, setCreateMonth] = useState(new Date().getMonth() + 1);
  const [createYear, setCreateYear] = useState(new Date().getFullYear());
  const [addEmployeesDialog, setAddEmployeesDialog] = useState(false);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [timeValues, setTimeValues] = useState({});
  const timeValuesRef = useRef({});
  const [savingEntries, setSavingEntries] = useState({});

  // Initialize timeValues when entries load
  useEffect(() => {
    if (run?.payrollEntries) {
      setTimeValues((prev) => {
        const next = { ...prev };
        run.payrollEntries.forEach((entry) => {
          if (!next[entry.id]) {
            next[entry.id] = {
              presentDays: entry.presentDays || 0,
              overtimeHours: entry.overtimeHours || 0,
              holidayHours: entry.holidayHours || 0,
            };
          }
        });
        timeValuesRef.current = next;
        return next;
      });
    }
  }, [run?.payrollEntries]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const { data: run, isLoading } = useQuery({
    queryKey: ['payroll-run', id],
    queryFn: async () => { const res = await payrollRunService.getById(id); return res.data; },
    enabled: !isNew,
  });

  const { data: availableEmployees } = useQuery({
    queryKey: ['available-employees', id],
    queryFn: async () => { const res = await employeeService.getAvailableForRun(id); return res.data; },
    enabled: !!id && addEmployeesDialog,
  });

  const createMutation = useMutation({
    mutationFn: (data) => payrollRunService.create(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
      navigate(`/payroll-runs/${res.data.id}`);
    },
  });

  const submitMutation = useMutation({
    mutationFn: () => payrollRunService.submit(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payroll-run', id] }),
  });

  const approveMutation = useMutation({
    mutationFn: () => payrollRunService.approve(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payroll-run', id] }),
  });

  const rejectMutation = useMutation({
    mutationFn: (reason) => payrollRunService.reject(id, reason),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['payroll-run', id] }); setRejectDialog(false); setRejectReason(''); },
  });

  const reopenMutation = useMutation({
    mutationFn: () => payrollRunService.reopen(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payroll-run', id] }),
  });

  const addEmployeesMutation = useMutation({
    mutationFn: (employeeIds) => payrollRunService.addEmployees(id, employeeIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-run', id] });
      setAddEmployeesDialog(false);
      setSelectedEmployeeIds([]);
    },
  });

  const removeEntryMutation = useMutation({
    mutationFn: (entryId) => payrollRunService.removeEntry(id, entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-run', id] });
      setDeleteConfirm(null);
    },
  });

  const generatePayslipsMutation = useMutation({
    mutationFn: () => payslipService.generate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payroll-run', id] }),
  });

  const updateEntryMutation = useMutation({
    mutationFn: ({ entryId, data }) => payrollRunService.updateEntry(id, entryId, data),
    onSuccess: (res) => {
      // Update local timeValues with server response to keep in sync
      const entryId = res.data.id;
      setTimeValues((prev) => {
        const next = {
          ...prev,
          [entryId]: {
            presentDays: res.data.presentDays || 0,
            overtimeHours: res.data.overtimeHours || 0,
            holidayHours: res.data.holidayHours || 0,
          },
        };
        timeValuesRef.current = next;
        return next;
      });
      setSavingEntries((prev) => ({ ...prev, [entryId]: false }));
      queryClient.invalidateQueries({ queryKey: ['payroll-run', id] });
    },
    onError: (err, variables) => {
      setSavingEntries((prev) => ({ ...prev, [variables?.entryId]: false }));
      setSnackbar({ open: true, message: 'Failed to update entry: ' + (err.response?.data?.message || err.message), severity: 'error' });
    },
  });

  const recalculateMutation = useMutation({
    mutationFn: () => payrollRunService.recalculateDeductions(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-run', id] });
      setSnackbar({ open: true, message: 'Loan deductions recalculated successfully', severity: 'success' });
    },
    onError: (err) => {
      setSnackbar({ open: true, message: 'Failed to recalculate deductions: ' + (err.response?.data?.message || err.message), severity: 'error' });
    },
  });

  const handleTimeChange = useCallback((entryId, field, value) => {
    const parsed = parseFloat(value) || 0;
    setTimeValues((prev) => {
      const next = {
        ...prev,
        [entryId]: {
          ...(prev[entryId] || {}),
          [field]: parsed,
        },
      };
      timeValuesRef.current = next;
      return next;
    });
  }, []);

  const handleTimeBlur = useCallback((entryId) => {
    const values = timeValuesRef.current[entryId];
    if (!values) return;

    setSavingEntries((prev) => ({ ...prev, [entryId]: true }));
    updateEntryMutation.mutate({
      entryId,
      data: {
        presentDays: values.presentDays,
        overtimeHours: values.overtimeHours,
        holidayHours: values.holidayHours,
      },
    });
  }, [updateEntryMutation]);

  const handleToggleEmployee = (empId) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
  };

  const handleSelectAll = () => {
    if (availableEmployees && selectedEmployeeIds.length === availableEmployees.length) {
      setSelectedEmployeeIds([]);
    } else {
      setSelectedEmployeeIds(availableEmployees?.map((e) => e.id) || []);
    }
  };

  const handleExport = async () => {
    try {
      await payrollRunService.exportExcel(id);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  if (isNew) {
    return (
      <Box>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/payroll-runs')} sx={{ mb: 2 }}>
          Back to Payroll Runs
        </Button>
        <Card>
          <CardContent>
            <Typography variant="h5" sx={{ mb: 3 }}>Create New Payroll Run</Typography>
            <Grid container spacing={2} maxWidth={400}>
              <Grid item xs={6}>
                <TextField
                  fullWidth label="Month" type="number" value={createMonth}
                  onChange={(e) => setCreateMonth(parseInt(e.target.value))}
                  inputProps={{ min: 1, max: 12 }} required
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth label="Year" type="number" value={createYear}
                  onChange={(e) => setCreateYear(parseInt(e.target.value))} required
                />
              </Grid>
            </Grid>
            <Button
              variant="contained" startIcon={<Add />} sx={{ mt: 2 }}
              onClick={() => createMutation.mutate({ month: createMonth, year: createYear })}
              disabled={createMutation.isPending}
            >
              Create Payroll Run
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

  if (isLoading) return <LoadingScreen />;
  if (!run) return <Typography>Payroll run not found</Typography>;

  const canSubmit = run.status === 'DRAFT' && (user?.role === 'ADMIN' || user?.role === 'HR');
  const canApprove = run.status === 'SUBMITTED' && (user?.role === 'ADMIN' || user?.role === 'MANAGER');
  const canReject = run.status === 'SUBMITTED' && (user?.role === 'ADMIN' || user?.role === 'MANAGER');
  const canReopen = (run.status === 'REJECTED' || run.status === 'APPROVED') && (user?.role === 'ADMIN' || user?.role === 'HR');
  const canManage = run.status === 'DRAFT' && (user?.role === 'ADMIN' || user?.role === 'HR');

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => navigate('/payroll-runs')} sx={{ mb: 2 }}>
        Back to Payroll Runs
      </Button>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box>
              <Typography variant="h5">
                {months[run.month - 1]} {run.year} Payroll
              </Typography>
              <Chip label={run.status} color={statusColors[run.status] || 'default'} sx={{ mt: 1 }} />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Created by {run.createdBy?.email} on {dayjs(run.createdAt).format('DD MMM YYYY HH:mm')}
              </Typography>
              {run.approvedBy && (
                <Typography variant="body2" color="text.secondary">
                  Approved by {run.approvedBy.email} on {dayjs(run.approvedAt).format('DD MMM YYYY HH:mm')}
                </Typography>
              )}
              {run.rejectionReason && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  Rejection reason: {run.rejectionReason}
                </Alert>
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {canManage && (
                <Button variant="contained" startIcon={<PersonAdd />}
                  onClick={() => { setSelectedEmployeeIds([]); setAddEmployeesDialog(true); }}>
                  Add Employees
                </Button>
              )}
              {canManage && run.payrollEntries?.length > 0 && (
                <Button variant="outlined" color="warning"
                  onClick={() => recalculateMutation.mutate()} disabled={recalculateMutation.isPending}>
                  Recalculate Loan Deductions
                </Button>
              )}
              {canSubmit && (
                <Button variant="contained" color="primary" startIcon={<Send />}
                  onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
                  Submit for Approval
                </Button>
              )}
              {canApprove && (
                <Button variant="contained" color="success" startIcon={<CheckCircle />}
                  onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
                  Approve
                </Button>
              )}
              {canReject && (
                <Button variant="contained" color="error" startIcon={<Cancel />}
                  onClick={() => setRejectDialog(true)}>
                  Reject
                </Button>
              )}
              {canReopen && (
                <Button variant="outlined" startIcon={<Refresh />}
                  onClick={() => reopenMutation.mutate()} disabled={reopenMutation.isPending}>
                  Reopen
                </Button>
              )}
              {run.status === 'APPROVED' && (
                <>
                  <Button variant="outlined" startIcon={<PictureAsPdf />}
                    onClick={() => generatePayslipsMutation.mutate()} disabled={generatePayslipsMutation.isPending}>
                    Generate Payslips
                  </Button>
                  <Button variant="outlined" startIcon={<Download />} onClick={handleExport}>
                    Export Excel
                  </Button>
                </>
              )}
              {(run.status === 'DRAFT' || run.status === 'SUBMITTED') && (
                <Button variant="outlined" startIcon={<Download />} onClick={handleExport}>
                  Export Excel
                </Button>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Payroll Entries</Typography>
            <Typography variant="body2" color="text.secondary">
              {run.payrollEntries?.length || 0} employees
            </Typography>
          </Box>
          {(!run.payrollEntries || run.payrollEntries.length === 0) ? (
            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              No entries yet. Click "Add Employees" to add employees to this payroll run, or import from Excel.
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>Employee</TableCell>
                    <TableCell>NRC</TableCell>
                    <TableCell>Site</TableCell>
                    <TableCell align="right">Rate/Hr</TableCell>
                    <TableCell align="right">Present Days</TableCell>
                    <TableCell align="right">Present Amount</TableCell>
                    <TableCell align="right">OT Hrs</TableCell>
                    <TableCell align="right">OT Amount</TableCell>
                    <TableCell align="right">Holiday Hrs</TableCell>
                    <TableCell align="right">Holiday Amount</TableCell>
                    <TableCell align="right">Gross</TableCell>
                    <TableCell align="right">NHIMA</TableCell>
                    <TableCell align="right">NAPSA</TableCell>
                    <TableCell align="right">Loan Bal</TableCell>
                    <TableCell align="right">Loan Ded</TableCell>
                    <TableCell align="right">Other Ded</TableCell>
                    <TableCell align="right">Net Pay</TableCell>
                    {canManage && <TableCell align="center">Actions</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {run.payrollEntries?.map((entry, idx) => {
                    const tv = timeValues[entry.id] || {};
                    const isSaving = savingEntries[entry.id];
                    return (
                      <TableRow key={entry.id} hover>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell>{entry.employee?.firstName} {entry.employee?.lastName}</TableCell>
                        <TableCell>{entry.employee?.nrc}</TableCell>
                        <TableCell>{entry.site || (entry.employee?.site) || '-'}</TableCell>
                        <TableCell align="right">ZMW {entry.hourlyRate?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</TableCell>
                        <TableCell align="right">
                          {canManage ? (
                            <TextField
                              size="small" type="number"
                              value={tv.presentDays ?? entry.presentDays ?? 0}
                              onChange={(e) => handleTimeChange(entry.id, 'presentDays', e.target.value)}
                              onBlur={() => handleTimeBlur(entry.id)}
                              inputProps={{ min: 0, step: 0.5, style: { textAlign: 'right', width: 55 } }}
                              variant="standard"
                              disabled={isSaving}
                            />
                          ) : (
                            <Typography variant="body2">{entry.presentDays || 0}</Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">ZMW {entry.regularAmount?.toLocaleString()}</TableCell>
                        <TableCell align="right">
                          {canManage ? (
                            <TextField
                              size="small" type="number"
                              value={tv.overtimeHours ?? entry.overtimeHours ?? 0}
                              onChange={(e) => handleTimeChange(entry.id, 'overtimeHours', e.target.value)}
                              onBlur={() => handleTimeBlur(entry.id)}
                              inputProps={{ min: 0, step: 0.5, style: { textAlign: 'right', width: 55 } }}
                              variant="standard"
                              disabled={isSaving}
                            />
                          ) : (
                            <Typography variant="body2">{entry.overtimeHours || 0}</Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">ZMW {entry.overtimeAmount?.toLocaleString()}</TableCell>
                        <TableCell align="right">
                          {canManage ? (
                            <TextField
                              size="small" type="number"
                              value={tv.holidayHours ?? entry.holidayHours ?? 0}
                              onChange={(e) => handleTimeChange(entry.id, 'holidayHours', e.target.value)}
                              onBlur={() => handleTimeBlur(entry.id)}
                              inputProps={{ min: 0, step: 0.5, style: { textAlign: 'right', width: 55 } }}
                              variant="standard"
                              disabled={isSaving}
                            />
                          ) : (
                            <Typography variant="body2">{entry.holidayHours || 0}</Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">ZMW {entry.holidayAmount?.toLocaleString()}</TableCell>
                        <TableCell align="right" fontWeight={600}>ZMW {entry.grossSalary?.toLocaleString()}</TableCell>
                        <TableCell align="right">ZMW {entry.nhima?.toLocaleString()}</TableCell>
                        <TableCell align="right">ZMW {entry.napsa?.toLocaleString()}</TableCell>
                        <TableCell align="right">ZMW {entry.loanBalance?.toLocaleString() || 0}</TableCell>
                        <TableCell align="right">ZMW {entry.loanDeduction?.toLocaleString() || 0}</TableCell>
                        <TableCell align="right">ZMW {entry.otherDeductions?.toLocaleString() || 0}</TableCell>
                        <TableCell align="right" fontWeight={700}>ZMW {entry.netSalary?.toLocaleString()}</TableCell>
                        {canManage && (
                          <TableCell align="center">
                            <Button size="small" color="error" startIcon={<Delete />}
                              onClick={() => setDeleteConfirm(entry.id)}>
                              Remove
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Add Employees Dialog */}
      <Dialog open={addEmployeesDialog} onClose={() => setAddEmployeesDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Employees to Payroll</DialogTitle>
        <DialogContent>
          {!availableEmployees || availableEmployees.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
              All active employees have already been added to this payroll run.
            </Typography>
          ) : (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Checkbox
                  checked={availableEmployees.length > 0 && selectedEmployeeIds.length === availableEmployees.length}
                  indeterminate={selectedEmployeeIds.length > 0 && selectedEmployeeIds.length < availableEmployees.length}
                  onChange={handleSelectAll}
                />
                <Typography variant="body2" color="text.secondary">
                  Select All ({availableEmployees.length} available)
                </Typography>
              </Box>
              <Divider />
              <List dense sx={{ maxHeight: 400, overflow: 'auto' }}>
                {availableEmployees.map((emp) => (
                  <ListItem
                    key={emp.id}
                    button
                    onClick={() => handleToggleEmployee(emp.id)}
                  >
                    <ListItemIcon>
                      <Checkbox
                        checked={selectedEmployeeIds.includes(emp.id)}
                        edge="start"
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={`${emp.firstName} ${emp.lastName}`}
                      secondary={`${emp.employeeNumber} - ${emp.departmentName || 'No Dept'} - ZMW ${emp.basicSalary?.toLocaleString()}`}
                    />
                  </ListItem>
                ))}
              </List>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddEmployeesDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={selectedEmployeeIds.length === 0 || addEmployeesMutation.isPending}
            onClick={() => addEmployeesMutation.mutate(selectedEmployeeIds)}
          >
            Add {selectedEmployeeIds.length} Employee{selectedEmployeeIds.length !== 1 ? 's' : ''}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Remove Entry Confirmation */}
      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} maxWidth="xs">
        <DialogTitle>Remove Employee</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to remove this employee from the payroll run?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button variant="contained" color="error"
            onClick={() => removeEntryMutation.mutate(deleteConfirm)}
            disabled={removeEntryMutation.isPending}>
            Remove
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialog} onClose={() => setRejectDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Reject Payroll Run</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus fullWidth label="Rejection Reason *" multiline rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            sx={{ mt: 1 }} required
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialog(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => rejectMutation.mutate(rejectReason)}
            disabled={!rejectReason.trim()}>
            Reject
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
        message={snackbar.message}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}
