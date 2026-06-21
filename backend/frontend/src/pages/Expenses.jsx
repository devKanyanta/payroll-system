import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Button, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Card, CardContent, Grid,
  TablePagination, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions,
} from '@mui/material';
import { Add, Edit, Delete } from '@mui/icons-material';
import { expenseService } from '../services/expenseService';
import LoadingScreen from '../components/LoadingScreen';
import ConfirmDialog from '../components/ConfirmDialog';
import dayjs from 'dayjs';

const emptyExpense = { item: '', amount: '', remarks: '', expenseDate: dayjs().format('YYYY-MM-DD') };

export default function Expenses() {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyExpense);
  const [deleteId, setDeleteId] = useState(null);
  const queryClient = useQueryClient();
  const user = JSON.parse(localStorage.getItem('user')) || {};

  const { data: pageData, isLoading } = useQuery({
    queryKey: ['expenses', page, rowsPerPage, startDate, endDate],
    queryFn: async () => {
      const params = { page, size: rowsPerPage, sort: 'expenseDate,desc' };
      if (startDate) params.start = startDate;
      if (endDate) params.end = endDate;
      const res = await expenseService.getAll(params);
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data) => expenseService.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['expenses'] }); closeDialog(); },
  });

  const updateMutation = useMutation({
    mutationFn: (data) => expenseService.update(editId, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['expenses'] }); closeDialog(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => expenseService.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['expenses'] }); setDeleteId(null); },
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
    const data = { ...form, amount: parseFloat(form.amount), createdBy: user  };
    if (editId) updateMutation.mutate(data);
    else createMutation.mutate(data);
  };

  if (isLoading) return <LoadingScreen />;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Expenses</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={openCreate}>Add Expense</Button>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ pb: 1 }}>
          <Grid container spacing={2}>
            <Grid item xs={6} sm={3}>
              <TextField fullWidth label="From" type="date" size="small"
                value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(0); }}
                InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField fullWidth label="To" type="date" size="small"
                value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(0); }}
                InputLabelProps={{ shrink: true }} />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Item</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Remarks</TableCell>
                <TableCell>Created By</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pageData?.content?.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center">No expenses found</TableCell></TableRow>
              ) : (
                pageData?.content?.map((exp) => (
                  <TableRow key={exp.id} hover>
                    <TableCell fontWeight={500}>{exp.item}</TableCell>
                    <TableCell align="right">ZMW {exp.amount?.toLocaleString()}</TableCell>
                    <TableCell>{dayjs(exp.expenseDate).format('DD MMM YYYY')}</TableCell>
                    <TableCell>{exp.remarks || '-'}</TableCell>
                    <TableCell>{exp.createdBy?.firstName} {exp.createdBy?.lastName}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => openEdit(exp)}><Edit /></IconButton>
                      <IconButton size="small" color="error" onClick={() => setDeleteId(exp.id)}><Delete /></IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div" count={pageData?.totalElements || 0} page={page}
          onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
        />
      </Card>

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

      <ConfirmDialog
        open={!!deleteId} title="Delete Expense" color="error"
        message="Are you sure you want to delete this expense?"
        onConfirm={() => deleteMutation.mutate(deleteId)} onCancel={() => setDeleteId(null)}
      />
    </Box>
  );
}
