import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Card, CardContent, Chip, Stack, Grid, alpha,
  Tabs, Tab,
} from '@mui/material';
import {
  PendingActions, Receipt, HealthAndSafety, CheckCircle,
  Send, AttachMoney, ReceiptLong,
} from '@mui/icons-material';
import { ppeRequestService } from '../services/ppeRequestService';
import { payrollRunService } from '../services/payrollRunService';
import { expenseService } from '../services/expenseService';
import LoadingScreen from '../components/LoadingScreen';
import dayjs from 'dayjs';

const PPE_STATUS_STYLES = {
  PENDING: { color: '#d97706', bg: '#fef3c7', label: 'Pending' },
  ELIGIBLE: { color: '#059669', bg: '#d1fae5', label: 'Eligible' },
  NOT_ELIGIBLE: { color: '#dc2626', bg: '#fee2e2', label: 'Not Eligible' },
};

const PAYROLL_STATUS_COLORS = {
  DRAFT: { color: '#6b7280', bg: '#f3f4f6' },
  SUBMITTED: { color: '#d97706', bg: '#fef3c7' },
  APPROVED: { color: '#059669', bg: '#d1fae5' },
  REJECTED: { color: '#dc2626', bg: '#fee2e2' },
};

const EXPENSE_STATUS_COLORS = {
  PENDING: { color: '#d97706', bg: '#fef3c7' },
  APPROVED: { color: '#059669', bg: '#d1fae5' },
  REJECTED: { color: '#dc2626', bg: '#fee2e2' },
};

const months = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function StatusChip({ status, type }) {
  let styles;
  if (type === 'ppe') styles = PPE_STATUS_STYLES;
  else if (type === 'expense') styles = EXPENSE_STATUS_COLORS;
  else styles = PAYROLL_STATUS_COLORS;

  const style = styles[status] || { color: '#6b7280', bg: '#f3f4f6' };
  return (
    <Chip
      label={status?.replace(/_/g, ' ')}
      size="small"
      sx={{
        fontWeight: 600, fontSize: '0.75rem',
        color: style.color, bgcolor: style.bg,
        textTransform: 'capitalize',
      }}
    />
  );
}

export default function PendingApprovals() {
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);

  const { data: ppeData, isLoading: ppeLoading } = useQuery({
    queryKey: ['ppe-requests-pending'],
    queryFn: async () => {
      const res = await ppeRequestService.getPending();
      return res.data;
    },
    refetchInterval: 30000,
  });

  const { data: payrollData, isLoading: payrollLoading } = useQuery({
    queryKey: ['payroll-runs', 0, 50, '', '', 'SUBMITTED'],
    queryFn: async () => {
      const res = await payrollRunService.getAll({ status: 'SUBMITTED', page: 0, size: 50, sort: 'createdAt,desc' });
      return res.data;
    },
    refetchInterval: 30000,
  });

  const { data: expenseData, isLoading: expenseLoading } = useQuery({
    queryKey: ['expenses-pending'],
    queryFn: async () => {
      const res = await expenseService.getAll({ status: 'PENDING', page: 0, size: 50, sort: 'expenseDate,desc' });
      return res.data;
    },
    refetchInterval: 30000,
  });

  const isLoading = ppeLoading || payrollLoading || expenseLoading;
  const pendingPpe = ppeData || [];
  const pendingPayrolls = payrollData?.content || [];
  const pendingExpenses = expenseData?.content || [];

  const totalPending = pendingPpe.length + pendingPayrolls.length + pendingExpenses.length;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            Pending Approvals
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Review and approve pending payroll runs, PPE requests, and expenses
          </Typography>
        </Box>
        <Chip
          icon={<PendingActions />}
          label={`${totalPending} pending`}
          color="warning"
          variant="filled"
          sx={{ fontWeight: 600, px: 1 }}
        />
      </Box>

      {/* Summary cards */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Card
            onClick={() => setTab(0)}
            sx={{
              cursor: 'pointer',
              bgcolor: tab === 0 ? alpha('#d97706', 0.08) : 'background.paper',
              border: '1px solid',
              borderColor: tab === 0 ? alpha('#d97706', 0.3) : 'divider',
              transition: 'all 0.2s ease',
              '&:hover': { borderColor: alpha('#d97706', 0.5), transform: 'translateY(-2px)' },
            }}
          >
            <CardContent sx={{ py: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Box sx={{
                  width: 48, height: 48, borderRadius: 2,
                  bgcolor: alpha('#d97706', 0.12),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Receipt sx={{ color: '#d97706', fontSize: 28 }} />
                </Box>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 800, color: '#d97706' }}>
                    {pendingPayrolls.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" fontWeight={500}>
                    Payroll Runs
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card
            onClick={() => setTab(1)}
            sx={{
              cursor: 'pointer',
              bgcolor: tab === 1 ? alpha('#0D47A1', 0.08) : 'background.paper',
              border: '1px solid',
              borderColor: tab === 1 ? alpha('#0D47A1', 0.3) : 'divider',
              transition: 'all 0.2s ease',
              '&:hover': { borderColor: alpha('#0D47A1', 0.5), transform: 'translateY(-2px)' },
            }}
          >
            <CardContent sx={{ py: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Box sx={{
                  width: 48, height: 48, borderRadius: 2,
                  bgcolor: alpha('#0D47A1', 0.12),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <HealthAndSafety sx={{ color: '#0D47A1', fontSize: 28 }} />
                </Box>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 800, color: '#0D47A1' }}>
                    {pendingPpe.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" fontWeight={500}>
                    PPE Requests
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card
            onClick={() => setTab(2)}
            sx={{
              cursor: 'pointer',
              bgcolor: tab === 2 ? alpha('#7c3aed', 0.08) : 'background.paper',
              border: '1px solid',
              borderColor: tab === 2 ? alpha('#7c3aed', 0.3) : 'divider',
              transition: 'all 0.2s ease',
              '&:hover': { borderColor: alpha('#7c3aed', 0.5), transform: 'translateY(-2px)' },
            }}
          >
            <CardContent sx={{ py: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Box sx={{
                  width: 48, height: 48, borderRadius: 2,
                  bgcolor: alpha('#7c3aed', 0.12),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <ReceiptLong sx={{ color: '#7c3aed', fontSize: 28 }} />
                </Box>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 800, color: '#7c3aed' }}>
                    {pendingExpenses.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" fontWeight={500}>
                    Expenses
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ pb: '0 !important' }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ minHeight: 48 }}>
            <Tab
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  <AttachMoney fontSize="small" />
                  <span>Payroll Runs</span>
                  <Chip label={pendingPayrolls.length} size="small" color="warning" sx={{ fontWeight: 700, minWidth: 24, height: 22 }} />
                </Stack>
              }
              sx={{ textTransform: 'none', fontWeight: 600, minHeight: 48 }}
            />
            <Tab
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  <HealthAndSafety fontSize="small" />
                  <span>PPE Requests</span>
                  <Chip label={pendingPpe.length} size="small" color="primary" sx={{ fontWeight: 700, minWidth: 24, height: 22 }} />
                </Stack>
              }
              sx={{ textTransform: 'none', fontWeight: 600, minHeight: 48 }}
            />
            <Tab
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  <ReceiptLong fontSize="small" />
                  <span>Expenses</span>
                  <Chip label={pendingExpenses.length} size="small" color="secondary" sx={{ fontWeight: 700, minWidth: 24, height: 22 }} />
                </Stack>
              }
              sx={{ textTransform: 'none', fontWeight: 600, minHeight: 48 }}
            />
          </Tabs>
        </CardContent>
      </Card>

      {/* Tab Content */}
      {isLoading ? (
        <LoadingScreen />
      ) : tab === 0 ? (
        <PayrollPendingTable payrolls={pendingPayrolls} navigate={navigate} />
      ) : tab === 1 ? (
        <PpePendingTable requests={pendingPpe} navigate={navigate} />
      ) : (
        <ExpensePendingTable expenses={pendingExpenses} navigate={navigate} />
      )}
    </Box>
  );
}

// ── Payroll Runs Pending Table ──

function PayrollPendingTable({ payrolls, navigate }) {
  if (payrolls.length === 0) {
    return (
      <Card>
        <CardContent sx={{ textAlign: 'center', py: 6 }}>
          <Send sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No pending payroll runs
          </Typography>
          <Typography variant="body2" color="text.disabled">
            All submitted payroll runs have been processed. No pending approvals.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
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
              <TableCell>Created</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {payrolls.map((run) => (
              <TableRow
                key={run.id}
                hover
                sx={{ '&:last-child td': { border: 0 } }}
              >
                <TableCell>
                  <Typography variant="body2" fontWeight={600}>
                    {months[run.month - 1]} {run.year}
                  </Typography>
                </TableCell>
                <TableCell>
                  <StatusChip status={run.status} />
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{run.entryCount ?? '-'}</Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontWeight={600} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    ZMW {(run.totalNetPay ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{run.createdBy?.email || '-'}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{dayjs(run.createdAt).format('DD MMM YYYY')}</Typography>
                </TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                    <Button
                      size="small"
                      variant="contained"
                      color="success"
                      startIcon={<CheckCircle />}
                      onClick={() => navigate(`/payroll-runs/${run.id}`)}
                      sx={{ fontWeight: 600, textTransform: 'none' }}
                    >
                      Review
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  );
}

// ── PPE Requests Pending Table ──

function PpePendingTable({ requests, navigate }) {
  if (requests.length === 0) {
    return (
      <Card>
        <CardContent sx={{ textAlign: 'center', py: 6 }}>
          <HealthAndSafety sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No pending PPE requests
          </Typography>
          <Typography variant="body2" color="text.disabled">
            All PPE requests have been reviewed. No pending approvals.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Employee</TableCell>
              <TableCell>Items</TableCell>
              <TableCell>Due Date</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Requested By</TableCell>
              <TableCell>Created</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {requests.map((req) => (
              <TableRow
                key={req.id}
                hover
                sx={{ '&:last-child td': { border: 0 } }}
              >
                <TableCell>
                  <Typography variant="body2" fontWeight={500}>
                    {req.employeeName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {req.employeeNumber}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    {req.items?.map((item) => (
                      <Chip key={item.id} label={item.name} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                    ))}
                  </Stack>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {dayjs(req.dueDate).format('DD/MM/YYYY')}
                  </Typography>
                </TableCell>
                <TableCell>
                  <StatusChip status={req.status} type="ppe" />
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{req.requestedByName}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="caption" color="text.secondary">
                    {dayjs(req.createdAt).format('DD/MM/YYYY')}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Button
                    size="small"
                    variant="contained"
                    color="success"
                    startIcon={<CheckCircle />}
                    onClick={() => navigate(`/ppe/${req.id}`)}
                    sx={{ fontWeight: 600, textTransform: 'none' }}
                  >
                    Review
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  );
}

// ── Expenses Pending Table ──

function ExpensePendingTable({ expenses, navigate }) {
  if (expenses.length === 0) {
    return (
      <Card>
        <CardContent sx={{ textAlign: 'center', py: 6 }}>
          <ReceiptLong sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No pending expenses
          </Typography>
          <Typography variant="body2" color="text.disabled">
            All expenses have been reviewed. No pending approvals.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Item</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Submitted By</TableCell>
              <TableCell>Remarks</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {expenses.map((exp) => (
              <TableRow
                key={exp.id}
                hover
                sx={{ '&:last-child td': { border: 0 } }}
              >
                <TableCell>
                  <Typography variant="body2" fontWeight={500}>
                    {exp.item}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontWeight={600}>
                    ZMW {exp.amount?.toLocaleString()}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {dayjs(exp.expenseDate).format('DD MMM YYYY')}
                  </Typography>
                </TableCell>
                <TableCell>
                  <StatusChip status={exp.status} type="expense" />
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {exp.createdBy?.firstName} {exp.createdBy?.lastName}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="caption" color="text.secondary" sx={{
                    display: 'block', maxWidth: 200,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {exp.remarks || '—'}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Button
                    size="small"
                    variant="contained"
                    color="success"
                    startIcon={<CheckCircle />}
                    onClick={() => navigate('/expenses')}
                    sx={{ fontWeight: 600, textTransform: 'none' }}
                  >
                    Review
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  );
}
