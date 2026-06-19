import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Button, TextField, Card, CardContent, Grid,
  Chip, Divider, Alert, Dialog, DialogTitle, DialogContent, DialogActions,
  Checkbox, List, ListItem, ListItemIcon, ListItemText, Snackbar,
  LinearProgress, Select, MenuItem, FormControl, InputLabel, IconButton,
  Tooltip, Collapse,
} from '@mui/material';
import {
  ArrowBack, Send, CheckCircle, Cancel, Refresh, Add,
  Delete, Download, PersonAdd, Email, Warning, RemoveCircle, PictureAsPdf,
  ExpandMore,
} from '@mui/icons-material';
import { payrollRunService } from '../services/payrollRunService';
import { payslipService } from '../services/payslipService';
import { employeeService } from '../services/employeeService';
import LoadingScreen from '../components/LoadingScreen';
import { useAuth } from '../contexts/AuthContext';
import { settingsService } from '../services/settingsService';
import dayjs from 'dayjs';

const statusColors = {
  DRAFT: 'default', SUBMITTED: 'warning', APPROVED: 'success', REJECTED: 'error',
};

const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function Amount({ value, prefix = 'ZMW' }) {
  return (
    <Typography
      variant="body2"
      sx={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right', whiteSpace: 'nowrap' }}
    >
      {prefix} {value?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '0.00'}
    </Typography>
  );
}

function SectionTitle({ children }) {
  return (
    <Typography
      variant="caption"
      sx={{
        textTransform: 'uppercase',
        letterSpacing: 1,
        color: 'text.secondary',
        fontWeight: 600,
        mb: 1.5,
        display: 'block',
      }}
    >
      {children}
    </Typography>
  );
}

function DetailRow({ label, children, color }) {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        py: 0.5,
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Box sx={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right' }} color={color}>
        {children}
      </Box>
    </Box>
  );
}

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
  const [validationErrors, setValidationErrors] = useState([]);
  const [validationDialog, setValidationDialog] = useState(false);
  const [emailDialog, setEmailDialog] = useState(false);
  const [emailProgress, setEmailProgress] = useState(null);
  const [emailResult, setEmailResult] = useState(null);
  const [deductionDialog, setDeductionDialog] = useState({ open: false, entryId: null });
  const [deductionTypeId, setDeductionTypeId] = useState('');
  const [deductionAmount, setDeductionAmount] = useState('');
  const [confirmEmailDialog, setConfirmEmailDialog] = useState(false);
  const [expandedCards, setExpandedCards] = useState(new Set());

  const toggleCard = useCallback((entryId) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  }, []);

  const { data: run, isLoading } = useQuery({
    queryKey: ['payroll-run', id],
    queryFn: async () => { const res = await payrollRunService.getById(id); return res.data; },
    enabled: !isNew,
  });

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

  const { data: availableEmployees } = useQuery({
    queryKey: ['available-employees', id],
    queryFn: async () => { const res = await employeeService.getAvailableForRun(id); return res.data; },
    enabled: !!id && addEmployeesDialog,
  });

  const { data: deductionTypes } = useQuery({
    queryKey: ['deduction-types'],
    queryFn: async () => {
      const res = await settingsService.getDeductionTypes();
      return res.data;
    },
    enabled: deductionDialog.open,
  });

  const { data: settings } = useQuery({
    queryKey: ['payroll-settings'],
    queryFn: async () => { const res = await settingsService.getPayrollLatest(); return res.data; },
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-run', id] });
      setSnackbar({ open: true, message: 'Payroll submitted for approval successfully', severity: 'success' });
    },
    onError: (err) => {
      // If validation errors, try to get them
      const errorMsg = err.response?.data?.message || err.message;
      if (errorMsg?.includes('Validation failed')) {
        // Fetch validation errors
        payrollRunService.validate(id).then((res) => {
          setValidationErrors(res.data);
          setValidationDialog(true);
        }).catch(() => {
          setSnackbar({ open: true, message: errorMsg, severity: 'error' });
        });
      } else {
        setSnackbar({ open: true, message: errorMsg, severity: 'error' });
      }
    },
  });

  const approveMutation = useMutation({
    mutationFn: () => payrollRunService.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-run', id] });
      setSnackbar({ open: true, message: 'Payroll approved! Payslips are being generated.', severity: 'success' });
    },
    onError: (err) => {
      setSnackbar({ open: true, message: err.response?.data?.message || err.message, severity: 'error' });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (reason) => payrollRunService.reject(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-run', id] });
      setRejectDialog(false);
      setRejectReason('');
      setSnackbar({ open: true, message: 'Payroll rejected', severity: 'info' });
    },
  });

  const reopenMutation = useMutation({
    mutationFn: () => payrollRunService.reopen(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-run', id] });
      setSnackbar({ open: true, message: 'Payroll reopened', severity: 'info' });
    },
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

  const updateEntryMutation = useMutation({
    mutationFn: ({ entryId, data }) => payrollRunService.updateEntry(id, entryId, data),
    onSuccess: (res) => {
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

  const emailPayslipsMutation = useMutation({
    mutationFn: () => payrollRunService.emailPayslips(id),
    onSuccess: (res) => {
      const data = res.data;
      setEmailResult(data);
      setEmailProgress(false);
      setSnackbar({
        open: true,
        message: `Emailed ${data.succeeded} of ${data.total} payslips. ${data.failed > 0 ? data.failed + ' failed.' : ''}`,
        severity: data.failed > 0 ? 'warning' : 'success',
      });
    },
    onError: (err) => {
      setEmailProgress(false);
      setSnackbar({ open: true, message: 'Failed to email payslips: ' + (err.response?.data?.message || err.message), severity: 'error' });
    },
  });

  const addDeductionMutation = useMutation({
    mutationFn: ({ entryId, deductionTypeId, amount }) =>
      payrollRunService.addDeduction(id, entryId, deductionTypeId, amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-run', id] });
      setDeductionDialog({ open: false, entryId: null });
      setDeductionTypeId('');
      setDeductionAmount('');
    },
    onError: (err) => {
      setSnackbar({ open: true, message: 'Failed to add deduction: ' + (err.response?.data?.message || err.message), severity: 'error' });
    },
  });

  const removeDeductionMutation = useMutation({
    mutationFn: ({ entryId, deductionId }) =>
      payrollRunService.removeDeduction(id, entryId, deductionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-run', id] });
    },
    onError: (err) => {
      setSnackbar({ open: true, message: 'Failed to remove deduction: ' + (err.response?.data?.message || err.message), severity: 'error' });
    },
  });

  const generatePayslipsMutation = useMutation({
    mutationFn: () => payslipService.generate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-run', id] });
      setSnackbar({ open: true, message: 'Payslips generated successfully', severity: 'success' });
    },
    onError: (err) => {
      setSnackbar({ open: true, message: 'Failed to generate payslips: ' + (err.response?.data?.message || err.message), severity: 'error' });
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
      setSnackbar({ open: true, message: 'Export failed: ' + (err.response?.data?.message || err.message), severity: 'error' });
    }
  };

  const handleEmailPayslips = () => {
    setConfirmEmailDialog(true);
  };

  const confirmEmail = () => {
    setConfirmEmailDialog(false);
    setEmailProgress(true);
    setEmailResult(null);
    setEmailDialog(true);
    emailPayslipsMutation.mutate();
  };

  const handleSubmit = () => {
    // First validate, then submit
    payrollRunService.validate(id).then((res) => {
      const errors = res.data;
      if (errors && errors.length > 0) {
        setValidationErrors(errors);
        setValidationDialog(true);
      } else {
        submitMutation.mutate();
      }
    }).catch((err) => {
      // If validate endpoint fails, try submit directly
      submitMutation.mutate();
    });
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

  // Role-based permissions
  const isSubmitter = run.createdBy?.id === user?.id;
  const canManage = run.status === 'DRAFT' && (user?.role === 'ADMIN' || user?.role === 'HR');
  const canSubmit = run.status === 'DRAFT' && (user?.role === 'ADMIN' || user?.role === 'HR');
  const canApprove = run.status === 'SUBMITTED' && (user?.role === 'ADMIN' || user?.role === 'MANAGER') && !isSubmitter;
  const canReject = run.status === 'SUBMITTED' && (user?.role === 'ADMIN' || user?.role === 'MANAGER');
  const canReopen = (
    (run.status === 'REJECTED' && (user?.role === 'ADMIN' || user?.role === 'HR')) ||
    (run.status === 'APPROVED' && user?.role === 'ADMIN')
  );
  const canExport = run.status !== 'DRAFT';
  const canEmailPayslips = run.status === 'APPROVED' && (user?.role === 'ADMIN' || user?.role === 'HR');

  const hoursPerDay = settings?.hoursPerDay || 8;
  const overtimeRate = settings?.overtimeRate || 1.5;
  const holidayRate = settings?.holidayRate || 2.0;

  return (
    <Box>
      <style>{`
        input[type=number] { -moz-appearance: textfield; }
        input[type=number]::-webkit-outer-spin-button,
        input[type=number]::-webkit-inner-spin-button {
          -webkit-appearance: none; margin: 0;
        }
      `}</style>

      <Button startIcon={<ArrowBack />} onClick={() => navigate('/payroll-runs')} sx={{ mb: 2 }}>
        Back to Payroll Runs
      </Button>

      {/* Header Card */}
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
                  onClick={handleSubmit} disabled={submitMutation.isPending}>
                  Submit for Approval
                </Button>
              )}
              {canApprove && (
                <Button variant="contained" color="success" startIcon={<CheckCircle />}
                  onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
                  Approve
                </Button>
              )}
              {!canApprove && run.status === 'SUBMITTED' && isSubmitter && (
                <Tooltip title="You cannot approve a payroll run that you submitted">
                  <span>
                    <Button variant="contained" color="success" startIcon={<CheckCircle />} disabled>
                      Approve (blocked)
                    </Button>
                  </span>
                </Tooltip>
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
                  <Button variant="outlined" startIcon={<Download />} onClick={handleExport}>
                    Export Excel
                  </Button>
                  <Button variant="outlined" startIcon={<PictureAsPdf />}
                    onClick={() => generatePayslipsMutation.mutate()}
                    disabled={generatePayslipsMutation.isPending}>
                    Generate Again
                  </Button>
                  {canEmailPayslips && (
                    <Button variant="contained" startIcon={<Email />}
                      onClick={handleEmailPayslips} disabled={emailPayslipsMutation.isPending}>
                      Email All Payslips
                    </Button>
                  )}
                </>
              )}
              {canExport && run.status !== 'APPROVED' && (
                <Button variant="outlined" startIcon={<Download />} onClick={handleExport}>
                  Export Excel
                </Button>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Payroll Entries - Card Layout */}
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
              No entries yet. Click &ldquo;Add Employees&rdquo; to add employees to this payroll run, or import from Excel.
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {run.payrollEntries?.map((entry) => {
                const isExpanded = expandedCards.has(entry.id);
                const tv = timeValues[entry.id] || {};
                const isSaving = savingEntries[entry.id];
                const employeeName = `${entry.employee?.firstName || ''} ${entry.employee?.lastName || ''}`.trim() || 'Unknown';
                const site = entry.site || entry.employee?.site || null;

                // Rate calculations
                const hourlyRate = entry.hourlyRate || 0;
                const otRate = hourlyRate * overtimeRate;
                const holRate = hourlyRate * holidayRate;

                // Earnings
                const presentDays = tv.presentDays ?? entry.presentDays ?? 0;
                const otHours = tv.overtimeHours ?? entry.overtimeHours ?? 0;
                const holHours = tv.holidayHours ?? entry.holidayHours ?? 0;

                return (
                  <Card
                    key={entry.id}
                    variant="outlined"
                    sx={{
                      borderRadius: 2,
                      overflow: 'hidden',
                      borderColor: 'divider',
                      '&:hover': { borderColor: 'primary.light' },
                      transition: 'border-color 0.2s',
                    }}
                  >
                    {/* -------- Card Header (always visible) -------- */}
                    <Box
                      onClick={() => toggleCard(entry.id)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        px: 2.5,
                        py: 2,
                        cursor: 'pointer',
                        bgcolor: 'background.paper',
                        '&:hover': { bgcolor: 'action.hover' },
                        transition: 'background-color 0.15s',
                        userSelect: 'none',
                      }}
                    >
                      {/* Left side */}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="subtitle1" fontWeight={700} noWrap>
                          {employeeName}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25, flexWrap: 'wrap' }}>
                          <Typography variant="body2" color="text.secondary">
                            {entry.employee?.position || '\u2014'}
                          </Typography>
                          {site && (
                            <Chip label={site} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                          )}
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          NRC: {entry.employee?.nrc || '\u2014'}
                        </Typography>
                      </Box>

                      {/* Right side: gross & net */}
                      <Box sx={{ textAlign: 'right', mr: 1.5, flexShrink: 0 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>
                          Gross
                        </Typography>
                        <Typography
                          variant="body1"
                          fontWeight={600}
                          sx={{ fontVariantNumeric: 'tabular-nums', lineHeight: 1.3 }}
                        >
                          ZMW {entry.grossSalary?.toLocaleString() ?? '0'}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="success.main"
                          fontWeight={600}
                          sx={{ fontVariantNumeric: 'tabular-nums', lineHeight: 1.3, mt: 0.25 }}
                        >
                          Net: ZMW {entry.netSalary?.toLocaleString() ?? '0'}
                        </Typography>
                      </Box>

                      {/* Chevron */}
                      <ExpandMore
                        sx={{
                          flexShrink: 0,
                          color: 'text.disabled',
                          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.25s ease',
                          fontSize: 28,
                        }}
                      />
                    </Box>

                    {/* -------- Collapsible Body -------- */}
                    <Collapse in={isExpanded} timeout={250}>
                      <Divider />
                      <Box sx={{ px: 2.5, py: 2.5 }}>
                        {/* Rates & Earnings - side by side */}
                        <Box sx={{ display: 'flex', gap: 0 }}>
                          {/* Rates column */}
                          <Box sx={{ flex: 1, pr: 2.5 }}>
                            <SectionTitle>Rates</SectionTitle>
                            <DetailRow label="Rate/hr">
                              <Amount value={hourlyRate} />
                            </DetailRow>
                            <DetailRow label="OT rate/hr">
                              <Amount value={otRate} />
                            </DetailRow>
                            <DetailRow label="Hol rate/hr">
                              <Amount value={holRate} />
                            </DetailRow>
                            <DetailRow label="Normal hrs">
                              <Typography
                                variant="body2"
                                sx={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}
                              >
                                {hoursPerDay} hrs/day
                              </Typography>
                            </DetailRow>
                          </Box>

                          {/* Vertical divider */}
                          <Divider orientation="vertical" flexItem sx={{ mx: 0 }} />

                          {/* Earnings column */}
                          <Box sx={{ flex: 1, pl: 2.5 }}>
                            <SectionTitle>Earnings</SectionTitle>
                            <DetailRow label="Present days">
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'flex-end' }}>
                                {canManage ? (
                                  <TextField
                                    size="small"
                                    type="number"
                                    value={tv.presentDays ?? entry.presentDays ?? 0}
                                    onChange={(e) => handleTimeChange(entry.id, 'presentDays', e.target.value)}
                                    onBlur={() => handleTimeBlur(entry.id)}
                                    inputProps={{
                                      min: 0, step: 0.5,
                                      style: { textAlign: 'right', width: 48, padding: '4px 6px' },
                                    }}
                                    variant="standard"
                                    disabled={isSaving}
                                    sx={{ '& .MuiInputBase-root': { fontSize: '0.8125rem' } }}
                                  />
                                ) : (
                                  <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                                    {entry.presentDays || 0}
                                  </Typography>
                                )}
                                <Amount value={entry.regularAmount} />
                              </Box>
                            </DetailRow>
                            <DetailRow label="OT hrs">
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'flex-end' }}>
                                {canManage ? (
                                  <TextField
                                    size="small"
                                    type="number"
                                    value={tv.overtimeHours ?? entry.overtimeHours ?? 0}
                                    onChange={(e) => handleTimeChange(entry.id, 'overtimeHours', e.target.value)}
                                    onBlur={() => handleTimeBlur(entry.id)}
                                    inputProps={{
                                      min: 0, step: 0.5,
                                      style: { textAlign: 'right', width: 48, padding: '4px 6px' },
                                    }}
                                    variant="standard"
                                    disabled={isSaving}
                                    sx={{ '& .MuiInputBase-root': { fontSize: '0.8125rem' } }}
                                  />
                                ) : (
                                  <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                                    {entry.overtimeHours || 0}
                                  </Typography>
                                )}
                                <Amount value={entry.overtimeAmount} />
                              </Box>
                            </DetailRow>
                            <DetailRow label="Holiday hrs">
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'flex-end' }}>
                                {canManage ? (
                                  <TextField
                                    size="small"
                                    type="number"
                                    value={tv.holidayHours ?? entry.holidayHours ?? 0}
                                    onChange={(e) => handleTimeChange(entry.id, 'holidayHours', e.target.value)}
                                    onBlur={() => handleTimeBlur(entry.id)}
                                    inputProps={{
                                      min: 0, step: 0.5,
                                      style: { textAlign: 'right', width: 48, padding: '4px 6px' },
                                    }}
                                    variant="standard"
                                    disabled={isSaving}
                                    sx={{ '& .MuiInputBase-root': { fontSize: '0.8125rem' } }}
                                  />
                                ) : (
                                  <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                                    {entry.holidayHours || 0}
                                  </Typography>
                                )}
                                <Amount value={entry.holidayAmount} />
                              </Box>
                            </DetailRow>
                            <DetailRow label="Gross">
                              <Typography
                                variant="body2"
                                fontWeight={600}
                                sx={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}
                              >
                                ZMW {entry.grossSalary?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '0.00'}
                              </Typography>
                            </DetailRow>
                          </Box>
                        </Box>

                        <Divider sx={{ my: 2.5 }} />

                        {/* Deductions - 2-column grid */}
                        <SectionTitle>Deductions</SectionTitle>
                        <Grid container spacing={1.5}>
                          <Grid item xs={6}>
                            <DetailRow label="NHIMA">
                              <Amount value={entry.nhima} />
                            </DetailRow>
                          </Grid>
                          <Grid item xs={6}>
                            <DetailRow label="NAPSA">
                              <Amount value={entry.napsa} />
                            </DetailRow>
                          </Grid>
                          <Grid item xs={6}>
                            <DetailRow label="Loan balance">
                              <Amount value={entry.loanBalance} />
                            </DetailRow>
                          </Grid>
                          <Grid item xs={6}>
                            <DetailRow label="Loan deduction">
                              <Amount value={entry.loanDeduction} />
                            </DetailRow>
                          </Grid>
                          <Grid item xs={12}>
                            <DetailRow label="Other deductions">
                              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.25 }}>
                                {entry.employeeDeductions?.length > 0 && (
                                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, width: '100%', alignItems: 'flex-end' }}>
                                    {entry.employeeDeductions.map((ded) => (
                                      <Box key={ded.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                                          {ded.deductionType?.name || 'Deduction'}: ZMW {ded.amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </Typography>
                                        {canManage && (
                                          <IconButton
                                            size="small"
                                            color="error"
                                            onClick={() => removeDeductionMutation.mutate({ entryId: entry.id, deductionId: ded.id })}
                                            disabled={removeDeductionMutation.isPending}
                                            sx={{ width: 18, height: 18 }}
                                          >
                                            <RemoveCircle fontSize="inherit" />
                                          </IconButton>
                                        )}
                                      </Box>
                                    ))}
                                  </Box>
                                )}
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <Typography
                                    variant="body2"
                                    fontWeight={entry.employeeDeductions?.length > 0 ? 600 : 400}
                                    sx={{ fontVariantNumeric: 'tabular-nums' }}
                                  >
                                    {entry.employeeDeductions?.length > 0 ? 'Total: ' : ''}
                                    ZMW {entry.otherDeductions?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                                  </Typography>
                                  {canManage && (
                                    <IconButton
                                      size="small"
                                      color="primary"
                                      onClick={() => {
                                        setDeductionDialog({ open: true, entryId: entry.id });
                                        setDeductionTypeId('');
                                        setDeductionAmount('');
                                      }}
                                      sx={{ width: 20, height: 20 }}
                                    >
                                      <Add fontSize="small" />
                                    </IconButton>
                                  )}
                                </Box>
                              </Box>
                            </DetailRow>
                          </Grid>
                        </Grid>

                        <Divider sx={{ my: 2.5 }} />

                        {/* Net Pay */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="subtitle1" fontWeight={700}>
                            Net Pay
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            {canManage && (
                              <Button
                                size="small"
                                color="error"
                                startIcon={<Delete />}
                                onClick={() => setDeleteConfirm(entry.id)}
                                sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                              >
                                Remove
                              </Button>
                            )}
                            <Typography
                              variant="h6"
                              color="success.main"
                              fontWeight={700}
                              sx={{ fontVariantNumeric: 'tabular-nums' }}
                            >
                              ZMW {entry.netSalary?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '0.00'}
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                    </Collapse>
                  </Card>
                );
              })}
            </Box>
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
                      secondary={`${emp.employeeNumber} - ${emp.departmentName || 'No Dept'} - Rate: ZMW ${emp.rate?.toLocaleString(undefined, {minimumFractionDigits: 2}) || '-'}`}
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

      {/* Validation Errors Dialog */}
      <Dialog open={validationDialog} onClose={() => setValidationDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Warning color="error" />
          Validation Errors
        </DialogTitle>
        <DialogContent>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Fix the following errors before submitting:
          </Typography>
          <List dense>
            {validationErrors.map((err, idx) => (
              <ListItem key={idx} sx={{ bgcolor: '#fff5f5', mb: 0.5, borderRadius: 1 }}>
                <ListItemText
                  primary={
                    <Typography variant="body2" color="error">
                      {err.employeeName ? `${err.employeeName}: ` : ''}{err.message}
                    </Typography>
                  }
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setValidationDialog(false)}>
            Fix Issues
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

      {/* Add Deduction Dialog */}
      <Dialog open={deductionDialog.open} onClose={() => setDeductionDialog({ open: false, entryId: null })} maxWidth="xs" fullWidth>
        <DialogTitle>Add Deduction</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Deduction Type</InputLabel>
              <Select
                value={deductionTypeId}
                label="Deduction Type"
                onChange={(e) => setDeductionTypeId(e.target.value)}
              >
                {deductionTypes?.map((dt) => (
                  <MenuItem key={dt.id} value={dt.id}>{dt.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth label="Amount (ZMW)" type="number" size="small"
              value={deductionAmount}
              onChange={(e) => setDeductionAmount(e.target.value)}
              inputProps={{ min: 0, step: 0.01 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeductionDialog({ open: false, entryId: null })}>Cancel</Button>
          <Button variant="contained"
            disabled={!deductionTypeId || !deductionAmount || parseFloat(deductionAmount) <= 0 || addDeductionMutation.isPending}
            onClick={() => addDeductionMutation.mutate({
              entryId: deductionDialog.entryId,
              deductionTypeId,
              amount: parseFloat(deductionAmount),
            })}
          >
            Add Deduction
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm Email Dialog */}
      <Dialog open={confirmEmailDialog} onClose={() => setConfirmEmailDialog(false)} maxWidth="xs">
        <DialogTitle>Email All Payslips</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to email payslips to all {run.payrollEntries?.length || 0} employees?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmEmailDialog(false)}>Cancel</Button>
          <Button variant="contained" color="primary" startIcon={<Email />}
            onClick={confirmEmail}>
            Send All
          </Button>
        </DialogActions>
      </Dialog>

      {/* Email Progress Dialog */}
      <Dialog open={emailDialog && emailProgress} maxWidth="xs">
        <DialogTitle>Sending Payslips...</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 2 }}>
            <LinearProgress sx={{ width: '100%', mb: 2 }} />
            <Typography variant="body2" color="text.secondary">
              Please wait while payslips are being emailed...
            </Typography>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Email Result Dialog */}
      <Dialog open={emailResult !== null} onClose={() => setEmailResult(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Email Results</DialogTitle>
        <DialogContent>
          <Box sx={{ py: 1 }}>
            <Typography variant="body1">
              ✅ Sent: <strong>{emailResult?.succeeded}</strong> of <strong>{emailResult?.total}</strong>
            </Typography>
            {emailResult?.failed > 0 && (
              <>
                <Typography variant="body1" color="error">
                  ❌ Failed: <strong>{emailResult?.failed}</strong>
                </Typography>
                {emailResult?.errors?.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" fontWeight={600}>Errors:</Typography>
                    <List dense>
                      {emailResult.errors.map((err, idx) => (
                        <ListItem key={idx}>
                          <ListItemText
                            primary={err.employee || `Payslip ${err.payslipId}`}
                            secondary={err.error}
                            primaryTypographyProps={{ variant: 'body2' }}
                            secondaryTypographyProps={{ variant: 'caption', color: 'error' }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                )}
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setEmailResult(null)}>Done</Button>
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
