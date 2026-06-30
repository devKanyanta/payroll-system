import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Card, CardContent, Chip, IconButton, Tooltip, Stack,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Switch, FormControlLabel, Snackbar, Alert, alpha,
} from '@mui/material';
import {
  Add, Edit, Visibility, VisibilityOff, CheckCircle, Cancel,
} from '@mui/icons-material';
import { ppeCatalogService } from '../services/ppeCatalogService';
import LoadingScreen from '../components/LoadingScreen';
import ConfirmDialog from '../components/ConfirmDialog';

const emptyItem = { name: '', description: '', category: '' };

export default function PpeCatalog() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyItem);
  const [showInactive, setShowInactive] = useState(false);
  const [deactivateId, setDeactivateId] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const queryClient = useQueryClient();

  const { data: items, isLoading } = useQuery({
    queryKey: ['ppe-catalog', showInactive],
    queryFn: async () => {
      const res = await ppeCatalogService.getAll(showInactive);
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data) => ppeCatalogService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ppe-catalog'] });
      closeDialog();
      setSnackbar({ open: true, message: 'PPE item created successfully', severity: 'success' });
    },
    onError: (err) => setSnackbar({ open: true, message: err.response?.data?.message || 'Failed to create item', severity: 'error' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => ppeCatalogService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ppe-catalog'] });
      closeDialog();
      setSnackbar({ open: true, message: 'PPE item updated successfully', severity: 'success' });
    },
    onError: (err) => setSnackbar({ open: true, message: err.response?.data?.message || 'Failed to update item', severity: 'error' }),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id) => ppeCatalogService.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ppe-catalog'] });
      setDeactivateId(null);
      setSnackbar({ open: true, message: 'PPE item deactivated', severity: 'success' });
    },
    onError: (err) => {
      setDeactivateId(null);
      setSnackbar({ open: true, message: err.response?.data?.message || 'Failed to deactivate item', severity: 'error' });
    },
  });

  const openCreate = () => {
    setEditId(null);
    setForm(emptyItem);
    setDialogOpen(true);
  };

  const openEdit = (item) => {
    setEditId(item.id);
    setForm({ name: item.name, description: item.description || '', category: item.category || '' });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditId(null);
    setForm(emptyItem);
  };

  const handleSubmit = () => {
    const data = {
      name: form.name,
      description: form.description || null,
      category: form.category || null,
    };
    if (editId) {
      updateMutation.mutate({ id: editId, data });
    } else {
      createMutation.mutate(data);
    }
  };

  if (isLoading) return <LoadingScreen />;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>PPE Catalog</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage the master list of Personal Protective Equipment items
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <FormControlLabel
            control={<Switch checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} size="small" />}
            label="Show inactive"
            sx={{ '& .MuiTypography-root': { fontSize: '0.875rem' } }}
          />
          <Button variant="contained" startIcon={<Add />} onClick={openCreate}>
            Add Item
          </Button>
        </Stack>
      </Box>

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      No PPE catalog items found. Add your first item to get started.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                items?.map((item) => (
                  <TableRow key={item.id} hover
                    sx={{ ...(!item.isActive && { opacity: 0.6 }) }}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{item.name}</Typography>
                    </TableCell>
                    <TableCell>
                      {item.category ? (
                        <Chip label={item.category} size="small" variant="outlined" />
                      ) : (
                        <Typography variant="caption" color="text.disabled">—</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.description || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={item.isActive ? 'Active' : 'Inactive'}
                        size="small"
                        color={item.isActive ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Tooltip title="Edit item">
                          <IconButton size="small" onClick={() => openEdit(item)}>
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {item.isActive && (
                          <Tooltip title="Deactivate item">
                            <IconButton size="small" color="error" onClick={() => setDeactivateId(item.id)}>
                              <Cancel fontSize="small" />
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
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editId ? 'Edit PPE Item' : 'Add PPE Item'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              fullWidth label="Item Name *"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              required
            />
            <TextField
              fullWidth label="Category"
              value={form.category}
              onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
              placeholder="e.g. Head, Eye, Foot, Body"
            />
            <TextField
              fullWidth label="Description"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              multiline
              rows={3}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={!form.name || createMutation.isPending || updateMutation.isPending}
          >
            {editId ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Deactivate Confirmation */}
      <ConfirmDialog
        open={!!deactivateId}
        title="Deactivate PPE Item"
        message="Are you sure you want to deactivate this item? It will no longer be available for new requests."
        onConfirm={() => deactivateMutation.mutate(deactivateId)}
        onCancel={() => setDeactivateId(null)}
        color="error"
        confirmLabel="Deactivate"
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
