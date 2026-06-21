import { createTheme } from '@mui/material/styles';

const getTheme = (mode) => createTheme({
  palette: {
    mode,
    primary: {
      main: '#1a56db',
      light: '#3b82f6',
      dark: '#1e40af',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#7c3aed',
      light: '#a78bfa',
      dark: '#5b21b6',
    },
    success: {
      main: '#059669',
      light: '#34d399',
      dark: '#047857',
    },
    warning: {
      main: '#d97706',
      light: '#fbbf24',
      dark: '#b45309',
    },
    error: {
      main: '#dc2626',
      light: '#f87171',
      dark: '#b91c1c',
    },
    background: mode === 'dark' ? {
      default: '#0f172a',
      paper: '#1e293b',
    } : {
      default: '#f1f5f9',
      paper: '#ffffff',
    },
    text: mode === 'dark' ? {
      primary: '#f1f5f9',
      secondary: '#94a3b8',
    } : {
      primary: '#1e293b',
      secondary: '#64748b',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 700,
      fontSize: '1.75rem',
    },
    h5: {
      fontWeight: 600,
      fontSize: '1.25rem',
    },
    h6: {
      fontWeight: 600,
      fontSize: '1rem',
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 8,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: mode === 'dark'
            ? '0 1px 3px 0 rgba(0,0,0,0.3)'
            : '0 1px 3px 0 rgba(0,0,0,0.06)',
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        size: 'small',
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            fontWeight: 600,
            backgroundColor: mode === 'dark' ? '#1e293b' : '#f8fafc',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
        },
      },
    },
  },
});

export default getTheme;
