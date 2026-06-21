import { useQuery } from '@tanstack/react-query';
import {
  Box, Grid, Card, CardContent, Typography, Skeleton,
} from '@mui/material';
import {
  People, AttachMoney, PendingActions, Business, AccountBalance, Receipt,
} from '@mui/icons-material';
import { dashboardService } from '../services/dashboardService';

const statCards = [
  { label: 'Total Employees', key: 'totalEmployees', icon: <People />, color: '#1a56db', format: 'number' },
  { label: 'Active Employees', key: 'activeEmployees', icon: <Business />, color: '#059669', format: 'number' },
  { label: 'Monthly Payroll', key: 'monthlyPayrollTotal', icon: <AttachMoney />, color: '#7c3aed', format: 'currency' },
  { label: 'Pending Approvals', key: 'pendingPayrolls', icon: <PendingActions />, color: '#d97706', format: 'number' },
  { label: 'Active Loans', key: 'activeLoansTotal', icon: <AccountBalance />, color: '#dc2626', format: 'currency' },
  { label: 'Departments', key: 'totalDepartments', icon: <Receipt />, color: '#0891b2', format: 'number' },
];

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await dashboardService.getStats();
      return res.data;
    },
    refetchInterval: 60000,
  });

  const formatValue = (value, format) => {
    if (format === 'currency') {
      return new Intl.NumberFormat('en-ZM', {
        style: 'currency', currency: 'ZMW', minimumFractionDigits: 0,
      }).format(value || 0);
    }
    return (value ?? 0).toLocaleString();
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 0.5 }}>Dashboard</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Overview of your payroll system
      </Typography>

      <Grid container spacing={3}>
        {statCards.map((card) => (
          <Grid item xs={12} sm={6} md={4} key={card.key}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {card.label}
                    </Typography>
                    {isLoading ? (
                      <Skeleton width={120} height={36} />
                    ) : (
                      <Typography variant="h4" fontWeight={700}>
                        {formatValue(stats?.[card.key], card.format)}
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{
                    p: 1.5, borderRadius: 2,
                    bgcolor: `${card.color}15`,
                    color: card.color,
                    display: 'flex',
                  }}>
                    {card.icon}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {stats?.recentActivity && stats.recentActivity.length > 0 && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>Recent Activity</Typography>
            {stats.recentActivity.map((activity, i) => (
              <Box key={i} sx={{
                py: 1.5, px: 2,
                borderBottom: i < stats.recentActivity.length - 1 ? 1 : 0,
                borderColor: 'divider',
              }}>
                <Typography variant="body2">{activity}</Typography>
              </Box>
            ))}
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
