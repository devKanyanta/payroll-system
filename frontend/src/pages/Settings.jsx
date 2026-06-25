import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Button, TextField, Card, CardContent, Grid,
  Tabs, Tab, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  Alert, Snackbar,
} from '@mui/material';
import { Add, Edit, Delete } from '@mui/icons-material';
import { settingsService } from '../services/settingsService';
import LoadingScreen from '../components/LoadingScreen';
import ConfirmDialog from '../components/ConfirmDialog';

function TabPanel({ children, value, index }) {
  return value === index ? <Box sx={{ mt: 3 }}>{children}</Box> : null;
}

export default function Settings() {
  const [tab, setTab] = useState(0);
  const queryClient = useQueryClient();

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>Settings</Typography>
      <Card>
        <CardContent>
          <Tabs value={tab} onChange={(_, v) => setTab(v)}>
            <Tab label="Payroll Settings" />
            <Tab label="Tax Brackets" />
            <Tab label="Deduction Types" />
          </Tabs>

          <TabPanel value={tab} index={0}>
            <PayrollSettingsForm />
          </TabPanel>
          <TabPanel value={tab} index={1}>
            <TaxBracketsPanel />
          </TabPanel>
          <TabPanel value={tab} index={2}>
            <DeductionTypesPanel />
          </TabPanel>
        </CardContent>
      </Card>
    </Box>
  );
}

function PayrollSettingsForm() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(null);
  const [success, setSuccess] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'error' });

  const { data: settings, isLoading } = useQuery({
    queryKey: ['payroll-settings'],
    queryFn: async () => {
      const res = await settingsService.getPayrollLatest();
      return res.data;
    },
  });

  // Initialize form when settings data loads
  useEffect(() => {
    if (settings && !form) {
      setForm(settings);
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: (data) => settingsService.updatePayroll(settings.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-settings'] });
      setSuccess('Settings updated successfully');
      setTimeout(() => setSuccess(''), 3000);
    },
    onError: (err) => setSnackbar({ open: true, message: err.response?.data?.message || 'Failed to save settings', severity: 'error' }),
  });

  if (isLoading) return <LoadingScreen />;

  const fields = [
    { key: 'nhimaEmployeePercent', label: 'NHIMA Employee %', type: 'number' },
    { key: 'nhimaEmployerPercent', label: 'NHIMA Employer %', type: 'number' },
    { key: 'napsaEmployeePercent', label: 'NAPSA Employee %', type: 'number' },
    { key: 'napsaEmployerPercent', label: 'NAPSA Employer %', type: 'number' },
    { key: 'napsaMaxEarnings', label: 'NAPSA Max Earnings', type: 'number' },
    { key: 'softLoanInterestRate', label: 'Soft Loan Interest Rate', type: 'number' },
    { key: 'overtimeRate', label: 'Overtime Rate', type: 'number' },
    { key: 'holidayRate', label: 'Holiday Rate', type: 'number' },
    { key: 'workingDaysPerMonth', label: 'Working Days/Month', type: 'number' },
    { key: 'hoursPerDay', label: 'Hours/Day', type: 'number' },
    { key: 'effectiveDate', label: 'Effective Date', type: 'date' },
  ];

  const handleChange = (key) => (e) => {
    setForm((p) => ({ ...p, [key]: e.target.value }));
  };

  return (
    <Box>
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
      <Grid container spacing={2}>
        {fields.map((f) => (
          <Grid item xs={12} sm={6} md={4} key={f.key}>
            <TextField
              fullWidth label={f.label}
              type={f.type}
              value={form?.[f.key] ?? ''}
              onChange={handleChange(f.key)}
              InputLabelProps={f.type === 'date' ? { shrink: true } : undefined}
            />
          </Grid>
        ))}
      </Grid>
      <Button variant="contained" sx={{ mt: 3 }}
        onClick={() => updateMutation.mutate(form)}
        disabled={updateMutation.isPending}>
        Save Settings
      </Button>

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

function TaxBracketsPanel() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ minAmount: '', maxAmount: '', taxRate: '', effectiveDate: '' });
  const [deleteId, setDeleteId] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'error' });
  const queryClient = useQueryClient();

  const { data: brackets, isLoading } = useQuery({
    queryKey: ['tax-brackets'],
    queryFn: async () => { const res = await settingsService.getTaxBrackets(); return res.data; },
  });

  const createMutation = useMutation({
    mutationFn: (data) => settingsService.createTaxBracket(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tax-brackets'] }); setDialogOpen(false); setForm({ minAmount: '', maxAmount: '', taxRate: '', effectiveDate: '' }); },
    onError: (err) => setSnackbar({ open: true, message: err.response?.data?.message || 'Failed to create tax bracket', severity: 'error' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => settingsService.deleteTaxBracket(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tax-brackets'] }); setDeleteId(null); },
    onError: (err) => {
      setDeleteId(null);
      setSnackbar({ open: true, message: err.response?.data?.message || 'Failed to delete tax bracket', severity: 'error' });
    },
  });

  if (isLoading) return <LoadingScreen />;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button variant="contained" startIcon={<Add />} onClick={() => { setEditId(null); setForm({ minAmount: '', maxAmount: '', taxRate: '', effectiveDate: '' }); setDialogOpen(true); }}>
          Add Bracket
        </Button>
      </Box>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Min (ZMW)</TableCell>
              <TableCell>Max (ZMW)</TableCell>
              <TableCell>Rate (%)</TableCell>
              <TableCell>Effective Date</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {brackets?.map((b) => (
              <TableRow key={b.id}>
                <TableCell>{b.minAmount?.toLocaleString()}</TableCell>
                <TableCell>{b.maxAmount ? b.maxAmount.toLocaleString() : '∞'}</TableCell>
                <TableCell>{b.taxRate}%</TableCell>
                <TableCell>{b.effectiveDate}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" color="error" onClick={() => setDeleteId(b.id)}><Delete /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Tax Bracket</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={6}>
              <TextField fullWidth label="Min Amount" type="number" value={form.minAmount}
                onChange={(e) => setForm((p) => ({ ...p, minAmount: e.target.value }))} required />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="Max Amount (leave empty for ∞)" type="number" value={form.maxAmount}
                onChange={(e) => setForm((p) => ({ ...p, maxAmount: e.target.value }))} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="Tax Rate (%)" type="number" value={form.taxRate}
                onChange={(e) => setForm((p) => ({ ...p, taxRate: e.target.value }))} required />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="Effective Date" type="date" value={form.effectiveDate}
                onChange={(e) => setForm((p) => ({ ...p, effectiveDate: e.target.value }))}
                InputLabelProps={{ shrink: true }} required />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => {
            const data = {
              minAmount: parseFloat(form.minAmount),
              maxAmount: form.maxAmount ? parseFloat(form.maxAmount) : null,
              taxRate: parseFloat(form.taxRate),
              effectiveDate: form.effectiveDate,
            };
            createMutation.mutate(data);
          }}>Add</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog open={!!deleteId} title="Delete Tax Bracket" color="error"
        message="Are you sure you want to delete this tax bracket?"
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

function DeductionTypesPanel() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const queryClient = useQueryClient();

  const { data: types, isLoading } = useQuery({
    queryKey: ['deduction-types'],
    queryFn: async () => { const res = await settingsService.getDeductionTypes(); return res.data; },
  });

  const createMutation = useMutation({
    mutationFn: (data) => settingsService.createDeductionType(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['deduction-types'] }); setDialogOpen(false); setForm({ name: '', description: '' }); },
  });

  if (isLoading) return <LoadingScreen />;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button variant="contained" startIcon={<Add />} onClick={() => setDialogOpen(true)}>Add Type</Button>
      </Box>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Active</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {types?.map((t) => (
              <TableRow key={t.id}>
                <TableCell>{t.name}</TableCell>
                <TableCell>{t.description || '-'}</TableCell>
                <TableCell>{t.isActive ? 'Yes' : 'No'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Deduction Type</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Name *" value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required sx={{ mt: 1 }} />
          <TextField fullWidth label="Description" value={form.description} multiline rows={2}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} sx={{ mt: 2 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => createMutation.mutate(form)}>Add</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
