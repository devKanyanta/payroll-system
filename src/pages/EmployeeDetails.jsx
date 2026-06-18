import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Typography, Card, CardContent, Grid, Chip, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Divider, Paper,
} from '@mui/material';
import { ArrowBack, AccountBalance, Badge, CalendarMonth, Email, Phone, LocationOn } from '@mui/icons-material';
import { employeeService } from '../services/employeeService';
import { loanService } from '../services/loanService';
import { reportService } from '../services/reportService';
import LoadingScreen from '../components/LoadingScreen';
import dayjs from 'dayjs';

const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function EmployeeDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: employee, isLoading } = useQuery({
    queryKey: ['employee', id],
    queryFn: async () => { const res = await employeeService.getById(id); return res.data; },
  });

  const { data: loans = [] } = useQuery({
    queryKey: ['loans', id],
    queryFn: async () => { const res = await loanService.getByEmployee(id); return res.data; },
    enabled: !!id,
  });

  const { data: payrollHistory = [] } = useQuery({
    queryKey: ['employee-history', id],
    queryFn: async () => { const res = await reportService.getEmployeeHistory(id); return res.data; },
    enabled: !!id,
  });

  if (isLoading) return <LoadingScreen />;
  if (!employee) return <Typography>Employee not found</Typography>;

  const activeLoansTotal = loans
    .filter((l) => l.status === 'ACTIVE')
    .reduce((sum, l) => sum + (l.balance || 0), 0);
  const activeMonthlyDeductions = loans
    .filter((l) => l.status === 'ACTIVE')
    .reduce((sum, l) => sum + (l.monthlyDeduction || 0), 0);

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => navigate('/employees')} sx={{ mb: 2 }}>
        Back to Employees
      </Button>

      <Grid container spacing={3}>
        {/* Left Column - Employee Info Card (mirrors PAYSLIP template) */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent sx={{ p: 0 }}>
              {/* Header with avatar + key info */}
              <Box sx={{
                background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})`,
                color: 'white', p: 3, textAlign: 'center', borderTopLeftRadius: 4, borderTopRightRadius: 4,
              }}>
                <Box sx={{
                  width: 80, height: 80, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.2)',
                  color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 32, fontWeight: 700, mx: 'auto', mb: 1.5, border: '3px solid rgba(255,255,255,0.4)',
                }}>
                  {employee.firstName[0]}{employee.lastName[0]}
                </Box>
                <Typography variant="h6" fontWeight={700}>{employee.firstName} {employee.lastName}</Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>{employee.position || 'No Position'}</Typography>
                <Box sx={{ mt: 1 }}>
                  <Chip label={employee.employeeNumber} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', mr: 0.5 }} />
                  <Chip label={employee.status} size="small"
                    color={employee.status === 'ACTIVE' ? 'success' : 'warning'}
                    sx={{ color: 'white', borderColor: 'white' }} variant="outlined" />
                </Box>
              </Box>

              <Box sx={{ p: 3 }}>
                {/* Personal Info Section - like PAYSLIP template header */}
                <Typography variant="subtitle2" fontWeight={700} color="primary.main" sx={{ mb: 1.5, textTransform: 'uppercase', letterSpacing: 1 }}>
                  <Badge sx={{ mr: 0.5, verticalAlign: 'middle' }} fontSize="small" /> Employee Details
                </Typography>

                <Box sx={{ bgcolor: 'grey.50', borderRadius: 1, p: 2, mb: 2, border: '1px solid', borderColor: 'divider' }}>
                  <Grid container spacing={1.5}>
                    <Grid item xs={12}>
                      <DetailRow icon={<Badge fontSize="inherit" />} label="EMP NO" value={employee.employeeNumber} />
                    </Grid>
                    <Grid item xs={12}>
                      <DetailRow icon={<Badge fontSize="inherit" />} label="NRC" value={employee.nrc} />
                    </Grid>
                    <Grid item xs={12}>
                      <DetailRow icon={<CalendarMonth fontSize="inherit" />} label="Date Engaged" value={dayjs(employee.dateHired).format('DD/MM/YYYY')} />
                    </Grid>
                    <Grid item xs={6}>
                      <DetailRow label="Grade" value={employee.position || '-'} />
                    </Grid>
                    <Grid item xs={6}>
                      <DetailRow icon={<LocationOn fontSize="inherit" />} label="Mine Site" value={employee.site || '-'} />
                    </Grid>
                  </Grid>
                </Box>

                <Divider sx={{ my: 1.5 }} />

                <Typography variant="subtitle2" fontWeight={700} color="primary.main" sx={{ mb: 1.5, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Contact
                </Typography>
                <DetailRow icon={<Email fontSize="inherit" />} label="Email" value={employee.email} />
                <DetailRow icon={<Phone fontSize="inherit" />} label="Phone" value={employee.phone || '-'} />

                <Divider sx={{ my: 1.5 }} />

                <Typography variant="subtitle2" fontWeight={700} color="primary.main" sx={{ mb: 1.5, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Employment
                </Typography>
                <DetailRow label="Department" value={employee.departmentName || '-'} />
                <DetailRow label="Position / Grade" value={employee.position || '-'} />
                <DetailRow label="Site" value={employee.site || '-'} />
                <DetailRow label="Employment Type" value={employee.employmentType?.replace('_', ' ') || '-'} />
                <DetailRow label="Salary Type" value={employee.salaryType || '-'} />

                <Divider sx={{ my: 1.5 }} />

                <Typography variant="subtitle2" fontWeight={700} color="primary.main" sx={{ mb: 1.5, textTransform: 'uppercase', letterSpacing: 1 }}>
                  <AccountBalance sx={{ mr: 0.5, verticalAlign: 'middle' }} fontSize="small" /> Bank Details
                </Typography>
                <DetailRow label="Bank" value={employee.bankName || '-'} />
                <DetailRow label="Account" value={employee.accountNumber ? `****${employee.accountNumber.slice(-4)}` : '-'} />

                <Divider sx={{ my: 1.5 }} />

                <Box sx={{ bgcolor: 'primary.main', color: 'white', borderRadius: 1, p: 2, textAlign: 'center' }}>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>Basic Salary</Typography>
                  <Typography variant="h5" fontWeight={700}>ZMW {employee.basicSalary?.toLocaleString()}</Typography>
                </Box>

                {/* Active Loan Summary */}
                {activeLoansTotal > 0 && (
                  <Box sx={{ bgcolor: 'warning.light', borderRadius: 1, p: 2, textAlign: 'center', mt: 1 }}>
                    <Typography variant="caption" sx={{ opacity: 0.8 }}>Outstanding Loan Balance</Typography>
                    <Typography variant="h6" fontWeight={700} color="warning.dark">
                      ZMW {activeLoansTotal.toLocaleString()}
                    </Typography>
                    <Typography variant="caption" sx={{ opacity: 0.8 }}>
                      Monthly Deduction: ZMW {activeMonthlyDeductions.toLocaleString()}
                    </Typography>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Right Column - Payroll History & Loans */}
        <Grid item xs={12} md={8}>
          {/* Payroll History Card */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
                Payroll History
              </Typography>
              {payrollHistory.length === 0 ? (
                <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'grey.50' }}>
                  <Typography color="text.secondary">No payroll history yet</Typography>
                </Paper>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>Period</strong></TableCell>
                        <TableCell><strong>Status</strong></TableCell>
                        <TableCell align="right"><strong>Rate/Hr</strong></TableCell>
                        <TableCell align="right"><strong>Present Days</strong></TableCell>
                        <TableCell align="right"><strong>Gross</strong></TableCell>
                        <TableCell align="right"><strong>Deductions</strong></TableCell>
                        <TableCell align="right"><strong>Loan Ded</strong></TableCell>
                        <TableCell align="right"><strong>Net</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {payrollHistory.map((entry) => (
                        <TableRow key={entry.id} hover>
                          <TableCell>
                            {entry.payrollRun
                              ? `${months[entry.payrollRun.month - 1]} ${entry.payrollRun.year}`
                              : '-'}
                          </TableCell>
                          <TableCell>
                            <Chip label={entry.payrollRun?.status || '-'} size="small"
                              color={entry.payrollRun?.status === 'APPROVED' ? 'success'
                                : entry.payrollRun?.status === 'DRAFT' ? 'default'
                                : entry.payrollRun?.status === 'SUBMITTED' ? 'warning'
                                : 'error'} />
                          </TableCell>
                          <TableCell align="right">ZMW {entry.hourlyRate?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</TableCell>
                          <TableCell align="right">{entry.presentDays || 0}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>ZMW {entry.grossSalary?.toLocaleString()}</TableCell>
                          <TableCell align="right">ZMW {(entry.nhima + entry.napsa + entry.paye + (entry.loanDeduction || 0) + (entry.otherDeductions || 0)).toLocaleString()}</TableCell>
                          <TableCell align="right">ZMW {entry.loanDeduction?.toLocaleString() || 0}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, color: 'success.main' }}>ZMW {entry.netSalary?.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>

          {/* Loans Card */}
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" fontWeight={700}>
                  Loans ({loans.length})
                </Typography>
                <Button size="small" variant="outlined" onClick={() => navigate('/loans')}>
                  Manage Loans
                </Button>
              </Box>
              {loans.length === 0 ? (
                <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'grey.50' }}>
                  <Typography color="text.secondary">No loans</Typography>
                </Paper>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>Amount</strong></TableCell>
                        <TableCell><strong>Balance</strong></TableCell>
                        <TableCell><strong>Monthly Ded</strong></TableCell>
                        <TableCell><strong>Duration</strong></TableCell>
                        <TableCell><strong>Interest</strong></TableCell>
                        <TableCell><strong>Period</strong></TableCell>
                        <TableCell><strong>Status</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {loans.map((loan) => (
                        <TableRow key={loan.id} hover>
                          <TableCell sx={{ fontWeight: 600 }}>ZMW {loan.loanAmount?.toLocaleString()}</TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={loan.balance > 0 ? 700 : 400}
                              color={loan.balance > 0 ? 'warning.main' : 'success.main'}>
                              ZMW {loan.balance?.toLocaleString()}
                            </Typography>
                          </TableCell>
                          <TableCell>ZMW {loan.monthlyDeduction?.toLocaleString()}</TableCell>
                          <TableCell>{loan.durationMonths || 1} mo</TableCell>
                          <TableCell>{loan.interestRate}%</TableCell>
                          <TableCell>{dayjs(loan.startDate).format('MMM YYYY')} - {dayjs(loan.endDate).format('MMM YYYY')}</TableCell>
                          <TableCell>
                            <Chip label={loan.status} size="small"
                              color={loan.status === 'ACTIVE' ? 'primary'
                                : loan.status === 'COMPLETED' ? 'success'
                                : 'default'} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

function DetailRow({ icon, label, value }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.8 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 80 }}>
        {icon}{label}
      </Typography>
      <Typography variant="body2" fontWeight={600} sx={{ textAlign: 'right' }}>{value}</Typography>
    </Box>
  );
}
