import { useState } from 'react';
import SessionExpiryModal from '../components/SessionExpiryModal';
import { Outlet } from 'react-router-dom';
import {
  Box, AppBar, Toolbar, Typography, IconButton, Badge,
  Menu, MenuItem, Avatar, Divider, ListItemIcon, Tooltip,
} from '@mui/material';
import {
  Menu as MenuIcon, LightMode, DarkMode, Notifications as NotificationsIcon,
  Logout, Person, Lock, AccountCircle,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useThemeMode } from '../contexts/ThemeContext';
import Sidebar from './Sidebar';
import NotificationBell from '../components/NotificationBell';

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [anchorEl, setAnchorEl] = useState(null);
  const { user, logout } = useAuth();
  const { mode, toggleTheme } = useThemeMode();
  const navigate = useNavigate();

  const handleLogout = async () => {
    setAnchorEl(null);
    await logout();
    navigate('/login');
  };

  const roleLabel = user?.role === 'ADMIN' ? 'Admin'
    : user?.role === 'HR' ? 'HR'
    : 'Manager';

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        role={user?.role}
      />
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <AppBar
          position="sticky"
          color="inherit"
          elevation={0}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Toolbar>
            <IconButton
              edge="start"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              sx={{ mr: 1 }}
            >
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" sx={{ flex: 1, fontWeight: 600, color: 'primary.main' }}>
              Musunga Engineering Payroll
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Tooltip title={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}>
                <IconButton onClick={toggleTheme} size="small">
                  {mode === 'light' ? <DarkMode /> : <LightMode />}
                </IconButton>
              </Tooltip>

              <NotificationBell />

              <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} size="small">
                <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: 14 }}>
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </Avatar>
              </IconButton>
            </Box>

            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={() => setAnchorEl(null)}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
              <MenuItem disabled>
                <Typography variant="body2" color="text.secondary">
                  {user?.firstName} {user?.lastName}
                </Typography>
              </MenuItem>
              <MenuItem disabled>
                <Typography variant="caption" color="text.secondary">
                  {user?.email} · {roleLabel}
                </Typography>
              </MenuItem>
              <Divider />
              <MenuItem onClick={() => { setAnchorEl(null); navigate('/change-password'); }}>
                <ListItemIcon><Lock fontSize="small" /></ListItemIcon>
                Change Password
              </MenuItem>
              <MenuItem onClick={handleLogout}>
                <ListItemIcon><Logout fontSize="small" /></ListItemIcon>
                Logout
              </MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>
        <Box sx={{ flex: 1, p: 3, overflow: 'auto' }}>
          <Outlet />
        </Box>
      </Box>
      <SessionExpiryModal />
    </Box>
  );
}
