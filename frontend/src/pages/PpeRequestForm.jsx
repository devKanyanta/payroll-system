import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import {
  Box, Typography, Button, Card, CardContent, Grid, TextField,
  FormControl, InputLabel, Select, MenuItem, Checkbox, ListItemText,
  OutlinedInput, FormHelperText, Stack, Alert, Snackbar, Chip,
} from '@mui/material';
import { ArrowBack, Save } from '@mui/icons-material';
import { ppeRequestService } from '../services/ppeRequestService';
import { ppeCatalogService } from '../services/ppeCatalogService';
import { employeeService } from '../services/employeeService';
import LoadingScreen from '../components/LoadingScreen';
import dayjs from 'dayjs';

export default function PpeRequestForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { id: editId } = useParams();
  const isEdit = !!editId;
  const preselectedEmployeeId = searchParams.get('employeeId');
  const queryClient = useQueryClient();

  const [employeeId, setEmployeeId] = useState(preselectedEmployeeId || '');
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Load existing request data in edit mode
  const { data: existingRequest, isLoading: loadingRequest } = useQuery({
    queryKey: ['ppe-request', editId],
    queryFn: async () => {
      const res = await ppeRequestService.getById(editId);
      return res.data;
    },
    enabled: isEdit,
  });

  // Populate form when existing request loads
  useEffect(() => {
    if (existingRequest) {
      setEmployeeId(existingRequest.employeeId);
      setSelectedItemIds(existingRequest.items?.map((i) => i.id) || []);
      setDueDate(dayjs(existingRequest.dueDate).format('YYYY-MM-DD'));
      setNotes(existingRequest.notes || '');
    }
  }, [existingRequest]);

  const { data: employees } = useQuery({
    queryKey: ['employees-active'],
    queryFn: async () => {
      const res = await employeeService.getAll({ size: 500, status: 'ACTIVE', sort: 'firstName,asc' });
      return res.data.content;
    },
  });

  const { data: catalogItems, isLoading: catalogLoading } = useQuery({
    queryKey: ['ppe-catalog-active'],
    queryFn: async () => {
      const res = await ppeCatalogService.getAll(false);
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data) => ppeRequestService.create(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['ppe-requests'] });
      setSnackbar({ open: true, message: 'PPE request created successfully', severity: 'success' });
      setTimeout(() => navigate(`/ppe/${res.data.id}`), 1000);
    },
    onError: (err) => {
      setError(err.response?.data?.message || 'Failed to create request');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data) => ppeRequestService.update(editId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ppe-requests'] });
      queryClient.invalidateQueries({ queryKey: ['ppe-request', editId] });
      setSnackbar({ open: true, message: 'PPE request updated successfully', severity: 'success' });
      setTimeout(() => navigate(`/ppe/${editId}`), 1000);
    },
    onError: (err) => {
      setError(err.response?.data?.message || 'Failed to update request');
    },
  });

  const handleSubmit = () => {
    setError('');

    if (!employeeId) { setError('Please select an employee'); return; }
    if (!dueDate) { setError('Please select a due date'); return; }
    if (selectedItemIds.length === 0) { setError('Please select at least one PPE item'); return; }

    const data = {
      employeeId,
      dueDate,
      notes: notes || null,
      catalogItemIds: selectedItemIds,
    };

    if (isEdit) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  if (catalogLoading || loadingRequest) return <LoadingScreen />;

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => navigate(isEdit ? `/ppe/${editId}` : '/ppe')} sx={{ mb: 2 }}>
        Back{isEdit ? ' to Request' : ' to PPE Requests'}
      </Button>

      <Typography variant="h4" sx={{ fontWeight: 800, mb: 3 }}>
        {isEdit ? 'Edit PPE Request' : 'New PPE Request'}
      </Typography>

      <Card sx={{ maxWidth: 800 }}>
        <CardContent sx={{ p: 3 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          <Grid container spacing={3}>
            {/* Employee Selection */}
            <Grid item xs={12}>
              <FormControl fullWidth required>
                <InputLabel>Employee *</InputLabel>
                <Select
                  value={employeeId}
                  label="Employee *"
                  onChange={(e) => setEmployeeId(e.target.value)}
                  disabled={!!preselectedEmployeeId || isEdit}
                >
                  {employees?.map((emp) => (
                    <MenuItem key={emp.id} value={emp.id}>
                      {emp.employeeNumber} — {emp.firstName} {emp.lastName}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>Only active employees are shown</FormHelperText>
              </FormControl>
            </Grid>

            {/* Due Date */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Due Date (Replacement Due) *"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                required
                inputProps={{ min: dayjs().format('YYYY-MM-DD') }}
              />
              <FormHelperText>The date when PPE should be replaced/expires</FormHelperText>
            </Grid>

            {/* PPE Items Checklist */}
            <Grid item xs={12}>
              <FormControl fullWidth required error={selectedItemIds.length === 0 && !!error}>
                <InputLabel>PPE Items *</InputLabel>
                <Select
                  multiple
                  value={selectedItemIds}
                  onChange={(e) => setSelectedItemIds(e.target.value)}
                  input={<OutlinedInput label="PPE Items *" />}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((id) => {
                        const item = catalogItems?.find((i) => i.id === id);
                        return item ? (
                          <Chip key={id} label={item.name} size="small" />
                        ) : null;
                      })}
                    </Box>
                  )}
                >
                  {catalogItems?.length === 0 ? (
                    <MenuItem disabled>
                      <Typography variant="body2" color="text.secondary">
                        No catalog items available. Ask an admin to add PPE items first.
                      </Typography>
                    </MenuItem>
                  ) : (
                    catalogItems?.map((item) => (
                      <MenuItem key={item.id} value={item.id}>
                        <Checkbox checked={selectedItemIds.indexOf(item.id) > -1} size="small" />
                        <ListItemText
                          primary={item.name}
                          secondary={item.category || ''}
                        />
                      </MenuItem>
                    ))
                  )}
                </Select>
                <FormHelperText>Select one or more items needed</FormHelperText>
              </FormControl>
            </Grid>

            {/* Notes */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                multiline
                rows={3}
                placeholder="Any additional details or justification..."
              />
            </Grid>
          </Grid>

          <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 3 }}>
            <Button variant="outlined" onClick={() => navigate(isEdit ? `/ppe/${editId}` : '/ppe')}>
              Cancel
            </Button>
            <Button
              variant="contained"
              startIcon={<Save />}
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Saving...'
                : isEdit ? 'Update Request' : 'Submit Request'}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
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
