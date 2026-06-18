import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { TextField, Button, Typography, Alert, Box } from '@mui/material';
import { authService } from '../services/authService';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      await authService.resetPassword(token, newPassword);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <Box sx={{ textAlign: 'center' }}>
        <Typography color="error">Invalid reset link. No token provided.</Typography>
        <Button onClick={() => navigate('/login')} variant="contained" sx={{ mt: 2 }}>
          Back to Sign In
        </Button>
      </Box>
    );
  }

  if (success) {
    return (
      <Box sx={{ textAlign: 'center' }}>
        <Alert severity="success" sx={{ mb: 2 }}>Password has been reset successfully!</Alert>
        <Button onClick={() => navigate('/login')} variant="contained" fullWidth>
          Back to Sign In
        </Button>
      </Box>
    );
  }

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Typography variant="h6" sx={{ mb: 0.5 }}>Reset Password</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Enter your new password
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TextField
        fullWidth
        label="New Password"
        type="password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        required
        autoFocus
        sx={{ mb: 2 }}
      />
      <TextField
        fullWidth
        label="Confirm Password"
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        required
        sx={{ mb: 3 }}
      />

      <Button type="submit" variant="contained" fullWidth size="large" disabled={loading}>
        {loading ? 'Resetting...' : 'Reset Password'}
      </Button>
    </Box>
  );
}
