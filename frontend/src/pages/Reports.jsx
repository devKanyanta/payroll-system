import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Typography, Button, Card, CardContent, Grid, TextField,
  Select, MenuItem, FormControl, InputLabel, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Divider, Alert,
} from '@mui/material';
import { Download, PictureAsPdf, TableChart } from '@mui/icons-material';
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
    try {
      await reportService.exportExcel(month, year);
    } catch (err) {
      console.error('Excel export failed:', err);
    }
  };

  const handleExportPdf = async () => {
    try {
      await reportService.exportPdf(month, year);
    } catch (err) {
      console.error('PDF export failed:', err);
    }
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>Reports</Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ pb: 1 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={6} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Month</InputLabel>
                <Select value={month} label="Month" onChange={(e) => setMonth(e.target.value)}>
                  {months.map((m) => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField fullWidth label="Year" type="number" size="small" value={year}
                onChange={(e) => setYear(parseInt(e.target.value))} />
            </Grid>
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Department</InputLabel>
                <Select value={deptId} label="Department" onChange={(e) => setDeptId(e.target.value)}>
                  <MenuItem value="">All Departments</MenuItem>
                  {departments?.map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button size="small" variant="outlined" startIcon={<Download />} onClick={handleExportExcel}>
                  Excel
                </Button>
                <Button size="small" variant="outlined" startIcon={<PictureAsPdf />} onClick={handleExportPdf}>
                  PDF
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, mb: 3, borderBottom: 1, borderColor: 'divider', pb: 1 }}>
            <Button variant={tab === 'payroll' ? 'contained' : 'text'}
              onClick={() => setTab('payroll')}>Payroll Summary</Button>
            <Button variant={tab === 'expenses' ? 'contained' : 'text'}
              onClick={() => setTab('expenses')}>Expense Report</Button>
          </Box>

          {tab === 'payroll' && (
            summaryLoading ? <LoadingScreen /> : !payrollSummary ? (
              <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>No data</Typography>
            ) : (
              <Grid container spacing={3}>
                <SummaryCard label="Total Employees" value={payrollSummary.totalEmployees} />
                <SummaryCard label="Total Gross Salary" value={`ZMW ${(payrollSummary.totalGrossSalary || 0).toLocaleString()}`} />
                <SummaryCard label="Total NHIMA" value={`ZMW ${(payrollSummary.totalNhima || 0).toLocaleString()}`} />
                <SummaryCard label="Total NAPSA" value={`ZMW ${(payrollSummary.totalNapsa || 0).toLocaleString()}`} />
                <SummaryCard label="Total Loan Deductions" value={`ZMW ${(payrollSummary.totalLoanDeductions || 0).toLocaleString()}`} />
                <SummaryCard label="Total Other Deductions" value={`ZMW ${(payrollSummary.totalOtherDeductions || 0).toLocaleString()}`} />
                <SummaryCard label="Total Deductions" value={`ZMW ${(payrollSummary.totalDeductions || 0).toLocaleString()}`} />
                <SummaryCard label="Total Net Salary" value={`ZMW ${(payrollSummary.totalNetSalary || 0).toLocaleString()}`}
                  highlight />
              </Grid>
            )
          )}

          {tab === 'expenses' && (
            expenseLoading ? <LoadingScreen /> : !expenseReport ? (
              <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>No data</Typography>
            ) : (
              <Box>
                <Grid container spacing={3}>
                  <SummaryCard label="Total Expenses" value={`ZMW ${(expenseReport.totalExpenses || 0).toLocaleString()}`} highlight />
                  <SummaryCard label="Expense Count" value={expenseReport.expenseCount || 0} />
                </Grid>
              </Box>
            )
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

function SummaryCard({ label, value, highlight }) {
  return (
    <Grid item xs={12} sm={6} md={3}>
      <Card variant="outlined" sx={{
        bgcolor: highlight ? 'primary.main' : 'background.paper',
        color: highlight ? 'white' : 'text.primary',
      }}>
        <CardContent>
          <Typography variant="body2" sx={{ mb: 1, opacity: 0.8 }}>{label}</Typography>
          <Typography variant="h5" fontWeight={700}>{value}</Typography>
        </CardContent>
      </Card>
    </Grid>
  );
}
