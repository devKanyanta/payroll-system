import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, MenuItem, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Chip, Card, CardContent, IconButton, Tooltip, Stack, alpha, useTheme,
  Autocomplete, TextField, Grid, Button, FormControl, Select, InputLabel,
} from '@mui/material';
import {
  Download, Email, PictureAsPdf, CheckCircle, Cancel,
  CloudDownload, FilterAlt, Receipt,
  DescriptionOutlined,
} from '@mui/icons-material';
import { payslipService } from '../services/payslipService';
import { employeeService } from '../services/employeeService';
import LoadingScreen from '../components/LoadingScreen';
import dayjs from 'dayjs';

const EMAIL_STATUS_COLORS = {
  sent: { color: '#059669', bg: '#d1fae5' },
  not_sent: { color: '#6b7280', bg: '#f3f4f6' },
};

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const currentMonth = new Date().getMonth() + 1; // 1-indexed
const currentYear = new Date().getFullYear();

export default function Payslips() {
  const theme = useTheme();
  const queryClient = useQueryClient();

  // ── Month/Year selectors for bulk download ──
  const [bulkMonth, setBulkMonth] = useState(currentMonth);
  const [bulkYear, setBulkYear] = useState(currentYear);

  // ── Employee selector for individual view ──
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeInputValue, setEmployeeInputValue] = useState('');

  // ── Bulk download state ──
  const [downloading, setDownloading] = useState(false);

  // ── Fetch employees list ──
  const { data: employees } = useQuery({
    queryKey: ['employees-mini'],
    queryFn: async () => {
      const res = await employeeService.getAll({ size: 200, sort: 'firstName,asc' });
      return res.data.content;
    },
  });

  // ── Fetch payslips for selected employee ──
  const { data: payslips, isLoading } = useQuery({
    queryKey: ['payslips', selectedEmployee?.id],
    queryFn: async () => {
      if (!selectedEmployee?.id) return [];
      const res = await payslipService.getByEmployee(selectedEmployee.id);
      return res.data;
    },
    enabled: !!selectedEmployee?.id,
  });

  // ── Email mutation ──
  const emailMutation = useMutation({
    mutationFn: (id) => payslipService.email(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payslips'] }),
  });

  // ── Download single payslip handler ──
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

  // ── Bulk download handler ──
  const handleBulkDownload = async () => {
    setDownloading(true);
    try {
      const res = await payslipService.downloadByMonth(bulkMonth, bulkYear);
      const blob = new Blob([res.data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payslips-${MONTHS[bulkMonth - 1]}-${bulkYear}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download bulk payslips:', err);
      if (err.response?.status === 400 || err.response?.status === 404) {
        alert(`No payslips found for ${MONTHS[bulkMonth - 1]} ${bulkYear}. Please ensure payslips have been generated for this period.`);
      } else {
        alert('Failed to download payslips. Please try again.');
      }
    } finally {
      setDownloading(false);
    }
  };

  // ── Format currency ──
  const formatCurrency = (value) => {
    if (value == null) return '—';
    return `ZMW ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // ── Derived stats ──
  const emailedCount = payslips?.filter((p) => !!p.emailedAt).length || 0;
  const totalPayslips = payslips?.length || 0;

  // ── Loading state ──
  if (isLoading) return <LoadingScreen />;

  return (
    <Box>
      {/* ── Header ── */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mb: 3,
          flexWrap: 'wrap',
          gap: 1,
          p: 3,
          pb: 2,
          borderRadius: 3,
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.primary.light, 0.04)} 100%)`,
          border: '1px solid',
          borderColor: alpha(theme.palette.primary.main, 0.1),
        }}
      >
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <Box
              sx={{
                p: 1,
                borderRadius: 2,
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                color: theme.palette.primary.main,
                display: 'flex',
              }}
            >
              <Receipt />
            </Box>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>
                Payslips
              </Typography>
              <Typography variant="body2" color="text.secondary">
                View, download, and email employee payslips
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* ── Bulk Download Card ── */}
      <Card
        sx={{
          mb: 3,
          border: '1px solid',
          borderColor: alpha(theme.palette.primary.main, 0.15),
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.03)} 0%, ${alpha(theme.palette.primary.light, 0.02)} 100%)`,
        }}
      >
        <CardContent sx={{ pb: '16px !important' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
            <Box
              sx={{
                p: 0.8,
                borderRadius: 1.5,
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                color: theme.palette.primary.main,
                display: 'flex',
              }}
            >
              <CloudDownload fontSize="small" />
            </Box>
            <Typography variant="h6" fontWeight={700}>
              Bulk Download
            </Typography>
          </Box>

          <Grid container spacing={2} alignItems="flex-end">
            <Grid item xs={6} sm={4} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Month</InputLabel>
                <Select
                  value={bulkMonth}
                  label="Month"
                  onChange={(e) => setBulkMonth(Number(e.target.value))}
                >
                  {MONTHS.map((name, idx) => (
                    <MenuItem key={idx + 1} value={idx + 1}>
                      {name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <TextField
                fullWidth
                size="small"
                label="Year"
                type="number"
                value={bulkYear}
                onChange={(e) => setBulkYear(Number(e.target.value))}
                slotProps={{ htmlInput: { min: 2020, max: 2035 } }}
              />
            </Grid>
            <Grid item xs={12} sm={4} md={3}>
              <Button
                variant="contained"
                fullWidth
                startIcon={<CloudDownload />}
                onClick={handleBulkDownload}
                disabled={downloading}
                sx={{
                  py: 1,
                  boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.3)}`,
                  '&:hover': {
                    boxShadow: `0 6px 20px ${alpha(theme.palette.primary.main, 0.4)}`,
                    transform: 'translateY(-1px)',
                  },
                  transition: 'all 0.2s ease',
                }}
              >
                {downloading ? 'Downloading...' : 'Download All'}
              </Button>
            </Grid>
            <Grid item xs={12} md={5}>
              <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <DescriptionOutlined sx={{ fontSize: 16 }} />
                Download all payslips for {MONTHS[bulkMonth - 1]} {bulkYear} as a ZIP file
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* ── Employee Selector ── */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ pb: '12px !important'}}>
          <Grid container spacing={2}>
            {/* Employee autocomplete on its own full-width row */}
            <Grid item xs={12}>
              <Autocomplete
                fullWidth
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
                renderOption={(props, option) => {
                  const { key, ...optionProps } = props;
                  return (
                    <Box
                      component="li"
                      key={key}
                      {...optionProps}
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        px: 2,
                        py: 1,
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                    >
                      <Typography variant="body2" fontWeight={500}>
                        {option.firstName} {option.lastName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {option.employeeNumber} {option.position ? `· ${option.position}` : ''}
                      </Typography>
                    </Box>
                  );
                }}
                noOptionsText="No employees found"
              />
            </Grid>

            {selectedEmployee && (
              <>
                {/* ── Summary Chips (separate row below) ── */}
                <Grid item xs={4} sm={3} md={2}>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: alpha(theme.palette.primary.main, 0.06),
                      textAlign: 'center',
                    }}
                  >
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 500 }}>
                      Payslips
                    </Typography>
                    <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.2, mt: 0.3 }}>
                      {totalPayslips}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={4} sm={3} md={2}>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: alpha('#059669', 0.06),
                      textAlign: 'center',
                    }}
                  >
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 500 }}>
                      Emailed
                    </Typography>
                    <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.2, mt: 0.3, color: '#059669' }}>
                      {emailedCount}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={4} sm={3} md={2}>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: alpha('#6b7280', 0.06),
                      textAlign: 'center',
                    }}
                  >
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 500 }}>
                      Pending
                    </Typography>
                    <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.2, mt: 0.3, color: '#6b7280' }}>
                      {totalPayslips - emailedCount}
                    </Typography>
                  </Box>
                </Grid>
              </>
            )}
          </Grid>
        </CardContent>
      </Card>

      {/* ── Content Area ── */}
      {!selectedEmployee ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 10 }}>
            <Box
              sx={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                bgcolor: alpha(theme.palette.primary.main, 0.06),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2,
              }}
            >
              <PictureAsPdf sx={{ fontSize: 40, color: alpha(theme.palette.primary.main, 0.3) }} />
            </Box>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Select an Employee
            </Typography>
            <Typography variant="body2" color="text.disabled" sx={{ maxWidth: 360, mx: 'auto' }}>
              Choose an employee from the selector above to view their payslips, or use the bulk download section to download payslips for an entire month at once.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Card>
          {/* ── Table Header ── */}
          <Box
            sx={{
              px: 2,
              py: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <FilterAlt sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="body2" fontWeight={600}>
                {selectedEmployee
                  ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}`
                  : 'All Payslips'}
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary">
              {totalPayslips} record{totalPayslips !== 1 ? 's' : ''}
            </Typography>
          </Box>

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
                {totalPayslips === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                      <Box sx={{ textAlign: 'center' }}>
                        <PictureAsPdf sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }} />
                        <Typography variant="body2" color="text.secondary">
                          No payslips found for this employee
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : (
                  payslips?.map((payslip) => {
                    const period = payslip.payrollEntry?.payrollRun
                      ? `${MONTHS[payslip.payrollEntry.payrollRun.month - 1]} ${payslip.payrollEntry.payrollRun.year}`
                      : payslip.payrollEntry?.id
                        ? dayjs(payslip.createdAt).format('MMM YYYY')
                        : '-';
                    const emailed = !!payslip.emailedAt;
                    const emailColors = emailed ? EMAIL_STATUS_COLORS.sent : EMAIL_STATUS_COLORS.not_sent;
                    const netPay = payslip.payrollEntry?.netSalary;

                    return (
                      <TableRow
                        key={payslip.id}
                        hover
                        sx={{
                          '&:last-child td': { border: 0 },
                          transition: 'background 0.15s ease',
                        }}
                      >
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
                          <Typography
                            variant="body2"
                            fontWeight={600}
                            sx={{
                              fontVariantNumeric: 'tabular-nums',
                              color: (theme) => alpha(theme.palette.success.main, 0.85),
                            }}
                          >
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
                            icon={
                              emailed
                                ? <CheckCircle sx={{ fontSize: 14 }} />
                                : <Cancel sx={{ fontSize: 14 }} />
                            }
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <Tooltip title="Download PDF">
                              <IconButton
                                size="small"
                                onClick={() => handleDownload(payslip.id)}
                                sx={{
                                  color: 'text.secondary',
                                  '&:hover': {
                                    color: theme.palette.primary.main,
                                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                                  },
                                }}
                              >
                                <Download fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Email Payslip">
                              <IconButton
                                size="small"
                                onClick={() => emailMutation.mutate(payslip.id)}
                                disabled={emailMutation.isPending}
                                sx={{
                                  color: emailed ? '#059669' : 'text.secondary',
                                  '&:hover': {
                                    color: '#059669',
                                    bgcolor: alpha('#059669', 0.08),
                                  },
                                }}
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
