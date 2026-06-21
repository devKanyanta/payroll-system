import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Typography, TextField, Select, MenuItem, FormControl,
  InputLabel, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Card, CardContent, Grid, TablePagination, Chip,
} from '@mui/material';
import { auditLogService } from '../services/auditLogService';
import LoadingScreen from '../components/LoadingScreen';
import dayjs from 'dayjs';

const actionColors = {
  CREATE: 'success', UPDATE: 'info', DELETE: 'error', LOGIN: 'default', LOGOUT: 'default',
};

export default function AuditLogs() {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { data: pageData, isLoading } = useQuery({
    queryKey: ['audit-logs', page, rowsPerPage, actionFilter, entityFilter, startDate, endDate],
    queryFn: async () => {
      const params = { page, size: rowsPerPage, sort: 'timestamp,desc' };
      if (actionFilter) params.action = actionFilter;
      if (entityFilter) params.entityName = entityFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const res = await auditLogService.getAll(params);
      return res.data;
    },
  });

  if (isLoading) return <LoadingScreen />;

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>Audit Logs</Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ pb: 1 }}>
          <Grid container spacing={2}>
            <Grid item xs={6} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Action</InputLabel>
                <Select value={actionFilter} label="Action" onChange={(e) => { setActionFilter(e.target.value); setPage(0); }}>
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="CREATE">Create</MenuItem>
                  <MenuItem value="UPDATE">Update</MenuItem>
                  <MenuItem value="DELETE">Delete</MenuItem>
                  <MenuItem value="LOGIN">Login</MenuItem>
                  <MenuItem value="LOGOUT">Logout</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Entity</InputLabel>
                <Select value={entityFilter} label="Entity" onChange={(e) => { setEntityFilter(e.target.value); setPage(0); }}>
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="Employee">Employee</MenuItem>
                  <MenuItem value="PayrollRun">Payroll Run</MenuItem>
                  <MenuItem value="Loan">Loan</MenuItem>
                  <MenuItem value="User">User</MenuItem>
                  <MenuItem value="Department">Department</MenuItem>
                  <MenuItem value="Expense">Expense</MenuItem>
                  <MenuItem value="PayrollSettings">Settings</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField fullWidth label="From" type="datetime-local" size="small"
                value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(0); }}
                InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField fullWidth label="To" type="datetime-local" size="small"
                value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(0); }}
                InputLabelProps={{ shrink: true }} />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Timestamp</TableCell>
                <TableCell>User</TableCell>
                <TableCell>Action</TableCell>
                <TableCell>Entity</TableCell>
                <TableCell>Entity ID</TableCell>
                <TableCell>IP Address</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pageData?.content?.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center">No audit logs found</TableCell></TableRow>
              ) : (
                pageData?.content?.map((log) => (
                  <TableRow key={log.id} hover>
                    <TableCell>{dayjs(log.timestamp).format('DD MMM YYYY HH:mm:ss')}</TableCell>
                    <TableCell>{log.user?.firstName} {log.user?.lastName}</TableCell>
                    <TableCell>
                      <Chip label={log.action} size="small" color={actionColors[log.action] || 'default'} />
                    </TableCell>
                    <TableCell>{log.entityName}</TableCell>
                    <TableCell sx={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {log.entityId}
                    </TableCell>
                    <TableCell>{log.ipAddress || '-'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination component="div" count={pageData?.totalElements || 0} page={page}
          onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }} />
      </Card>
    </Box>
  );
}
