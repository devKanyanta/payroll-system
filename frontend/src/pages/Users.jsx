import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Button, TextField, Select, MenuItem,
  FormControl, InputLabel, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Card, CardContent,
  IconButton, TablePagination, Dialog, DialogTitle, DialogContent,
  DialogActions, Switch, FormControlLabel, Snackbar, Alert,
} from '@mui/material';
import { Add, Edit, Delete } from '@mui/icons-material';
import { userService } from '../services/userService';
import LoadingScreen from '../components/LoadingScreen';
import ConfirmDialog from '../components/ConfirmDialog';

const roleColors = { ADMIN: 'error', HR: 'primary', MANAGER: 'warning' };

const emptyUser = { firstName: '', lastName: '', email: '', role: 'HR', active: true };

export default function Users() {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyUser);
  const [deleteId, setDeleteId] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'error' });
  const queryClient = useQueryClient();

  const { data: pageData, isLoading } = useQuery({
    queryKey: ['users', page, rowsPerPage],
    queryFn: async () => {
      const res = await userService.getAll({ page, size: rowsPerPage, sort: 'firstName,asc' });
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data) => userService.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); closeDialog(); },
    onError: (err) => setSnackbar({ open: true, message: err.response?.data?.message || 'Failed to create user', severity: 'error' }),
  });

  const updateMutation = useMutation({
    mutationFn: (data) => userService.update(editId, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); closeDialog(); },
    onError: (err) => setSnackbar({ open: true, message: err.response?.data?.message || 'Failed to update user', severity: 'error' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => userService.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); setDeleteId(null); },
    onError: (err) => {
      setDeleteId(null);
      setSnackbar({ open: true, message: err.response?.data?.message || 'Failed to delete user', severity: 'error' });
    },
  });

  const openCreate = () => { setEditId(null); setForm(emptyUser); setDialogOpen(true); };
  const openEdit = (u) => {
    setEditId(u.id);
    setForm({ firstName: u.firstName, lastName: u.lastName, email: u.email, role: u.role, active: u.active });
    setDialogOpen(true);
  };
  const closeDialog = () => { setDialogOpen(false); setEditId(null); setForm(emptyUser); };

  const handleSubmit = () => {
    if (editId) updateMutation.mutate(form);
    else createMutation.mutate(form);
  };

  if (isLoading) return <LoadingScreen />;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4">Users</Typography>
          <Typography variant="body2" color="text.secondary">Manage system users</Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={openCreate}>Add User</Button>
      </Box>

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pageData?.content?.length === 0 ? (
                <TableRow><TableCell colSpan={5} align="center">No users found</TableCell></TableRow>
              ) : (
                pageData?.content?.map((u) => (
                  <TableRow key={u.id} hover>
                    <TableCell>{u.firstName} {u.lastName}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <Chip label={u.role} size="small" color={roleColors[u.role] || 'default'} />
                    </TableCell>
                    <TableCell>
                      <Chip label={u.active ? 'Active' : 'Inactive'} size="small"
                        color={u.active ? 'success' : 'default'} />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => openEdit(u)}><Edit /></IconButton>
                      <IconButton size="small" color="error" onClick={() => setDeleteId(u.id)}><Delete /></IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination component="div" count={pageData?.totalElements || 0} page={page}
          onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }} />
      </Card>

      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editId ? 'Edit User' : 'Add User'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField fullWidth label="First Name *" value={form.firstName}
              onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))} required />
            <TextField fullWidth label="Last Name *" value={form.lastName}
              onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))} required />
            <TextField fullWidth label="Email *" type="email" value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} required />
            <FormControl fullWidth>
              <InputLabel>Role *</InputLabel>
              <Select value={form.role} label="Role *" onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}>
                <MenuItem value="ADMIN">Admin</MenuItem>
                <MenuItem value="HR">HR</MenuItem>
                <MenuItem value="MANAGER">Manager</MenuItem>
              </Select>
            </FormControl>
            <FormControlLabel
              control={<Switch checked={form.active} onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))} />}
              label="Active"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit}>
            {editId ? 'Update' : 'Create'} User
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog open={!!deleteId} title="Delete User" color="error"
        message="Are you sure you want to delete this user?"
        onConfirm={() => deleteMutation.mutate(deleteId)} onCancel={() => setDeleteId(null)} />

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
