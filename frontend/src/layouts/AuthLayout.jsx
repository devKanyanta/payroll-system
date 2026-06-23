import { Outlet } from 'react-router-dom';
import { Box, Paper, Typography, useTheme } from '@mui/material';

export default function AuthLayout() {
  const theme = useTheme();

  return (
    <Box sx={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      bgcolor: theme.palette.background.default,
      p: 2,
    }}>
      <Paper elevation={0} sx={{
        p: 4, maxWidth: 440, width: '100%',
        borderRadius: 3,
        border: 1, borderColor: 'divider',
      }}>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Box
            component="img"
            src="/MSL.png"
            alt="MESL Logo"
            sx={{ height: 64, mb: 1.5 }}
          />
          <Typography variant="h5" fontWeight={700} color="primary.main">
            Musunga Engineering Payroll
          </Typography>
          <Typography color="text.secondary" variant="body2">
            Musunga Engineering Services Limited
          </Typography>
        </Box>
        <Outlet />
      </Paper>
    </Box>
  );
}
