import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, LinearProgress, Alert,
} from '@mui/material';
import { AccessTime } from '@mui/icons-material';
import { getMsUntilExpiry } from '../utils/jwt';
import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'https://api.mesltd.co.zm';
// const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// Show the warning when the token has less than this much time remaining
const WARNING_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutes
// Check expiry every 30 seconds
const CHECK_INTERVAL_MS = 30 * 1000;

export default function SessionExpiryModal() {
  const [remainingMs, setRemainingMs] = useState(null); // null = not monitoring / token ok
  const [extending, setExtending] = useState(false);
  const [extendError, setExtendError] = useState('');
  const intervalRef = useRef(null);
  const countdownRef = useRef(null);
  const warningShownRef = useRef(false);

  const checkSession = useCallback(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setRemainingMs(null);
      warningShownRef.current = false;
      return;
    }

    const msLeft = getMsUntilExpiry(token);

    if (msLeft <= 0) {
      // Token already expired — clear and let the 401 interceptor handle it
      setRemainingMs(null);
      warningShownRef.current = false;
      return;
    }

    // If warning is already shown, don't re-sync the countdown
    if (warningShownRef.current) return;

    if (msLeft < WARNING_THRESHOLD_MS) {
      setRemainingMs(msLeft);
      warningShownRef.current = true;
    } else {
      // Token is still fresh — no warning needed
      setRemainingMs(null);
    }
  }, []);

  // Countdown timer: update remainingMs every second while warning is shown
  useEffect(() => {
    if (remainingMs === null || remainingMs <= 0) {
      if (countdownRef.current) clearInterval(countdownRef.current);
      warningShownRef.current = false; // reset so next check can show the modal
      return;
    }

    countdownRef.current = setInterval(() => {
      setRemainingMs((prev) => {
        const next = prev - 1000;
        if (next <= 0) {
          // Token has expired — redirect to login
          localStorage.clear();
          window.location.href = '/login';
          return null;
        }
        return next;
      });
    }, 1000);

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [remainingMs !== null]);

  // Periodic check: run every CHECK_INTERVAL_MS
  useEffect(() => {
    // Check immediately on mount
    checkSession();

    intervalRef.current = setInterval(checkSession, CHECK_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [checkSession]);

  // Also check when localStorage changes (e.g., token refreshed by API interceptor)
  useEffect(() => {
    const handleStorage = () => checkSession();
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [checkSession]);

  const handleExtendSession = async () => {
    setExtending(true);
    setExtendError('');
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        setExtendError('No refresh token available. Please log in again.');
        setExtending(false);
        return;
      }

      const response = await axios.post(`${BASE_URL}/api/auth/refresh`, {
        refreshToken,
      });
      const { accessToken, refreshToken: newRefreshToken } = response.data;
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', newRefreshToken);

      // Reset the warning flag so checkSession re-evaluates the new token
      warningShownRef.current = false;
      checkSession();
    } catch (err) {
      setExtendError(
        err.response?.data?.message || 'Failed to extend session. Please log in again.'
      );
      // If refresh fails, the token is likely expired — redirect after a short delay
      setTimeout(() => {
        localStorage.clear();
        window.location.href = '/login';
      }, 3000);
    } finally {
      setExtending(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/login';
  };

  if (remainingMs === null) return null;

  const minutes = Math.floor(remainingMs / 60000);
  const seconds = Math.floor((remainingMs % 60000) / 1000);

  return (
    <Dialog
      open={true}
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown
      PaperProps={{
        sx: { borderRadius: 2 },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
        <AccessTime color="warning" />
        <Typography variant="h6" fontWeight={600}>
          Session Expiring Soon
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ pb: 1 }}>
        <Alert severity="warning" sx={{ mb: 2 }}>
          Your session will expire in <strong>{minutes}:{seconds.toString().padStart(2, '0')}</strong>.
          Extend your session to continue working without interruption.
        </Alert>
        <Box sx={{ mb: 1 }}>
          <LinearProgress
            variant="determinate"
            value={(remainingMs / WARNING_THRESHOLD_MS) * 100}
            color={remainingMs < 60000 ? 'error' : 'warning'}
            sx={{ height: 6, borderRadius: 3 }}
          />
        </Box>
        <Typography variant="caption" color="text.secondary">
          Your session will automatically expire and you will be logged out.
        </Typography>
        {extendError && (
          <Typography variant="body2" color="error" sx={{ mt: 1 }}>
            {extendError}
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'space-between' }}>
        <Button onClick={handleLogout} color="inherit">
          Log Out Now
        </Button>
        <Button
          variant="contained"
          onClick={handleExtendSession}
          disabled={extending}
          sx={{ minWidth: 140 }}
        >
          {extending ? 'Extending...' : 'Extend Session'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
