import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  Collapse, IconButton, useMediaQuery, useTheme, Box, Typography,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Business as BusinessIcon,
  AccountBalance as LoanIcon,
  Receipt as PayrollIcon,
  FileUpload as ImportIcon,
  Description as PayslipIcon,
  ReceiptLong as ExpenseIcon,
  Settings as SettingsIcon,
  Group as UsersIcon,
  Assessment as ReportsIcon,
  History as AuditIcon,
  ChevronLeft, ChevronRight, ExpandLess, ExpandMore,
  AttachMoney,
} from '@mui/icons-material';

const menuItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
  { text: 'Employees', icon: <PeopleIcon />, path: '/employees' },
  { text: 'Departments', icon: <BusinessIcon />, path: '/departments' },
  { text: 'Loans', icon: <LoanIcon />, path: '/loans' },
  {
    text: 'Payroll', icon: <AttachMoney />,
    children: [
      { text: 'Payroll Runs', icon: <PayrollIcon />, path: '/payroll-runs' },
      { text: 'Import', icon: <ImportIcon />, path: '/payroll-import' },
      { text: 'Payslips', icon: <PayslipIcon />, path: '/payslips' },
    ],
  },
  { text: 'Expenses', icon: <ExpenseIcon />, path: '/expenses' },
  { text: 'Reports', icon: <ReportsIcon />, path: '/reports' },
  { text: 'Users', icon: <UsersIcon />, path: '/users' },
  { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
  { text: 'Audit Logs', icon: <AuditIcon />, path: '/audit-logs' },
];

export default function Sidebar({ open, onToggle, role }) {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [payrollOpen, setPayrollOpen] = useState(false);

  const isActive = (path) => location.pathname === path ||
    (path && location.pathname.startsWith(path));

  const handleClick = (item) => {
    if (item.children) {
      setPayrollOpen(!payrollOpen);
    } else if (item.path) {
      navigate(item.path);
      if (isMobile) onToggle();
    }
  };

  const drawerWidth = 260;
  const collapsedWidth = 64;

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: open ? 2 : 1, py: 2, minHeight: 64,
      }}>
        {open && (
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
            Payroll
          </Typography>
        )}
        <IconButton onClick={onToggle} size="small">
          {open ? <ChevronLeft /> : <ChevronRight />}
        </IconButton>
      </Box>

      <List sx={{ flex: 1, px: open ? 1 : 0.5 }}>
        {menuItems.map((item) => {
          if (item.text === 'Users' && role !== 'ADMIN') return null;
          if (item.text === 'Audit Logs' && role !== 'ADMIN') return null;
          if (item.text === 'Settings' && role !== 'ADMIN') return null;

          if (item.children) {
            return (
              <Box key={item.text}>
                <ListItemButton
                  onClick={() => handleClick(item)}
                  selected={isActive('/payroll')}
                  sx={{ borderRadius: 2, mb: 0.5, justifyContent: open ? 'initial' : 'center', px: open ? 2 : 1 }}
                >
                  <ListItemIcon sx={{ minWidth: open ? 40 : 0, justifyContent: 'center' }}>
                    {item.icon}
                  </ListItemIcon>
                  {open && <ListItemText primary={item.text} />}
                  {open && (payrollOpen ? <ExpandLess /> : <ExpandMore />)}
                </ListItemButton>
                <Collapse in={payrollOpen && open}>
                  <List sx={{ pl: 2 }}>
                    {item.children.map((child) => (
                      <ListItemButton
                        key={child.text}
                        onClick={() => handleClick(child)}
                        selected={isActive(child.path)}
                        sx={{ borderRadius: 2, mb: 0.5 }}
                      >
                        <ListItemIcon sx={{ minWidth: 40 }}>{child.icon}</ListItemIcon>
                        <ListItemText primary={child.text} />
                      </ListItemButton>
                    ))}
                  </List>
                </Collapse>
              </Box>
            );
          }

          return (
            <ListItemButton
              key={item.text}
              onClick={() => handleClick(item)}
              selected={isActive(item.path)}
              sx={{
                borderRadius: 2, mb: 0.5,
                justifyContent: open ? 'initial' : 'center',
                px: open ? 2 : 1,
                '&.Mui-selected': {
                  backgroundColor: 'primary.main',
                  color: 'white',
                  '&:hover': { backgroundColor: 'primary.dark' },
                  '& .MuiListItemIcon-root': { color: 'white' },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: open ? 40 : 0, justifyContent: 'center' }}>
                {item.icon}
              </ListItemIcon>
              {open && <ListItemText primary={item.text} />}
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );

  return (
    <Drawer
      variant={isMobile ? 'temporary' : 'permanent'}
      open={isMobile ? open : true}
      onClose={onToggle}
      sx={{
        width: open ? drawerWidth : collapsedWidth,
        flexShrink: 0,
        transition: 'width 0.2s',
        '& .MuiDrawer-paper': {
          width: open ? drawerWidth : collapsedWidth,
          transition: 'width 0.2s',
          overflowX: 'hidden',
          borderRight: '1px solid',
          borderColor: 'divider',
        },
      }}
    >
      {drawerContent}
    </Drawer>
  );
}
