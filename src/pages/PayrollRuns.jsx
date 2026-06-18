import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Typography, Button, Select, MenuItem, FormControl,
  InputLabel, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Chip, Card, CardContent, TablePagination, Grid,
} from '@mui/material';
import { Add, Visibility } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { payrollRunService } from '../services/payrollRunService';
import LoadingScreen from '../components/LoadingScreen';
import dayjs from 'dayjs';

const statusColors = {
  DRAFT: 'default', SUBMITTED: 'warning', APPROVED: 'success', REJECTED: 'error',
};

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
  const navigate = useNavigate();

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

  const getMonthName = (m) => months.find((mo) => mo.value === m)?.label || m;

  if (isLoading) return <LoadingScreen />;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Payroll Runs</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/payroll-runs/new')}>
          New Payroll Run
        </Button>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ pb: 1 }}>
          <Grid container spacing={2}>
            <Grid item xs={6} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Month</InputLabel>
                <Select value={monthFilter} label="Month" onChange={(e) => { setMonthFilter(e.target.value); setPage(0); }}>
                  <MenuItem value="">All</MenuItem>
                  {months.map((m) => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Year</InputLabel>
                <Select value={yearFilter} label="Year" onChange={(e) => { setYearFilter(e.target.value); setPage(0); }}>
                  <MenuItem value="">All</MenuItem>
                  {[2024, 2025, 2026].map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={3}>
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
          </Grid>
        </CardContent>
      </Card>

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Period</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created By</TableCell>
                <TableCell>Approved By</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pageData?.content?.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center">No payroll runs found</TableCell></TableRow>
              ) : (
                pageData?.content?.map((run) => (
                  <TableRow key={run.id} hover sx={{ cursor: 'pointer' }}>
                    <TableCell onClick={() => navigate(`/payroll-runs/${run.id}`)}>
                      <Typography fontWeight={500}>
                        {getMonthName(run.month)} {run.year}
                      </Typography>
                    </TableCell>
                    <TableCell onClick={() => navigate(`/payroll-runs/${run.id}`)}>
                      <Chip label={run.status} size="small" color={statusColors[run.status] || 'default'} />
                    </TableCell>
                    <TableCell onClick={() => navigate(`/payroll-runs/${run.id}`)}>
                      {run.createdBy?.email || '-'}
                    </TableCell>
                    <TableCell onClick={() => navigate(`/payroll-runs/${run.id}`)}>
                      {run.approvedBy?.email || '-'}
                    </TableCell>
                    <TableCell onClick={() => navigate(`/payroll-runs/${run.id}`)}>
                      {dayjs(run.createdAt).format('DD MMM YYYY')}
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small" startIcon={<Visibility />}
                        onClick={() => navigate(`/payroll-runs/${run.id}`)}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div" count={pageData?.totalElements || 0} page={page}
          onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
        />
      </Card>
    </Box>
  );
}
