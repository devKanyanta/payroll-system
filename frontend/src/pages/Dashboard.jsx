import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import {
  Box, Grid, Card, CardContent, Typography, Skeleton,
  LinearProgress, Chip, Avatar, Stack, Button, Divider,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  alpha, useTheme,
} from '@mui/material';
import {
  People, AttachMoney, PendingActions, Business,
  AccountBalance, Receipt, TrendingUp,
  GroupAdd, CalendarMonth, Description, TrackChanges,
  MoreHoriz, Assessment, MoneyOff,
} from '@mui/icons-material';
import { dashboardService } from '../services/dashboardService';
import { useAuth } from '../contexts/AuthContext';

// ─── Stat Card Configuration ───

const statCards = () => [
  {
    label: 'Total Employees',
    key: 'totalEmployees',
    icon: <People />,
    gradient: 'linear-gradient(135deg, #0D47A1 0%, #1565C0 100%)',
    format: 'number',
    subtitle: 'Active: {activeEmployees}',
    link: '/employees',
  },
  {
    label: 'Active Employees',
    key: 'activeEmployees',
    icon: <Business />,
    gradient: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
    format: 'number',
    subtitle: '{inactiveEmployees} inactive',
    link: '/employees',
  },
  {
    label: 'Monthly Payroll',
    key: 'monthlyPayrollTotal',
    icon: <AttachMoney />,
    gradient: 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)',
    format: 'currency',
    subtitle: 'Net pay this period',
    link: '/payroll-runs',
  },
  {
    label: 'Pending Approvals',
    key: 'totalPending',
    icon: <PendingActions />,
    gradient: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
    format: 'number',
    subtitle: '{pendingPayrolls} payroll · {pendingPpeRequests} PPE · {pendingExpenses} expenses',
    link: '/pending-approvals',
  },
  {
    label: 'Active Loans',
    key: 'activeLoansTotal',
    icon: <AccountBalance />,
    gradient: 'linear-gradient(135deg, #dc2626 0%, #f87171 100%)',
    format: 'currency',
    subtitle: '{activeLoans} active loans',
    link: '/loans',
  },
  {
    label: 'Departments',
    key: 'totalDepartments',
    icon: <Receipt />,
    gradient: 'linear-gradient(135deg, #0891b2 0%, #22d3ee 100%)',
    format: 'number',
    subtitle: 'Company divisions',
    link: '/departments',
  },
];

// ─── Quick Actions ───

const quickActions = [
  { label: 'New Employee', icon: <GroupAdd />, path: '/employees', color: '#0D47A1' },
  { label: 'Run Payroll', icon: <Description />, path: '/payroll-runs', color: '#059669' },
  { label: 'New Loan', icon: <AccountBalance />, path: '/loans', color: '#dc2626' },
  { label: 'Import Data', icon: <TrackChanges />, path: '/employee-import', color: '#7c3aed' },
];

// ─── Helpers ───

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-ZM', {
    style: 'currency', currency: 'ZMW', minimumFractionDigits: 0,
  }).format(value || 0);

const formatNumber = (value) => (value ?? 0).toLocaleString();

function formatTimestamp(ts) {
  if (!ts) return '';
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHrs / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}


// ─── Skeleton Card ───

function StatCardSkeleton() {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 3 }}>
        <Skeleton width="60%" height={20} sx={{ mb: 1 }} />
        <Skeleton width="80%" height={40} />
        <Skeleton width="40%" height={16} sx={{ mt: 1 }} />
      </CardContent>
    </Card>
  );
}

// ─── Animated Stat Card ───

function StatCard({ card, value, stats, isLoading, theme }) {
  const navigate = useNavigate();

  const displayValue = card.format === 'currency'
    ? formatCurrency(value)
    : formatNumber(value);

  const subtitle = card.subtitle
    ? card.subtitle.replace(/\{(\w+)\}/g, (_, key) => formatNumber(stats?.[key]))
    : '';

  return (
    <Card
      onClick={() => navigate(card.link)}
      sx={{
        height: '100%',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: theme.shadows[12],
          '& .stat-icon-bg': {
            transform: 'scale(1.15) rotate(5deg)',
          },
          '& .stat-value': {
            transform: 'scale(1.02)',
          },
        },
      }}
    >
      <CardContent sx={{ p: 3, position: 'relative', zIndex: 1 }}>
        {/* Decorative icon background */}
        <Box
          className="stat-icon-bg"
          sx={{
            position: 'absolute',
            right: -12,
            bottom: -12,
            opacity: 0.06,
            transform: 'scale(1)',
            transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            '& > svg': {
              fontSize: 120,
            },
          }}
        >
          {card.icon}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: alpha(card.gradient.includes('0D47A1') ? '#0D47A1' :
                  card.gradient.includes('059669') ? '#059669' :
                  card.gradient.includes('7c3aed') ? '#7c3aed' :
                  card.gradient.includes('d97706') ? '#d97706' :
                  card.gradient.includes('dc2626') ? '#dc2626' : '#0891b2', 0.8),
              }}
            >
              {card.label}
            </Typography>
            {isLoading ? (
              <Skeleton width={140} height={40} sx={{ my: 0.5 }} />
            ) : (
              <Typography
                className="stat-value"
                variant="h4"
                fontWeight={800}
                sx={{
                  mt: 0.5,
                  transition: 'transform 0.3s ease',
                  background: card.gradient,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                {displayValue}
              </Typography>
            )}
            {!isLoading && subtitle && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box
            sx={{
              p: 1.5,
              borderRadius: 2.5,
              background: card.gradient,
              color: '#fff',
              display: 'flex',
              boxShadow: `0 4px 14px ${alpha(
                card.gradient.includes('0D47A1') ? '#0D47A1' :
                  card.gradient.includes('059669') ? '#059669' :
                  card.gradient.includes('7c3aed') ? '#7c3aed' :
                  card.gradient.includes('d97706') ? '#d97706' :
                  card.gradient.includes('dc2626') ? '#dc2626' : '#0891b2',
                0.3
              )}`,
              transition: 'transform 0.3s ease',
              '&:hover': { transform: 'scale(1.1)' },
            }}
          >
            {card.icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

// ─── Payroll Summary Card ───

function PayrollSummary({ summary, isLoading }) {
  if (isLoading) {
    return (
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Skeleton width="40%" height={28} sx={{ mb: 2 }} />
          <Stack spacing={1.5}>
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} height={40} />
            ))}
          </Stack>
        </CardContent>
      </Card>
    );
  }

  if (!summary || !summary.grossSalary) {
    return (
      <Card>
        <CardContent sx={{ p: 3, textAlign: 'center', py: 5 }}>
          <CalendarMonth sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No Payroll This Month
          </Typography>
          <Typography variant="body2" color="text.disabled">
            Run a payroll to see the financial summary here.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const gross = summary.grossSalary;
  const paye = summary.paye;
  const napsa = summary.napsa;
  const nhima = summary.nhima;
  const totalDed = summary.totalDeductions;
  const net = summary.netSalary;

  const items = [
    { label: 'Gross Salary', value: gross, color: '#0D47A1', percent: 100 },
    { label: 'PAYE Tax', value: paye, color: '#dc2626', percent: gross > 0 ? (paye / gross) * 100 : 0, isDeduction: true },
    { label: 'NAPSA', value: napsa, color: '#d97706', percent: gross > 0 ? (napsa / gross) * 100 : 0, isDeduction: true },
    { label: 'NHIMA', value: nhima, color: '#7c3aed', percent: gross > 0 ? (nhima / gross) * 100 : 0, isDeduction: true },
  ];

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
          <Typography variant="h6" fontWeight={700}>Payroll Summary</Typography>
          <Chip
            icon={<AttachMoney />}
            label="Current Month"
            size="small"
            color="primary"
            variant="outlined"
          />
        </Box>

        <Stack spacing={2}>
          {items.map((item) => (
            <Box key={item.label}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="body2" color="text.secondary">
                  {item.label}
                </Typography>
                <Typography
                  variant="body2"
                  fontWeight={600}
                  color={item.isDeduction ? 'error.main' : 'text.primary'}
                >
                  {item.isDeduction ? '- ' : ''}{formatCurrency(item.value)}
                </Typography>
              </Box>
              {item.percent > 0 && (
                <LinearProgress
                  variant="determinate"
                  value={Math.min(item.percent, 100)}
                  sx={{
                    height: 6,
                    borderRadius: 3,
                    bgcolor: alpha(item.color, 0.12),
                    '& .MuiLinearProgress-bar': {
                      bgcolor: item.color,
                      borderRadius: 3,
                    },
                  }}
                />
              )}
            </Box>
          ))}
        </Stack>

        <Divider sx={{ my: 2 }} />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="body2" color="text.secondary">Total Deductions</Typography>
            <Typography variant="body1" fontWeight={700} color="error.main">
              {formatCurrency(totalDed)}
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="body2" color="text.secondary">Net Pay</Typography>
            <Typography variant="h5" fontWeight={800} color="success.main">
              {formatCurrency(net)}
            </Typography>
          </Box>
        </Box>

        {gross > 0 && (
          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <TrendingUp fontSize="small" color="success" />
            <Typography variant="caption" color="text.secondary">
              Net is {((net / gross) * 100).toFixed(1)}% of gross
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Department Distribution ───

function DepartmentDistribution({ departments, isLoading }) {
  if (isLoading) {
    return (
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Skeleton width="50%" height={28} sx={{ mb: 2 }} />
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} height={36} sx={{ mb: 1 }} />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!departments || departments.length === 0) {
    return (
      <Card>
        <CardContent sx={{ p: 3, textAlign: 'center', py: 5 }}>
          <Business sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
          <Typography variant="body2" color="text.disabled">
            No departments configured
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const total = departments.reduce((sum, d) => sum + Number(d.count), 0);
  const colors = ['#0D47A1', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#FF6F00', '#002171'];

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Employees by Department</Typography>

        <Stack spacing={1.5}>
          {departments.map((dept, i) => {
            const pct = total > 0 ? (Number(dept.count) / total) * 100 : 0;
            const color = colors[i % colors.length];
            return (
              <Box key={dept.name}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
                  <Typography variant="body2" fontWeight={500}>{dept.name}</Typography>
                  <Typography variant="body2" fontWeight={600} color="text.secondary">
                    {formatNumber(dept.count)}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={pct}
                  sx={{
                    height: 8,
                    borderRadius: 4,
                    bgcolor: alpha(color, 0.12),
                    '& .MuiLinearProgress-bar': {
                      bgcolor: color,
                      borderRadius: 4,
                      transition: 'width 1s ease-in-out',
                    },
                  }}
                />
              </Box>
            );
          })}
        </Stack>

        <Divider sx={{ my: 1.5 }} />

        <Typography variant="caption" color="text.secondary">
          Total: <strong>{formatNumber(total)}</strong> active employees across {departments.length} department{departments.length !== 1 ? 's' : ''}
        </Typography>
      </CardContent>
    </Card>
  );
}

// ─── Recent Activity ───

function RecentActivity({ activities, isLoading, theme }) {
  if (isLoading) {
    return (
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Skeleton width="40%" height={28} sx={{ mb: 2 }} />
          {[...Array(5)].map((_, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 2, mb: 1.5 }}>
              <Skeleton variant="circular" width={36} height={36} />
              <Box sx={{ flex: 1 }}>
                <Skeleton width="70%" height={16} />
                <Skeleton width="40%" height={14} />
              </Box>
            </Box>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <Card>
        <CardContent sx={{ p: 3, textAlign: 'center', py: 5 }}>
          <MoreHoriz sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
          <Typography variant="body2" color="text.disabled">
            No recent activity
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" fontWeight={700}>Recent Activity</Typography>
          <Chip label="Live" size="small" color="success" sx={{ fontWeight: 600 }} />
        </Box>

        <Stack spacing={0} divider={<Divider />}>
          {activities.slice(0, 8).map((activity, i) => (
            <Box
              key={i}
              sx={{
                display: 'flex',
                gap: 1.5,
                py: 1.5,
                px: 1,
                borderRadius: 1.5,
                transition: 'background 0.2s',
                '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) },
              }}
            >
              <Avatar
                sx={{
                  width: 34,
                  height: 34,
                  fontSize: 16,
                  bgcolor: alpha(
                    activity.action?.toLowerCase().includes('create') ? '#059669' :
                      activity.action?.toLowerCase().includes('delete') ? '#dc2626' :
                      activity.action?.toLowerCase().includes('approve') ? '#0D47A1' :
                      '#7c3aed',
                    0.15
                  ),
                  color: activity.action?.toLowerCase().includes('create') ? '#059669' :
                    activity.action?.toLowerCase().includes('delete') ? '#dc2626' :
                    activity.action?.toLowerCase().includes('approve') ? '#0D47A1' :
                    '#7c3aed',
                }}
              >
                {activity.user?.charAt(0) || 'S'}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={500} noWrap>
                  <Box component="span" fontWeight={700}>{activity.user}</Box>
                  {' '}{activity.action?.toLowerCase()}{' '}
                  <Box component="span" color="text.secondary">{activity.entity?.toLowerCase()}</Box>
                </Typography>
                <Typography variant="caption" color="text.disabled">
                  {formatTimestamp(activity.timestamp)}
                </Typography>
              </Box>
            </Box>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}

// ─── Quick Actions ───

function QuickActionsSection() {
  const navigate = useNavigate();

  return (
    <Card>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Quick Actions</Typography>
        <Grid container spacing={1.5}>
          {quickActions.map((action) => (
            <Grid item xs={6} sm={3} key={action.label}>
              <Button
                variant="outlined"
                fullWidth
                startIcon={action.icon}
                onClick={() => navigate(action.path)}
                sx={{
                  py: 1.5,
                  justifyContent: 'flex-start',
                  borderColor: alpha(action.color, 0.3),
                  color: action.color,
                  '&:hover': {
                    borderColor: action.color,
                    bgcolor: alpha(action.color, 0.06),
                    transform: 'translateY(-1px)',
                    boxShadow: `0 4px 12px ${alpha(action.color, 0.15)}`,
                  },
                  transition: 'all 0.2s ease',
                }}
              >
                {action.label}
              </Button>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );
}

// ─── Company Cashflow Section (Admin Only) ───

function CompanyCashflow({ cashflow, isLoading }) {
  const theme = useTheme();

  if (isLoading) {
    return (
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Skeleton width="40%" height={28} sx={{ mb: 2 }} />
          <Stack spacing={1.5}>
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} height={40} />
            ))}
          </Stack>
        </CardContent>
      </Card>
    );
  }

  if (!cashflow || !cashflow.sites || cashflow.sites.every(s => s.subTotal === 0)) {
    return (
      <Card>
        <CardContent sx={{ p: 3, textAlign: 'center', py: 5 }}>
          <Assessment sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No Cashflow Data
          </Typography>
          <Typography variant="body2" color="text.disabled" sx={{ mb: 2 }}>
            Enter revenue data in Cashflow Management to see the company financial summary here.
          </Typography>
          <Button
            variant="outlined"
            component={Link}
            to="/cashflow"
            startIcon={<Assessment />}
          >
            Manage Cashflow
          </Button>
        </CardContent>
      </Card>
    );
  }

  const profit = cashflow.companyProfit;
  const profitColor = profit >= 0 ? '#059669' : '#dc2626';

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" fontWeight={700}>Company Cashflow</Typography>
          <Button
            size="small"
            component={Link}
            to="/cashflow"
            endIcon={<Assessment />}
            sx={{ textTransform: 'none' }}
          >
            Manage
          </Button>
        </Box>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', color: 'text.secondary' }}>Site</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.75rem', color: 'text.secondary' }}>Sub Total</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.75rem', color: 'text.secondary' }}>Total</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {cashflow.sites.map((site) => (
                <TableRow key={site.site}>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>{site.site}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrency(site.subTotal)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={600} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrency(site.total)}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Divider sx={{ my: 1.5 }} />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="body2" fontWeight={600}>Total Monthly Revenue</Typography>
          <Typography variant="body2" fontWeight={700} color="primary.main">
            {formatCurrency(cashflow.totalSubMonthlyAccumulated)}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="body2" color="text.secondary">Employee Gross Pay</Typography>
          <Typography variant="body2" fontWeight={500} color="warning.main">
            {formatCurrency(cashflow.employeeGrossPay)}
          </Typography>
        </Box>
        <Divider sx={{ my: 1 }} />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body1" fontWeight={800}>Company Profit</Typography>
          <Typography variant="h6" fontWeight={800} color={profitColor}>
            {formatCurrency(profit)}
          </Typography>
        </Box>

        {profit > 0 && (
          <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <TrendingUp fontSize="small" color="success" />
            <Typography variant="caption" color="text.secondary">
              Profit margin: {((profit / cashflow.totalSubMonthlyAccumulated) * 100).toFixed(1)}%
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Dashboard Component ───

export default function Dashboard() {
  const theme = useTheme();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await dashboardService.getStats();
      return res.data;
    },
    refetchInterval: 60000,
  });

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Overview of Musunga Engineering Payroll System
          </Typography>
        </Box>
        <Chip
          icon={<CalendarMonth />}
          label={new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          variant="outlined"
          color="primary"
          sx={{ fontWeight: 500 }}
        />
      </Box>

      {/* Stat Cards */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {statCards().map((card) => (
          <Grid item xs={12} sm={6} md={4} lg={2} key={card.key}>
            {isLoading ? (
              <StatCardSkeleton />
            ) : (
              <StatCard
                card={card}
                value={stats?.[card.key]}
                stats={stats}
                isLoading={isLoading}
                theme={theme}
              />
            )}
          </Grid>
        ))}
      </Grid>

      {/* Payroll Summary + Cashflow (Admin) / Department Distribution */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} md={isAdmin ? 6 : 6}>
          <PayrollSummary
            summary={stats?.payrollSummary}
            isLoading={isLoading}
          />
        </Grid>
        <Grid item xs={12} md={isAdmin ? 6 : 6}>
          {isAdmin ? (
            <CompanyCashflow
              cashflow={stats?.cashflow}
              isLoading={isLoading}
            />
          ) : (
            <DepartmentDistribution
              departments={stats?.employeeByDepartment}
              isLoading={isLoading}
            />
          )}
        </Grid>
      </Grid>

      {/* Department Distribution (non-admin) or both layout */}
      {isAdmin && (
        <Grid container spacing={2.5} sx={{ mb: 3 }}>
          <Grid item xs={12} md={6}>
            <DepartmentDistribution
              departments={stats?.employeeByDepartment}
              isLoading={isLoading}
            />
          </Grid>
        </Grid>
      )}

      {/* Quick Actions + Recent Activity */}
      <Grid container spacing={2.5}>
        <Grid item xs={12} md={5}>
          <QuickActionsSection />
        </Grid>
        <Grid item xs={12} md={7}>
          <RecentActivity
            activities={stats?.recentActivity}
            isLoading={isLoading}
            theme={theme}
          />
        </Grid>
      </Grid>
    </Box>
  );
}
