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
  {
    text: 'Employees', icon: <PeopleIcon />,
    children: [
      { text: 'All Employees', icon: <PeopleIcon />, path: '/employees' },
      { text: 'Import', icon: <ImportIcon />, path: '/employees/import' },
    ],
  },
  { text: 'Departments', icon: <BusinessIcon />, path: '/departments' },
  { text: 'Loans', icon: <LoanIcon />, path: '/loans' },
  {
    text: 'Payroll', icon: <AttachMoney />,
    children: [
      { text: 'Payroll Runs', icon: <PayrollIcon />, path: '/payroll-runs' },
      { text: 'Payroll Import', icon: <ImportIcon />, path: '/payroll-import' },
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
  const [menuOpen, setMenuOpen] = useState({});

  const isActive = (path) => location.pathname === path ||
    (path && location.pathname.startsWith(path));

  const handleClick = (item) => {
    if (item.children) {
      setMenuOpen((prev) => ({ ...prev, [item.text]: !prev[item.text] }));
    } else if (item.path) {
      navigate(item.path);
      if (isMobile) onToggle();
    }
  };

  const drawerWidth = 260;
  const collapsedWidth = 64;

  const drawerContent = (      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#0D47A1', color: 'white' }}>
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: open ? 2 : 1, py: 2, minHeight: 64,
      }}>
        {open && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              component="img"
              src="/MSL.png"
              alt="MESL"
              sx={{ height: 32 }}
            />
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.2, color: 'white' }}>
                Musunga Engineering
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.2 }}>
                Payroll
              </Typography>
            </Box>
          </Box>
        )}
        <IconButton onClick={onToggle} size="small" sx={{ color: 'white' }}>
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
                  selected={menuItems.some(m =>
                    m.text === item.text && m.children?.some(c => isActive(c.path))
                  )}
                  sx={{
                    borderRadius: 2, mb: 0.5,
                    justifyContent: open ? 'initial' : 'center',
                    px: open ? 2 : 1,
                    color: 'white',
                    '&.Mui-selected': { bgcolor: 'rgba(255,255,255,0.15)' },
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                    '& .MuiListItemIcon-root': { color: 'white' },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: open ? 40 : 0, justifyContent: 'center', color: 'white' }}>
                    {item.icon}
                  </ListItemIcon>
                  {open && <ListItemText primary={item.text} sx={{ '& .MuiListItemText-primary': { color: 'white' } }} />}
                  {open && (menuOpen[item.text] ? <ExpandLess sx={{ color: 'white' }} /> : <ExpandMore sx={{ color: 'white' }} />)}
                </ListItemButton>
                <Collapse in={menuOpen[item.text] && open}>
                  <List sx={{ pl: 2 }}>
                    {item.children.map((child) => (
                      <ListItemButton
                        key={child.text}
                        onClick={() => handleClick(child)}
                        selected={isActive(child.path)}
                        sx={{
                          borderRadius: 2, mb: 0.5,
                          color: 'white',
                          '&.Mui-selected': { bgcolor: '#FF6F00' },
                          '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                          '& .MuiListItemIcon-root': { color: 'white' },
                          '& .MuiListItemText-primary': { color: 'white' },
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 40, color: 'white' }}>{child.icon}</ListItemIcon>
                        <ListItemText primary={child.text} sx={{ '& .MuiListItemText-primary': { color: 'white' } }} />
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
                color: 'white',
                '&.Mui-selected': {
                  bgcolor: '#FF6F00',
                  color: 'white',
                  '&:hover': { bgcolor: '#C43E00' },
                  '& .MuiListItemIcon-root': { color: 'white' },
                  '& .MuiListItemText-primary': { color: 'white' },
                },
                '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                '& .MuiListItemIcon-root': { color: 'white' },
                '& .MuiListItemText-primary': { color: 'white' },
              }}
            >
              <ListItemIcon sx={{ minWidth: open ? 40 : 0, justifyContent: 'center', color: 'white' }}>
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
