import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Typography, Button, Card, CardContent, Grid, TextField,
  Select, MenuItem, FormControl, InputLabel, Stack, alpha,
} from '@mui/material';
import {
  Download, PictureAsPdf, People, Receipt, AccountBalance,
  TrendingDown, MoneyOff, Description,
} from '@mui/icons-material';
import { reportService } from '../services/reportService';
import { departmentService } from '../services/departmentService';
import LoadingScreen from '../components/LoadingScreen';

const months = [
  { value: 1, label: 'January' }, { value: 2, label: 'February' },
  { value: 3, label: 'March' }, { value: 4, label: 'April' },
  { value: 5, label: 'May' }, { value: 6, label: 'June' },
  { value: 7, label: 'July' }, { value: 8, label: 'August' },
  { value: 9, label: 'September' }, { value: 10, label: 'October' },
  { value: 11, label: 'November' }, { value: 12, label: 'December' },
];

function StatCard({ label, value, icon, color }) {
  return (
    <Grid item xs={12} sm={6} md={3}>
      <Card sx={{
        bgcolor: color ? alpha(color, 0.08) : 'background.paper',
        border: color ? `1px solid ${alpha(color, 0.2)}` : undefined,
      }}>
        <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            {icon && (
              <Box sx={{
                width: 40, height: 40, borderRadius: 1.5,
                bgcolor: color ? alpha(color, 0.12) : alpha('#6b7280', 0.08),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {icon}
              </Box>
            )}
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={500} sx={{ display: 'block', whiteSpace: 'nowrap' }}>
                {label}
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2, fontSize: '1rem', fontVariantNumeric: 'tabular-nums' }}>
                {value}
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Grid>
  );
}

export default function Reports() {
  const [tab, setTab] = useState('payroll');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [deptId, setDeptId] = useState('');

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => { const res = await departmentService.getAll(); return res.data; },
  });

  const { data: payrollSummary, isLoading: summaryLoading } = useQuery({
    queryKey: ['payroll-summary', month, year, deptId],
    queryFn: async () => {
      const params = { month, year };
      if (deptId) params.departmentId = deptId;
      const res = await reportService.getPayrollSummary(params);
      return res.data;
    },
    enabled: tab === 'payroll',
  });

  const { data: expenseReport, isLoading: expenseLoading } = useQuery({
    queryKey: ['expense-report', month, year],
    queryFn: async () => {
      const res = await reportService.getExpenseReport({ month, year });
      return res.data;
    },
    enabled: tab === 'expenses',
  });

  const handleExportExcel = async () => {
    try { await reportService.exportExcel(month, year); }
    catch (err) { console.error('Excel export failed:', err); }
  };

  const handleExportPdf = async () => {
    try { await reportService.exportPdf(month, year); }
    catch (err) { console.error('PDF export failed:', err); }
  };

  const formatCurrency = (value) => {
    if (value == null) return 'ZMW 0';
    return `ZMW ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <Box>
      {/* ── Header ── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Reports</Typography>
          <Typography variant="body2" color="text.secondary">
            View and export payroll summaries and expense reports
          </Typography>
        </Box>
      </Box>

      {/* ── Filters ── */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ pb: '12px !important' }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={6} sm={3} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Month</InputLabel>
                <Select value={month} label="Month" onChange={(e) => setMonth(e.target.value)}>
                  {months.map((m) => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <TextField fullWidth label="Year" type="number" size="small" value={year}
                onChange={(e) => setYear(parseInt(e.target.value) || new Date().getFullYear())} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Department</InputLabel>
                <Select value={deptId} label="Department" onChange={(e) => setDeptId(e.target.value)}>
                  <MenuItem value="">All Departments</MenuItem>
                  {departments?.map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={12} md={5}>
              <Stack direction="row" spacing={1} justifyContent={{ xs: 'flex-start', md: 'flex-end' }}>
                <Button size="small" variant="outlined" startIcon={<Download />} onClick={handleExportExcel}>
                  Excel
                </Button>
                <Button size="small" variant="outlined" startIcon={<PictureAsPdf />} onClick={handleExportPdf}>
                  PDF
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* ── Tab Content ── */}
      <Card>
        <CardContent>
          {/* Tabs */}
          <Box sx={{ display: 'flex', gap: 0, mb: 3, borderBottom: 1, borderColor: 'divider' }}>
            <Box
              onClick={() => setTab('payroll')}
              sx={{
                px: 3, py: 1.5, cursor: 'pointer', userSelect: 'none', fontWeight: 600, fontSize: '0.875rem',
                color: tab === 'payroll' ? '#2563eb' : 'text.secondary',
                borderBottom: tab === 'payroll' ? '2px solid #2563eb' : '2px solid transparent',
                mb: '-1px',
                transition: 'all 0.15s',
                '&:hover': { color: tab === 'payroll' ? '#2563eb' : 'text.primary' },
              }}
            >
              Payroll Summary
            </Box>
            <Box
              onClick={() => setTab('expenses')}
              sx={{
                px: 3, py: 1.5, cursor: 'pointer', userSelect: 'none', fontWeight: 600, fontSize: '0.875rem',
                color: tab === 'expenses' ? '#2563eb' : 'text.secondary',
                borderBottom: tab === 'expenses' ? '2px solid #2563eb' : '2px solid transparent',
                mb: '-1px',
                transition: 'all 0.15s',
                '&:hover': { color: tab === 'expenses' ? '#2563eb' : 'text.primary' },
              }}
            >
              Expense Report
            </Box>
          </Box>

          {/* Payroll Summary */}
          {tab === 'payroll' && (
            summaryLoading ? <LoadingScreen /> : !payrollSummary ? (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <Receipt sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No Payroll Data
                </Typography>
                <Typography variant="body2" color="text.disabled">
                  Select a different month/year or run a payroll for this period
                </Typography>
              </Box>
            ) : (
              <Grid container spacing={2}>
                <StatCard
                  label="Total Employees"
                  value={payrollSummary.totalEmployees || 0}
                  icon={<People sx={{ color: '#2563eb', fontSize: 20 }} />}
                  color="#2563eb"
                />
                <StatCard
                  label="Total NHIMA"
                  value={formatCurrency(payrollSummary.totalNhima)}
                  icon={<TrendingDown sx={{ color: '#d97706', fontSize: 20 }} />}
                  color="#d97706"
                />
                <StatCard
                  label="Total NAPSA"
                  value={formatCurrency(payrollSummary.totalNapsa)}
                  icon={<TrendingDown sx={{ color: '#d97706', fontSize: 20 }} />}
                  color="#d97706"
                />
                <StatCard
                  label="Total Loan Deductions"
                  value={formatCurrency(payrollSummary.totalLoanDeductions)}
                  icon={<MoneyOff sx={{ color: '#dc2626', fontSize: 20 }} />}
                  color="#dc2626"
                />
                <StatCard
                  label="Total Other Deductions"
                  value={formatCurrency(payrollSummary.totalOtherDeductions)}
                  icon={<MoneyOff sx={{ color: '#dc2626', fontSize: 20 }} />}
                  color="#dc2626"
                />
                <StatCard
                  label="Total Deductions"
                  value={formatCurrency(payrollSummary.totalDeductions)}
                  icon={<TrendingDown sx={{ color: '#dc2626', fontSize: 20 }} />}
                  color="#dc2626"
                />
                <StatCard
                  label="Total Net Salary"
                  value={formatCurrency(payrollSummary.totalNetSalary)}
                  icon={<AccountBalance sx={{ color: '#059669', fontSize: 20 }} />}
                  color="#059669"
                />
              </Grid>
            )
          )}

          {/* Expense Report */}
          {tab === 'expenses' && (
            expenseLoading ? <LoadingScreen /> : !expenseReport ? (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <Receipt sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No Expense Data
                </Typography>
                <Typography variant="body2" color="text.disabled">
                  No expenses recorded for this period
                </Typography>
              </Box>
            ) : (
              <Grid container spacing={2}>
                <StatCard
                  label="Total Expenses"
                  value={formatCurrency(expenseReport.totalExpenses)}
                  icon={<AccountBalance sx={{ color: '#059669', fontSize: 20 }} />}
                  color="#059669"
                />
                <StatCard
                  label="Expense Count"
                  value={expenseReport.expenseCount || 0}
                  icon={<Description sx={{ color: '#2563eb', fontSize: 20 }} />}
                  color="#2563eb"
                />
              </Grid>
            )
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
