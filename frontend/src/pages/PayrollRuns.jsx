import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Button, Select, MenuItem, FormControl,
  InputLabel, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Chip, Card, CardContent, TablePagination, Grid, IconButton,
  Tooltip, Stack, alpha,
} from '@mui/material';
import {
  Add, Visibility, Delete, AccountBalance, CheckCircle, Send, Cancel,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { payrollRunService } from '../services/payrollRunService';
import { useAuth } from '../contexts/AuthContext';
import LoadingScreen from '../components/LoadingScreen';
import ConfirmDialog from '../components/ConfirmDialog';
import dayjs from 'dayjs';

const STATUS_COLORS = {
  DRAFT: { color: '#6b7280', bg: '#f3f4f6' },
  SUBMITTED: { color: '#d97706', bg: '#fef3c7' },
  APPROVED: { color: '#059669', bg: '#d1fae5' },
  REJECTED: { color: '#dc2626', bg: '#fee2e2' },
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

const months = [
  { value: 1, label: 'January' }, { value: 2, label: 'February' },
  { value: 3, label: 'March' }, { value: 4, label: 'April' },
  { value: 5, label: 'May' }, { value: 6, label: 'June' },
  { value: 7, label: 'July' }, { value: 8, label: 'August' },
  { value: 9, label: 'September' }, { value: 10, label: 'October' },
  { value: 11, label: 'November' }, { value: 12, label: 'December' },
];

export default function PayrollRuns() {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [monthFilter, setMonthFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const isAdmin = user?.role === 'ADMIN';

  const { data: pageData, isLoading } = useQuery({
    queryKey: ['payroll-runs', page, rowsPerPage, monthFilter, yearFilter, statusFilter],
    queryFn: async () => {
      const params = { page, size: rowsPerPage, sort: 'createdAt,desc' };
      if (monthFilter) params.month = parseInt(monthFilter);
      if (yearFilter) params.year = parseInt(yearFilter);
      if (statusFilter) params.status = statusFilter;
      const res = await payrollRunService.getAll(params);
      return res.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => payrollRunService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
      setDeleteId(null);
    },
  });

  // ── Derived stats ──
  const runs = pageData?.content || [];
  const total = pageData?.totalElements || 0;
  const approvedCount = runs.filter((r) => r.status === 'APPROVED').length;
  const submittedCount = runs.filter((r) => r.status === 'SUBMITTED').length;
  const draftCount = runs.filter((r) => r.status === 'DRAFT').length;

  const getMonthName = (m) => months.find((mo) => mo.value === m)?.label || m;

  if (isLoading) return <LoadingScreen />;

  return (
    <Box>
      {/* ── Header ── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Payroll Runs</Typography>
          <Typography variant="body2" color="text.secondary">
            Create, manage, and process payroll cycles for each month
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/payroll-runs/new')}>
          New Payroll Run
        </Button>
      </Box>

      {/* ── Summary Cards ── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <Card sx={{ bgcolor: alpha('#6b7280', 0.08), border: '1px solid', borderColor: alpha('#6b7280', 0.2) }}>
            <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Box sx={{ width: 40, height: 40, borderRadius: 1.5, bgcolor: alpha('#6b7280', 0.12), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AccountBalance sx={{ color: '#6b7280', fontSize: 20 }} />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={500}>Total Runs</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>{total}</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ bgcolor: alpha('#059669', 0.08), border: '1px solid', borderColor: alpha('#059669', 0.2) }}>
            <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Box sx={{ width: 40, height: 40, borderRadius: 1.5, bgcolor: alpha('#059669', 0.12), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle sx={{ color: '#059669', fontSize: 20 }} />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={500}>Approved</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>{approvedCount}</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ bgcolor: alpha('#d97706', 0.08), border: '1px solid', borderColor: alpha('#d97706', 0.2) }}>
            <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Box sx={{ width: 40, height: 40, borderRadius: 1.5, bgcolor: alpha('#d97706', 0.12), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Send sx={{ color: '#d97706', fontSize: 20 }} />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={500}>Submitted</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>{submittedCount}</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card>
            <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Box sx={{ width: 40, height: 40, borderRadius: 1.5, bgcolor: alpha('#6b7280', 0.08), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AccountBalance sx={{ color: 'text.secondary', fontSize: 20 }} />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={500}>Drafts</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>{draftCount}</Typography>
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
            <Grid item xs={6} sm={3} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Month</InputLabel>
                <Select value={monthFilter} label="Month" onChange={(e) => { setMonthFilter(e.target.value); setPage(0); }}>
                  <MenuItem value="">All</MenuItem>
                  {months.map((m) => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Year</InputLabel>
                <Select value={yearFilter} label="Year" onChange={(e) => { setYearFilter(e.target.value); setPage(0); }}>
                  <MenuItem value="">All</MenuItem>
                  {[2024, 2025, 2026].map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select value={statusFilter} label="Status" onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}>
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="DRAFT">Draft</MenuItem>
                  <MenuItem value="SUBMITTED">Submitted</MenuItem>
                  <MenuItem value="APPROVED">Approved</MenuItem>
                  <MenuItem value="REJECTED">Rejected</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={3} md={6}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'right' }}>
                {total} payroll run{total !== 1 ? 's' : ''}
                {statusFilter && ` · ${statusFilter.toLowerCase()}`}
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
                <TableCell>Period</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Employees</TableCell>
                <TableCell align="right">Total Net Pay</TableCell>
                <TableCell>Created By</TableCell>
                <TableCell>Approved By</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {runs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      No payroll runs found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                runs.map((run) => (
                  <TableRow
                    key={run.id}
                    hover
                    sx={{
                      cursor: 'pointer',
                      '&:last-child td': { border: 0 },
                    }}
                  >
                    <TableCell onClick={() => navigate(`/payroll-runs/${run.id}`)}>
                      <Typography variant="body2" fontWeight={600}>
                        {getMonthName(run.month)} {run.year}
                      </Typography>
                    </TableCell>
                    <TableCell onClick={() => navigate(`/payroll-runs/${run.id}`)}>
                      <StatusChip status={run.status} />
                    </TableCell>
                    <TableCell onClick={() => navigate(`/payroll-runs/${run.id}`)}>
                      <Typography variant="body2">{run.entryCount ?? '-'}</Typography>
                    </TableCell>
                    <TableCell align="right" onClick={() => navigate(`/payroll-runs/${run.id}`)}>
                      <Typography variant="body2" fontWeight={600} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        ZMW {(run.totalNetPay ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Typography>
                    </TableCell>
                    <TableCell onClick={() => navigate(`/payroll-runs/${run.id}`)}>
                      <Typography variant="body2">{run.createdBy?.email || '-'}</Typography>
                    </TableCell>
                    <TableCell onClick={() => navigate(`/payroll-runs/${run.id}`)}>
                      <Typography variant="body2">{run.approvedBy?.email || '-'}</Typography>
                    </TableCell>
                    <TableCell onClick={() => navigate(`/payroll-runs/${run.id}`)}>
                      <Typography variant="body2">{dayjs(run.createdAt).format('DD MMM YYYY')}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Tooltip title="View payroll details">
                          <IconButton size="small" onClick={() => navigate(`/payroll-runs/${run.id}`)}>
                            <Visibility fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {isAdmin && (
                          <Tooltip title="Delete payroll run">
                            <IconButton
                              size="small"
                              sx={{ color: '#dc2626' }}
                              onClick={(e) => { e.stopPropagation(); setDeleteId(run.id); }}
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div" count={total} page={page}
          onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
        />
      </Card>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Payroll Run"
        message="Are you sure you want to delete this payroll run? This will permanently remove all entries, deductions, and payslips associated with it. This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => deleteMutation.mutate(deleteId)}
        onCancel={() => setDeleteId(null)}
        color="error"
      />
    </Box>
  );
}
