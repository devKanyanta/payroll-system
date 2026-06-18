import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { TextField, Button, Typography, Alert, Box, Link } from '@mui/material';
import { authService } from '../services/authService';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authService.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <Box sx={{ textAlign: 'center' }}>
        <Typography variant="h6" sx={{ mb: 1 }}>Check Your Email</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          If an account exists with {email}, you'll receive a password reset link shortly.
        </Typography>
        <Button component={RouterLink} to="/login" variant="contained" fullWidth>
          Back to Sign In
        </Button>
      </Box>
    );
  }

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Typography variant="h6" sx={{ mb: 0.5 }}>Forgot Password</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Enter your email and we'll send you a reset link
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TextField
        fullWidth
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoFocus
        sx={{ mb: 3 }}
      />

      <Button type="submit" variant="contained" fullWidth size="large" disabled={loading}>
        {loading ? 'Sending...' : 'Send Reset Link'}
      </Button>

      <Box sx={{ textAlign: 'center', mt: 2 }}>
        <Link component={RouterLink} to="/login" variant="body2">
          Back to Sign In
        </Link>
      </Box>
    </Box>
  );
}
