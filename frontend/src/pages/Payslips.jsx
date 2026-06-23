import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, MenuItem, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Chip, Card, CardContent, IconButton, Tooltip, Stack, alpha,
  Autocomplete, TextField, Grid,
} from '@mui/material';
import {
  Download, Email, PictureAsPdf, Description, CheckCircle, Cancel,
} from '@mui/icons-material';
import { payslipService } from '../services/payslipService';
import { employeeService } from '../services/employeeService';
import LoadingScreen from '../components/LoadingScreen';
import dayjs from 'dayjs';

const EMAIL_STATUS_COLORS = {
  sent: { color: '#059669', bg: '#d1fae5' },
  not_sent: { color: '#6b7280', bg: '#f3f4f6' },
};

export default function Payslips() {
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeInputValue, setEmployeeInputValue] = useState('');
  const queryClient = useQueryClient();

  const { data: employees } = useQuery({
    queryKey: ['employees-mini'],
    queryFn: async () => {
      const res = await employeeService.getAll({ size: 200, sort: 'firstName,asc' });
      return res.data.content;
    },
  });

  const { data: payslips, isLoading } = useQuery({
    queryKey: ['payslips', selectedEmployee?.id],
    queryFn: async () => {
      if (!selectedEmployee?.id) return [];
      const res = await payslipService.getByEmployee(selectedEmployee.id);
      return res.data;
    },
    enabled: !!selectedEmployee?.id,
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
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Payslips</Typography>
          <Typography variant="body2" color="text.secondary">
            View, download, and email employee payslips
          </Typography>
        </Box>
      </Box>

      {/* ── Employee Selector ── */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ pb: '12px !important' }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={4}>
              <Autocomplete
                value={selectedEmployee}
                onChange={(_, newValue) => setSelectedEmployee(newValue)}
                inputValue={employeeInputValue}
                onInputChange={(_, newValue) => setEmployeeInputValue(newValue)}
                options={employees || []}
                getOptionLabel={(option) =>
                  `${option.employeeNumber} — ${option.firstName} ${option.lastName}`
                }
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderInput={(params) => (
                  <TextField {...params} label="Select Employee" size="small" />
                )}
                renderOption={(props, option) => (
                  <MenuItem {...props} key={option.id}>
                    <Box>
                      <Typography variant="body2" fontWeight={500}>
                        {option.firstName} {option.lastName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {option.employeeNumber} {option.position ? `· ${option.position}` : ''}
                      </Typography>
                    </Box>
                  </MenuItem>
                )}
                noOptionsText="No employees found"
              />
            </Grid>
            {selectedEmployee && payslips && (
              <Grid item xs={12} sm={6} md={8}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: { sm: 'right' } }}>
                  {payslips.length} payslip{payslips.length !== 1 ? 's' : ''}
                  {payslips.filter((p) => p.emailedAt).length > 0
                    ? ` · ${payslips.filter((p) => p.emailedAt).length} emailed`
                    : ''}
                </Typography>
              </Grid>
            )}
          </Grid>
        </CardContent>
      </Card>

      {/* ── Table ── */}
      {!selectedEmployee ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <PictureAsPdf sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Select an Employee
            </Typography>
            <Typography variant="body2" color="text.disabled">
              Choose an employee from the selector above to view their payslips
            </Typography>
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
                  <TableCell>Net Pay</TableCell>
                  <TableCell>Email Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {payslips?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                      <Box sx={{ textAlign: 'center', py: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          No payslips found for this employee
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : (
                  payslips?.map((payslip) => {
                    const period = payslip.payrollEntry?.payrollRun
                      ? `${months[payslip.payrollEntry.payrollRun.month - 1]} ${payslip.payrollEntry.payrollRun.year}`
                      : payslip.payrollEntry?.id
                        ? dayjs(payslip.createdAt).format('MMM YYYY')
                        : '-';
                    const emailed = !!payslip.emailedAt;
                    const emailColors = emailed ? EMAIL_STATUS_COLORS.sent : EMAIL_STATUS_COLORS.not_sent;
                    const netPay = payslip.payrollEntry?.netSalary;

                    return (
                      <TableRow key={payslip.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {period}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {payslip.generatedAt
                              ? dayjs(payslip.generatedAt).format('DD MMM YYYY HH:mm')
                              : '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                            {netPay ? formatCurrency(netPay) : '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={emailed ? `Sent ${dayjs(payslip.emailedAt).format('DD MMM')}` : 'Not sent'}
                            size="small"
                            sx={{
                              fontWeight: 600,
                              fontSize: '0.75rem',
                              color: emailColors.color,
                              bgcolor: emailColors.bg,
                            }}
                            icon={emailed ? <CheckCircle sx={{ fontSize: 14 }} /> : <Cancel sx={{ fontSize: 14 }} />}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <Tooltip title="Download PDF">
                              <IconButton size="small" onClick={() => handleDownload(payslip.id)}>
                                <Download fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Email Payslip">
                              <IconButton
                                size="small"
                                onClick={() => emailMutation.mutate(payslip.id)}
                                disabled={emailMutation.isPending}
                              >
                                <Email fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}
    </Box>
  );
}
