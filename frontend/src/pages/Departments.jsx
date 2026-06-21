import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Button, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, IconButton, Card, CardContent,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import { Add, Edit, Delete } from '@mui/icons-material';
import { departmentService } from '../services/departmentService';
import LoadingScreen from '../components/LoadingScreen';
import ConfirmDialog from '../components/ConfirmDialog';

export default function Departments() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [deleteId, setDeleteId] = useState(null);
  const queryClient = useQueryClient();

  const { data: departments, isLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => { const res = await departmentService.getAll(); return res.data; },
  });

  const createMutation = useMutation({
    mutationFn: (data) => departmentService.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['departments'] }); closeDialog(); },
  });

  const updateMutation = useMutation({
    mutationFn: (data) => departmentService.update(editId, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['departments'] }); closeDialog(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => departmentService.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['departments'] }); setDeleteId(null); },
  });

  const openCreate = () => { setEditId(null); setForm({ name: '', description: '' }); setDialogOpen(true); };
  const openEdit = (d) => { setEditId(d.id); setForm({ name: d.name, description: d.description || '' }); setDialogOpen(true); };
  const closeDialog = () => { setDialogOpen(false); setEditId(null); setForm({ name: '', description: '' }); };

  const handleSubmit = () => {
    if (editId) updateMutation.mutate(form);
    else createMutation.mutate(form);
  };

  if (isLoading) return <LoadingScreen />;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4">Departments</Typography>
          <Typography variant="body2" color="text.secondary">{departments?.length || 0} departments</Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={openCreate}>Add Department</Button>
      </Box>

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {departments?.length === 0 ? (
                <TableRow><TableCell colSpan={3} align="center">No departments found</TableCell></TableRow>
              ) : (
                departments?.map((d) => (
                  <TableRow key={d.id} hover>
                    <TableCell fontWeight={500}>{d.name}</TableCell>
                    <TableCell>{d.description || '-'}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => openEdit(d)}><Edit /></IconButton>
                      <IconButton size="small" color="error" onClick={() => setDeleteId(d.id)}><Delete /></IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editId ? 'Edit Department' : 'Add Department'}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth label="Department Name *" value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            required sx={{ mt: 1 }}
          />
          <TextField
            fullWidth label="Description" value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            multiline rows={3} sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editId ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId} title="Delete Department"
        message="Are you sure? This may affect employees in this department."
        onConfirm={() => deleteMutation.mutate(deleteId)} onCancel={() => setDeleteId(null)} color="error"
      />
    </Box>
  );
}
