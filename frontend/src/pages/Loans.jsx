import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Button, TextField, Select, MenuItem, FormControl,
  InputLabel, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Chip, Card, CardContent, Grid,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import { Add, Cancel } from '@mui/icons-material';
import { loanService } from '../services/loanService';
import { employeeService } from '../services/employeeService';
import LoadingScreen from '../components/LoadingScreen';
import ConfirmDialog from '../components/ConfirmDialog';
import dayjs from 'dayjs';

const statusColors = { ACTIVE: 'primary', COMPLETED: 'success', CANCELLED: 'error' };

const emptyLoan = {
  employeeId: '', loanAmount: '', interestRate: '0',
  monthlyDeduction: '', durationMonths: '1', startDate: '', endDate: '',
};

export default function Loans() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyLoan);
  const [cancelId, setCancelId] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const queryClient = useQueryClient();

  const { data: employees } = useQuery({
    queryKey: ['employees-mini'],
    queryFn: async () => { const res = await employeeService.getAll({ size: 200 }); return res.data.content; },
  });

  const { data: loans, isLoading } = useQuery({
    queryKey: ['loans', selectedEmployee],
    queryFn: async () => {
      if (!selectedEmployee) return [];
      const res = await loanService.getByEmployee(selectedEmployee);
      return res.data;
    },
    enabled: !!selectedEmployee,
  });

  const createMutation = useMutation({
    mutationFn: (data) => loanService.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['loans'] }); closeDialog(); },
  });

  const cancelMutation = useMutation({
    mutationFn: (id) => loanService.cancel(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['loans'] }); setCancelId(null); },
  });

  const openCreate = () => {
    setEditId(null);
    setForm({ ...emptyLoan, employeeId: selectedEmployee });
    setDialogOpen(true);
  };

  const closeDialog = () => { setDialogOpen(false); setEditId(null); setForm(emptyLoan); };

  const  handleSubmit = () => {
    const data = {
      employeeId: form.employeeId,
      loanAmount: parseFloat(form.loanAmount),
      interestRate: parseFloat(form.interestRate) || 0,
      monthlyDeduction: parseFloat(form.monthlyDeduction) || 0,
      durationMonths: parseInt(form.durationMonths) || 1,
      startDate: form.startDate,
      endDate: form.endDate,
    };
    if (editId) {
      loanService.update(editId, data).then(() => {
        queryClient.invalidateQueries({ queryKey: ['loans'] });
        closeDialog();
      });
    } else {
      createMutation.mutate(data);
    }
  };

  if (isLoading) return <LoadingScreen />;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Loans</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={openCreate} disabled={!selectedEmployee}>
          Add Loan
        </Button>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <FormControl fullWidth>
            <InputLabel>Select Employee</InputLabel>
            <Select
              value={selectedEmployee} label="Select Employee"
              onChange={(e) => setSelectedEmployee(e.target.value)}
            >
              {employees?.map((emp) => (
                <MenuItem key={emp.id} value={emp.id}>
                  {emp.employeeNumber} - {emp.firstName} {emp.lastName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </CardContent>
      </Card>

      {!selectedEmployee ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <Typography color="text.secondary">Select an employee to view their loans</Typography>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Amount</TableCell>
                  <TableCell>Balance</TableCell>
                  <TableCell>Monthly Deduction</TableCell>
                  <TableCell>Duration</TableCell>
                  <TableCell>Interest</TableCell>
                  <TableCell>Period</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loans?.length === 0 ? (
                  <TableRow><TableCell colSpan={7} align="center">No loans for this employee</TableCell></TableRow>
                ) : (
                  loans?.map((loan) => (
                    <TableRow key={loan.id} hover>
                      <TableCell>ZMW {loan.loanAmount?.toLocaleString()}</TableCell>
                      <TableCell>ZMW {loan.balance?.toLocaleString()}</TableCell>
                      <TableCell>ZMW {loan.monthlyDeduction?.toLocaleString()}</TableCell>
                      <TableCell>{loan.durationMonths || 1} mo</TableCell>
                      <TableCell>{loan.interestRate}%</TableCell>
                      <TableCell>{dayjs(loan.startDate).format('MMM YYYY')} - {dayjs(loan.endDate).format('MMM YYYY')}</TableCell>
                      <TableCell><Chip label={loan.status} size="small" color={statusColors[loan.status] || 'default'} /></TableCell>
                      <TableCell align="right">
                        {loan.status === 'ACTIVE' && (
                          <Button size="small" color="error" startIcon={<Cancel />}
                            onClick={() => setCancelId(loan.id)}>Cancel</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Add Loan</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Employee *</InputLabel>
                <Select value={form.employeeId} label="Employee *" onChange={(e) => setForm((p) => ({ ...p, employeeId: e.target.value }))}>
                  {employees?.map((emp) => (
                    <MenuItem key={emp.id} value={emp.id}>{emp.employeeNumber} - {emp.firstName} {emp.lastName}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="Loan Amount *" type="number" value={form.loanAmount}
                onChange={(e) => setForm((p) => ({ ...p, loanAmount: e.target.value }))} required />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="Interest Rate (%)" type="number" value={form.interestRate}
                onChange={(e) => setForm((p) => ({ ...p, interestRate: e.target.value }))} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="Monthly Deduction" type="number" value={form.monthlyDeduction}
                onChange={(e) => setForm((p) => ({ ...p, monthlyDeduction: e.target.value }))} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="Duration (Months)" type="number" value={form.durationMonths}
                onChange={(e) => setForm((p) => ({ ...p, durationMonths: e.target.value }))}
                inputProps={{ min: 1 }} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="Start Date *" type="date" value={form.startDate}
                onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
                InputLabelProps={{ shrink: true }} required />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="End Date *" type="date" value={form.endDate}
                onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
                InputLabelProps={{ shrink: true }} required />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" disabled={createMutation.isPending}>
            Create Loan
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!cancelId} title="Cancel Loan"
        message="Are you sure you want to cancel this loan?"
        onConfirm={() => cancelMutation.mutate(cancelId)} onCancel={() => setCancelId(null)} color="error"
        confirmLabel="Cancel Loan"
      />
    </Box>
  );
}
