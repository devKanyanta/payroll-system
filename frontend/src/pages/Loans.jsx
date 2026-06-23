import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Button, TextField, Select, MenuItem, FormControl,
  InputLabel, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Card, CardContent, Grid, Chip, IconButton, Tooltip, Stack,
  Dialog, DialogTitle, DialogContent, DialogActions, alpha,
} from '@mui/material';
import {
  Add, Cancel, Gavel, TrendingDown, CalendarMonth, Search,
} from '@mui/icons-material';
import { loanService } from '../services/loanService';
import { employeeService } from '../services/employeeService';
import LoadingScreen from '../components/LoadingScreen';
import ConfirmDialog from '../components/ConfirmDialog';
import dayjs from 'dayjs';

const STATUS_COLORS = {
  ACTIVE: { color: '#2563eb', bg: '#dbeafe' },
  COMPLETED: { color: '#059669', bg: '#d1fae5' },
  CANCELLED: { color: '#dc2626', bg: '#fee2e2' },
};

function StatusChip({ status }) {
  const colors = STATUS_COLORS[status] || { color: '#6b7280', bg: '#f3f4f6' };
  const label = status || 'UNKNOWN';
  return (
    <Chip
      label={label}
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

const emptyLoan = {
  employeeId: '', loanAmount: '', interestRate: '0',
  monthlyDeduction: '', durationMonths: '1', startDate: '', endDate: '',
};

export default function Loans() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyLoan);
  const [cancelId, setCancelId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const queryClient = useQueryClient();

  const { data: employees } = useQuery({
    queryKey: ['employees-mini'],
    queryFn: async () => {
      const res = await employeeService.getAll({ size: 200, sort: 'firstName,asc' });
      return res.data.content;
    },
  });

  const { data: loans, isLoading } = useQuery({
    queryKey: ['loans'],
    queryFn: async () => {
      const res = await loanService.getAll();
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data) => loanService.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['loans'] }); closeDialog(); },
  });

  const cancelMutation = useMutation({
    mutationFn: (id) => loanService.cancel(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['loans'] }); setCancelId(null); },
  });

  // ── Derived stats ──
  const stats = useMemo(() => {
    if (!loans || loans.length === 0) {
      return { activeCount: 0, totalOutstanding: 0, totalMonthlyDeduction: 0, completedCount: 0, totalLoans: 0 };
    }
    return {
      totalLoans: loans.length,
      activeCount: loans.filter((l) => l.status === 'ACTIVE').length,
      completedCount: loans.filter((l) => l.status === 'COMPLETED').length,
      totalOutstanding: loans
        .filter((l) => l.status === 'ACTIVE')
        .reduce((sum, l) => sum + (l.balance || 0), 0),
      totalMonthlyDeduction: loans
        .filter((l) => l.status === 'ACTIVE')
        .reduce((sum, l) => sum + (l.monthlyDeduction || 0), 0),
    };
  }, [loans]);

  // ── Filter & Search ──
  const filteredLoans = useMemo(() => {
    if (!loans) return [];
    return loans.filter((loan) => {
      if (statusFilter && loan.status !== statusFilter) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const name = (loan.employeeName || '').toLowerCase();
        if (!name.includes(term)) return false;
      }
      return true;
    });
  }, [loans, statusFilter, searchTerm]);

  const openCreate = () => {
    setEditId(null);
    setForm(emptyLoan);
    setDialogOpen(true);
  };

  const closeDialog = () => { setDialogOpen(false); setEditId(null); setForm(emptyLoan); };

  const handleSubmit = () => {
    const data = {
      employeeId: form.employeeId,
      loanAmount: parseFloat(form.loanAmount),
      interestRate: parseFloat(form.interestRate) || 0,
      monthlyDeduction: parseFloat(form.monthlyDeduction) || 0,
      durationMonths: parseInt(form.durationMonths) || 1,
      startDate: form.startDate,
      endDate: form.endDate,
    };
    if (editId) {
      loanService.update(editId, data).then(() => {
        queryClient.invalidateQueries({ queryKey: ['loans'] });
        closeDialog();
      });
    } else {
      createMutation.mutate(data);
    }
  };

  const formatCurrency = (value) => {
    if (value == null) return '—';
    return `ZMW ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (isLoading) return <LoadingScreen />;

  return (
    <Box>
      {/* ── Header ── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Loans</Typography>
          <Typography variant="body2" color="text.secondary">
            Track all employee loans — view balances, monitor repayments, and issue new loans
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={openCreate}>
          Add Loan
        </Button>
      </Box>

      {/* ── Summary Cards ── */}
      {loans && loans.length > 0 && (
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
                    <Gavel sx={{ color: '#2563eb', fontSize: 20 }} />
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={500}>
                      Active Loans
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                      {stats.activeCount}
                    </Typography>
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
                    <TrendingDown sx={{ color: '#059669', fontSize: 20 }} />
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={500}>
                      Outstanding Balance
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                      {formatCurrency(stats.totalOutstanding)}
                    </Typography>
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
                    <CalendarMonth sx={{ color: 'text.secondary', fontSize: 20 }} />
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={500}>
                      Monthly Deduction
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                      {formatCurrency(stats.totalMonthlyDeduction)}
                    </Typography>
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
                    bgcolor: alpha('#059669', 0.08),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <TrendingDown sx={{ color: '#059669', fontSize: 20 }} />
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={500}>
                      Completed
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                      {stats.completedCount} / {stats.totalLoans}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* ── Filters ── */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ pb: '12px !important' }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                placeholder="Search by employee name..."
                size="small"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
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
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  label="Status"
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="ACTIVE">Active</MenuItem>
                  <MenuItem value="COMPLETED">Completed</MenuItem>
                  <MenuItem value="CANCELLED">Cancelled</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={3} md={6}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'right' }}>
                {filteredLoans.length} loan{filteredLoans.length !== 1 ? 's' : ''}
                {statusFilter && ` · ${statusFilter.toLowerCase()}`}
                {searchTerm && ` · matching "${searchTerm}"`}
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
                <TableCell>Employee</TableCell>
                <TableCell>Loan Amount</TableCell>
                <TableCell>Balance</TableCell>
                <TableCell>Monthly Deduction</TableCell>
                <TableCell>Interest</TableCell>
                <TableCell>Duration</TableCell>
                <TableCell>Period</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredLoans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                    <Box sx={{ textAlign: 'center', py: 2 }}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {loans?.length === 0
                          ? 'No loans have been created yet'
                          : 'No loans match your search filters'}
                      </Typography>
                      {loans?.length === 0 && (
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<Add />}
                          onClick={openCreate}
                          sx={{ mt: 1 }}
                        >
                          Create your first loan
                        </Button>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                filteredLoans.map((loan) => (
                  <TableRow
                    key={loan.id}
                    hover
                    sx={{
                      '&:last-child td': { border: 0 },
                      ...(loan.status === 'ACTIVE' && {
                        '&:hover': { bgcolor: alpha('#2563eb', 0.04) },
                      }),
                    }}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {loan.employeeName || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {formatCurrency(loan.loanAmount)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        fontWeight={600}
                        sx={{
                          color: loan.status === 'ACTIVE' && loan.balance > 0 ? '#2563eb' : 'text.primary',
                        }}
                      >
                        {formatCurrency(loan.balance)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatCurrency(loan.monthlyDeduction)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {loan.interestRate != null ? `${loan.interestRate}%` : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {loan.durationMonths || 1} {loan.durationMonths === 1 ? 'month' : 'months'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                        {dayjs(loan.startDate).format('MMM YYYY')}
                        <Typography variant="caption" color="text.disabled" component="span" sx={{ mx: 0.5 }}>
                          →
                        </Typography>
                        {dayjs(loan.endDate).format('MMM YYYY')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <StatusChip status={loan.status} />
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        {loan.status === 'ACTIVE' && (
                          <Tooltip title="Cancel this loan">
                            <IconButton
                              size="small"
                              sx={{ color: '#dc2626' }}
                              onClick={() => setCancelId(loan.id)}
                            >
                              <Cancel fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {loan.status !== 'ACTIVE' && (
                          <Typography variant="caption" color="text.disabled" sx={{ px: 1 }}>
                            —
                          </Typography>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* ── Create/Edit Dialog ── */}
      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editId ? 'Edit Loan' : 'Add Loan'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Employee *</InputLabel>
                <Select
                  value={form.employeeId}
                  label="Employee *"
                  onChange={(e) => setForm((p) => ({ ...p, employeeId: e.target.value }))}
                >
                  {employees?.map((emp) => (
                    <MenuItem key={emp.id} value={emp.id}>
                      {emp.employeeNumber} — {emp.firstName} {emp.lastName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth label="Loan Amount *" type="number"
                value={form.loanAmount}
                onChange={(e) => setForm((p) => ({ ...p, loanAmount: e.target.value }))}
                required
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth label="Interest Rate (%)" type="number"
                value={form.interestRate}
                onChange={(e) => setForm((p) => ({ ...p, interestRate: e.target.value }))}
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth label="Monthly Deduction" type="number"
                value={form.monthlyDeduction}
                onChange={(e) => setForm((p) => ({ ...p, monthlyDeduction: e.target.value }))}
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth label="Duration (Months)" type="number"
                value={form.durationMonths}
                onChange={(e) => setForm((p) => ({ ...p, durationMonths: e.target.value }))}
                inputProps={{ min: 1 }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth label="Start Date *" type="date"
                value={form.startDate}
                onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth label="End Date *" type="date"
                value={form.endDate}
                onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={createMutation.isPending}
          >
            {editId ? 'Update Loan' : 'Create Loan'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Cancel Confirmation ── */}
      <ConfirmDialog
        open={!!cancelId}
        title="Cancel Loan"
        message="Are you sure you want to cancel this loan? This action cannot be undone."
        onConfirm={() => cancelMutation.mutate(cancelId)}
        onCancel={() => setCancelId(null)}
        color="error"
        confirmLabel="Cancel Loan"
      />
    </Box>
  );
}
