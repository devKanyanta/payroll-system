import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Button, Select, MenuItem, FormControl,
  InputLabel, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Chip, Card, CardContent, IconButton, Tooltip,
} from '@mui/material';
import { Download, Email, PictureAsPdf } from '@mui/icons-material';
import { payslipService } from '../services/payslipService';
import { employeeService } from '../services/employeeService';
import LoadingScreen from '../components/LoadingScreen';
import dayjs from 'dayjs';

export default function Payslips() {
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const queryClient = useQueryClient();

  const { data: employees } = useQuery({
    queryKey: ['employees-mini'],
    queryFn: async () => { const res = await employeeService.getAll({ size: 200 }); return res.data.content; },
  });

  const { data: payslips, isLoading } = useQuery({
    queryKey: ['payslips', selectedEmployee],
    queryFn: async () => {
      if (!selectedEmployee) return [];
      const res = await payslipService.getByEmployee(selectedEmployee);
      return res.data;
    },
    enabled: !!selectedEmployee,
  });

  const emailMutation = useMutation({
    mutationFn: (id) => payslipService.email(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payslips'] }),
  });

  const handleDownload = async (id) => {
    try {
      const res = await payslipService.download(id);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payslip-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download payslip:', err);
    }
  };

  if (isLoading) return <LoadingScreen />;

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>Payslips</Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <FormControl fullWidth>
            <InputLabel>Select Employee</InputLabel>
            <Select
              value={selectedEmployee} label="Select Employee"
              onChange={(e) => setSelectedEmployee(e.target.value)}
            >
              {employees?.map((emp) => (
                <MenuItem key={emp.id} value={emp.id}>
                  {emp.employeeNumber} - {emp.firstName} {emp.lastName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </CardContent>
      </Card>

      {!selectedEmployee ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <PictureAsPdf sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography color="text.secondary">Select an employee to view their payslips</Typography>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Period</TableCell>
                  <TableCell>Generated</TableCell>
                  <TableCell>Emailed</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {payslips?.length === 0 ? (
                  <TableRow><TableCell colSpan={4} align="center">No payslips found</TableCell></TableRow>
                ) : (
                  payslips?.map((payslip) => (
                    <TableRow key={payslip.id} hover>
                      <TableCell>
                        {payslip.payrollEntry?.payrollRun
                          ? `${months[payslip.payrollEntry.payrollRun.month - 1]} ${payslip.payrollEntry.payrollRun.year}`
                          : payslip.payrollEntry?.id ? dayjs(payslip.createdAt).format('MMM YYYY') : '-'}
                      </TableCell>
                      <TableCell>{dayjs(payslip.generatedAt).format('DD MMM YYYY HH:mm')}</TableCell>
                      <TableCell>
                        {payslip.emailedAt
                          ? dayjs(payslip.emailedAt).format('DD MMM YYYY HH:mm')
                          : <Chip label="Not sent" size="small" variant="outlined" />}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Download PDF">
                          <IconButton size="small" onClick={() => handleDownload(payslip.id)}>
                            <Download />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Email Payslip">
                          <IconButton size="small" onClick={() => emailMutation.mutate(payslip.id)}
                            disabled={emailMutation.isPending}>
                            <Email />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}
    </Box>
  );
}
