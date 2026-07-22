import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Button, Card, CardContent, Grid, Chip, Stack,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Divider, Alert, Snackbar, alpha,
} from '@mui/material';
import {
  ArrowBack, CheckCircle, Cancel, Edit, Delete, History,
} from '@mui/icons-material';
import { ppeRequestService } from '../services/ppeRequestService';
import { ppeCatalogService } from '../services/ppeCatalogService';
import LoadingScreen from '../components/LoadingScreen';
import ConfirmDialog from '../components/ConfirmDialog';
import dayjs from 'dayjs';
import { useAuth } from '../contexts/AuthContext';

const STATUS_STYLES = {
  PENDING: { color: '#d97706', bg: '#fef3c7', label: 'Pending' },
  ELIGIBLE: { color: '#059669', bg: '#d1fae5', label: 'Eligible' },
  NOT_ELIGIBLE: { color: '#dc2626', bg: '#fee2e2', label: 'Not Eligible' },
};

function StatusBadge({ status, size = 'medium' }) {
  const style = STATUS_STYLES[status] || { color: '#6b7280', bg: '#f3f4f6', label: status };
  return (
    <Chip
      label={style.label}
      size={size}
      sx={{
        fontWeight: 700, fontSize: size === 'medium' ? '0.875rem' : '0.75rem',
        color: style.color, bgcolor: style.bg,
        px: size === 'medium' ? 1 : 0,
      }}
    />
  );
}

export default function PpeRequestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [deleteId, setDeleteId] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const { data: request, isLoading } = useQuery({
    queryKey: ['ppe-request', id],
    queryFn: async () => {
      const res = await ppeRequestService.getById(id);
      return res.data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: () => ppeRequestService.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ppe-request', id] });
      queryClient.invalidateQueries({ queryKey: ['ppe-requests'] });
      setSnackbar({ open: true, message: 'PPE request approved — marked as Not Eligible', severity: 'success' });
    },
    onError: (err) => setSnackbar({ open: true, message: err.response?.data?.message || 'Failed to approve', severity: 'error' }),
  });

  const rejectMutation = useMutation({
    mutationFn: () => ppeRequestService.reject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ppe-requests'] });
      queryClient.invalidateQueries({ queryKey: ['ppe-requests-pending'] });
      navigate('/ppe');
    },
    onError: (err) => setSnackbar({ open: true, message: err.response?.data?.message || 'Failed to reject', severity: 'error' }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => ppeRequestService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ppe-requests'] });
      navigate('/ppe');
    },
    onError: (err) => {
      setDeleteId(null);
      setSnackbar({ open: true, message: err.response?.data?.message || 'Failed to delete', severity: 'error' });
    },
  });

  if (isLoading) return <LoadingScreen />;
  if (!request) return <Typography>PPE request not found</Typography>;

  const canReview = isAdmin && request.status === 'PENDING' && request.requestedById !== user?.id;
  const canEdit = request.status === 'PENDING';

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => navigate('/ppe')} sx={{ mb: 2 }}>
        Back to PPE Requests
      </Button>

      <Grid container spacing={3}>
        {/* Left — Request Details */}
        <Grid item xs={12} md={7}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>PPE Request</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Created {dayjs(request.createdAt).format('DD MMM YYYY, HH:mm')}
                  </Typography>
                </Box>
                <StatusBadge status={request.status} />
              </Box>

              {/* Employee Info */}
              <Box sx={{ bgcolor: alpha('#0D47A1', 0.04), borderRadius: 2, p: 2, mb: 3, border: '1px solid', borderColor: alpha('#0D47A1', 0.1) }}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Box sx={{
                    width: 48, height: 48, borderRadius: '50%', bgcolor: 'primary.main',
                    color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 18,
                  }}>
                    {request.employeeName?.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                  </Box>
                  <Box>
                    <Typography variant="subtitle1" fontWeight={600}>{request.employeeName}</Typography>
                    <Typography variant="caption" color="text.secondary">{request.employeeNumber}</Typography>
                  </Box>
                </Stack>
              </Box>

              {/* Request Details Table */}
              <TableContainer>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600, color: 'text.secondary', width: 140, borderBottom: 'none' }}>Date Given</TableCell>
                      <TableCell sx={{ borderBottom: 'none' }}>
                        {request.dateGiven ? dayjs(request.dateGiven).format('DD/MM/YYYY') : '— (Approval pending)'}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600, color: 'text.secondary', borderBottom: 'none' }}>Due Date</TableCell>
                      <TableCell sx={{ borderBottom: 'none' }}>{dayjs(request.dueDate).format('DD/MM/YYYY')}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600, color: 'text.secondary', borderBottom: 'none' }}>Requested By</TableCell>
                      <TableCell sx={{ borderBottom: 'none' }}>{request.requestedByName}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Reviewed By</TableCell>
                      <TableCell>{request.reviewedByName || '—'}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>

              {request.notes && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>Notes</Typography>
                  <Typography variant="body2" sx={{ bgcolor: 'grey.50', p: 1.5, borderRadius: 1 }}>
                    {request.notes}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Right — Items & Actions */}
        <Grid item xs={12} md={5}>
          {/* PPE Items */}
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
                Requested Items ({request.items?.length || 0})
              </Typography>
              {request.items?.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No items</Typography>
              ) : (
                <Stack spacing={1.5}>
                  {request.items.map((item) => (
                    <Box key={item.id} sx={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      p: 1.5, borderRadius: 1.5, bgcolor: 'grey.50', border: '1px solid', borderColor: 'divider',
                    }}>
                      <Typography variant="body2" fontWeight={600}>{item.name}</Typography>
                      {item.category && (
                        <Chip label={item.category} size="small" variant="outlined" />
                      )}
                    </Box>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>

          {/* Admin Actions */}
          {canReview && (
            <Card sx={{ mb: 3, borderColor: alpha('#d97706', 0.3) }}>
              <CardContent sx={{ p: 3, bgcolor: alpha('#fef3c7', 0.3) }}>
                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1, color: '#d97706' }}>
                  <History sx={{ mr: 0.5, verticalAlign: 'middle', fontSize: 20 }} />
                  Admin Review Required
                </Typography>
                <Alert severity="info" sx={{ mb: 2 }}>
                  Review this PPE request and determine eligibility.
                </Alert>
                <Stack direction="row" spacing={1.5}>
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<CheckCircle />}
                    onClick={() => approveMutation.mutate()}
                    disabled={approveMutation.isPending}
                    fullWidth
                    sx={{ fontWeight: 600 }}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<Cancel />}
                    onClick={() => rejectMutation.mutate()}
                    disabled={rejectMutation.isPending}
                    fullWidth
                    sx={{ fontWeight: 600 }}
                  >
                    Reject
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* Pending Actions (HR) */}
          {canEdit && (
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
                  Pending Request Actions
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Edit />}
                    onClick={() => navigate(`/ppe/${id}/edit`)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    startIcon={<Delete />}
                    onClick={() => setDeleteId(id)}
                  >
                    Cancel
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteId}
        title="Cancel PPE Request"
        message="Are you sure you want to cancel this PPE request? This action cannot be undone."
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setDeleteId(null)}
        color="error"
        confirmLabel="Cancel Request"
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbar((p) => ({ ...p, open: false }))} severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
