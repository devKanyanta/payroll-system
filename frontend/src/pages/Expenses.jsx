import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Button, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Card, CardContent, Grid,
  TablePagination, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, Chip, Tooltip, Stack, Snackbar, Alert,
} from '@mui/material';
import {
  Add, Edit, Delete, CheckCircle, Cancel, FileDownload,
} from '@mui/icons-material';
import { expenseService } from '../services/expenseService';
import LoadingScreen from '../components/LoadingScreen';
import ConfirmDialog from '../components/ConfirmDialog';
import dayjs from 'dayjs';

const emptyExpense = { item: '', amount: '', remarks: '', expenseDate: dayjs().format('YYYY-MM-DD') };

const STATUS_COLORS = {
  PENDING: { color: '#d97706', bg: '#fef3c7' },
  APPROVED: { color: '#059669', bg: '#d1fae5' },
  REJECTED: { color: '#dc2626', bg: '#fee2e2' },
};

function StatusChip({ status }) {
  const colors = STATUS_COLORS[status] || { color: '#6b7280', bg: '#f3f4f6' };
  const label = status || 'UNKNOWN';
  return (
    <Chip
      label={label}
      size="small"
      sx={{
        fontWeight: 600,
        fontSize: '0.75rem',
        color: colors.color,
        bgcolor: colors.bg,
        textTransform: 'capitalize',
      }}
    />
  );
}

export default function Expenses() {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyExpense);
  const [deleteId, setDeleteId] = useState(null);
  const [rejectDialog, setRejectDialog] = useState({ open: false, id: null, reason: '' });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'error' });
  const queryClient = useQueryClient();

  // Get current user from localStorage
  let user = { role: 'HR' };
  try {
    const stored = localStorage.getItem('user');
    if (stored) user = JSON.parse(stored);
    // eslint-disable-next-line no-empty
  } catch {}

  const isAdmin = user?.role === 'ADMIN';

  const buildParams = () => {
    const params = { page, size: rowsPerPage, sort: 'expenseDate,desc' };
    if (startDate) params.start = startDate;
    if (endDate) params.end = endDate;
    if (statusFilter) params.status = statusFilter;
    return params;
  };

  const { data: pageData, isLoading } = useQuery({
    queryKey: ['expenses', page, rowsPerPage, startDate, endDate, statusFilter],
    queryFn: async () => {
      const res = await expenseService.getAll(buildParams());
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data) => expenseService.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['expenses'] }); closeDialog(); },
    onError: (err) => setSnackbar({ open: true, message: err.response?.data?.message || 'Failed to create expense', severity: 'error' }),
  });

  const updateMutation = useMutation({
    mutationFn: (data) => expenseService.update(editId, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['expenses'] }); closeDialog(); },
    onError: (err) => setSnackbar({ open: true, message: err.response?.data?.message || 'Failed to update expense', severity: 'error' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => expenseService.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['expenses'] }); setDeleteId(null); },
    onError: (err) => {
      setDeleteId(null);
      setSnackbar({ open: true, message: err.response?.data?.message || 'Failed to delete expense', severity: 'error' });
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id) => expenseService.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setSnackbar({ open: true, message: 'Expense approved successfully', severity: 'success' });
    },
    onError: (err) => setSnackbar({ open: true, message: err.response?.data?.message || 'Failed to approve expense', severity: 'error' }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }) => expenseService.reject(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setRejectDialog({ open: false, id: null, reason: '' });
      setSnackbar({ open: true, message: 'Expense rejected', severity: 'info' });
    },
    onError: (err) => setSnackbar({ open: true, message: err.response?.data?.message || 'Failed to reject expense', severity: 'error' }),
  });

  const openCreate = () => { setEditId(null); setForm(emptyExpense); setDialogOpen(true); };
  const openEdit = (exp) => {
    setEditId(exp.id);
    setForm({
      item: exp.item, amount: exp.amount, remarks: exp.remarks || '',
      expenseDate: exp.expenseDate,
    });
    setDialogOpen(true);
  };
  const closeDialog = () => { setDialogOpen(false); setEditId(null); setForm(emptyExpense); };

  const handleSubmit = () => {
    const data = { ...form, amount: parseFloat(form.amount) };
    if (editId) updateMutation.mutate(data);
    else createMutation.mutate(data);
  };

  const canEdit = (exp) => {
    return exp.createdBy?.id === user?.id && exp.status === 'PENDING';
  };

  const canDelete = (exp) => {
    if (isAdmin) return true;
    return exp.createdBy?.id === user?.id && exp.status === 'PENDING';
  };

  if (isLoading) return <LoadingScreen />;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Expenses</Typography>
          <Typography variant="body2" color="text.secondary">
            {isAdmin ? 'Review and approve expense requests' : 'Submit expenses for admin approval'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<FileDownload />}
            onClick={() => expenseService.exportApprovedExcel()}
          >
            Export Approved
          </Button>
          <Button variant="contained" startIcon={<Add />} onClick={openCreate}>
            Add Expense
          </Button>
        </Box>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ pb: '12px !important' }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={6} sm={3}>
              <TextField fullWidth label="From" type="date" size="small"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(0); }}
                InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField fullWidth label="To" type="date" size="small"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(0); }}
                InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField
                select fullWidth label="Status" size="small"
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
                SelectProps={{ native: true }}
              >
                <option value="">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </TextField>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'right' }}>
                {pageData?.totalElements || 0} expense{(pageData?.totalElements || 0) !== 1 ? 's' : ''}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Item</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Submitted By</TableCell>
                <TableCell>Approval Info</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pageData?.content?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      No expenses found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                pageData?.content?.map((exp) => (
                  <TableRow key={exp.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>{exp.item}</Typography>
                      {exp.remarks && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {exp.remarks}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight={600}>
                        ZMW {exp.amount?.toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {dayjs(exp.expenseDate).format('DD MMM YYYY')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <StatusChip status={exp.status} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {exp.createdBy?.firstName} {exp.createdBy?.lastName}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {exp.status === 'APPROVED' && exp.approvedBy && (
                        <Box>
                          <Typography variant="caption" color="success.main">
                            Approved by {exp.approvedBy?.firstName} {exp.approvedBy?.lastName}
                          </Typography>
                          {exp.approvedAt && (
                            <Typography variant="caption" color="text.disabled" sx={{ display: 'block' }}>
                              {dayjs(exp.approvedAt).format('DD MMM YYYY HH:mm')}
                            </Typography>
                          )}
                        </Box>
                      )}
                      {exp.status === 'REJECTED' && (
                        <Box>
                          <Typography variant="caption" color="error.main">
                            {exp.rejectedBy ? `Rejected by ${exp.rejectedBy?.firstName} ${exp.rejectedBy?.lastName}` : 'Rejected'}
                          </Typography>
                          {exp.rejectionReason && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontStyle: 'italic' }}>
                              "{exp.rejectionReason}"
                            </Typography>
                          )}
                          {exp.rejectedAt && (
                            <Typography variant="caption" color="text.disabled" sx={{ display: 'block' }}>
                              {dayjs(exp.rejectedAt).format('DD MMM YYYY HH:mm')}
                            </Typography>
                          )}
                        </Box>
                      )}
                      {exp.status === 'PENDING' && (
                        <Typography variant="caption" color="text.disabled">Awaiting review</Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        {/* Admin: approve/reject */}
                        {isAdmin && exp.status === 'PENDING' && exp.createdBy?.id !== user?.id && (
                          <>
                            <Tooltip title="Approve expense">
                              <IconButton
                                size="small"
                                sx={{ color: '#059669' }}
                                onClick={() => approveMutation.mutate(exp.id)}
                              >
                                <CheckCircle fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Reject expense">
                              <IconButton
                                size="small"
                                sx={{ color: '#dc2626' }}
                                onClick={() => setRejectDialog({ open: true, id: exp.id, reason: '' })}
                              >
                                <Cancel fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}

                        {canEdit(exp) && (
                          <Tooltip title="Edit expense">
                            <IconButton size="small" onClick={() => openEdit(exp)}>
                              <Edit fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}

                        {canDelete(exp) && (
                          <Tooltip title="Delete expense">
                            <IconButton size="small" color="error" onClick={() => setDeleteId(exp.id)}>
                              <Delete fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={pageData?.totalElements || 0}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
        />
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editId ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField fullWidth label="Item *" value={form.item}
                onChange={(e) => setForm((p) => ({ ...p, item: e.target.value }))} required />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="Amount *" type="number" value={form.amount}
                onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} required />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="Date *" type="date" value={form.expenseDate}
                onChange={(e) => setForm((p) => ({ ...p, expenseDate: e.target.value }))}
                InputLabelProps={{ shrink: true }} required />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Remarks" value={form.remarks} multiline rows={2}
                onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editId ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteId}
        title="Delete Expense"
        color="error"
        message="Are you sure you want to delete this expense?"
        onConfirm={() => deleteMutation.mutate(deleteId)}
        onCancel={() => setDeleteId(null)}
      />

      {/* Reject Dialog */}
      <Dialog
        open={rejectDialog.open}
        onClose={() => setRejectDialog({ open: false, id: null, reason: '' })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Reject Expense</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Please provide a reason for rejecting this expense.
          </Typography>
          <TextField
            fullWidth
            label="Rejection Reason *"
            value={rejectDialog.reason}
            onChange={(e) => setRejectDialog((p) => ({ ...p, reason: e.target.value }))}
            multiline
            rows={3}
            required
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialog({ open: false, id: null, reason: '' })}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={!rejectDialog.reason.trim()}
            onClick={() => rejectMutation.mutate({ id: rejectDialog.id, reason: rejectDialog.reason.trim() })}
          >
            Reject
          </Button>
        </DialogActions>
      </Dialog>

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
