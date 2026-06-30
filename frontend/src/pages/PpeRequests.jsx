import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Card, CardContent, Chip, TextField, Select, MenuItem,
  FormControl, InputLabel, Stack, alpha, Grid,
} from '@mui/material';
import {
  Add, Search, HealthAndSafety,
} from '@mui/icons-material';
import { ppeRequestService } from '../services/ppeRequestService';
import LoadingScreen from '../components/LoadingScreen';
import dayjs from 'dayjs';

const STATUS_STYLES = {
  PENDING: { color: '#d97706', bg: '#fef3c7' },
  ELIGIBLE: { color: '#059669', bg: '#d1fae5' },
  NOT_ELIGIBLE: { color: '#dc2626', bg: '#fee2e2' },
};

function StatusChip({ status }) {
  const style = STATUS_STYLES[status] || { color: '#6b7280', bg: '#f3f4f6' };
  return (
    <Chip
      label={status?.replace('_', ' ') || 'UNKNOWN'}
      size="small"
      sx={{
        fontWeight: 600, fontSize: '0.75rem',
        color: style.color, bgcolor: style.bg,
        textTransform: 'capitalize',
      }}
    />
  );
}

export default function PpeRequests() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const { data: requests, isLoading } = useQuery({
    queryKey: ['ppe-requests'],
    queryFn: async () => {
      const res = await ppeRequestService.getAll();
      return res.data;
    },
  });

  const filtered = useMemo(() => {
    if (!requests) return [];
    return requests.filter((req) => {
      if (statusFilter && req.status !== statusFilter) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const name = (req.employeeName || '').toLowerCase();
        const number = (req.employeeNumber || '').toLowerCase();
        if (!name.includes(term) && !number.includes(term)) return false;
      }
      return true;
    });
  }, [requests, statusFilter, searchTerm]);

  if (isLoading) return <LoadingScreen />;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>PPE Requests</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage employee Personal Protective Equipment allocation requests
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/ppe/new')}>
          New Request
        </Button>
      </Box>

      {/* Summary Cards */}
      {requests && requests.length > 0 && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={4}>
            <Card sx={{ bgcolor: alpha('#d97706', 0.08), border: '1px solid', borderColor: alpha('#d97706', 0.2) }}>
              <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
                <Stack alignItems="center" spacing={0.5}>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#d97706' }}>
                    {requests.filter((r) => r.status === 'PENDING').length}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" fontWeight={500}>Pending</Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={4}>
            <Card sx={{ bgcolor: alpha('#059669', 0.08), border: '1px solid', borderColor: alpha('#059669', 0.2) }}>
              <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
                <Stack alignItems="center" spacing={0.5}>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#059669' }}>
                    {requests.filter((r) => r.status === 'ELIGIBLE').length}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" fontWeight={500}>Eligible</Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={4}>
            <Card sx={{ bgcolor: alpha('#dc2626', 0.08), border: '1px solid', borderColor: alpha('#dc2626', 0.2) }}>
              <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
                <Stack alignItems="center" spacing={0.5}>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#dc2626' }}>
                    {requests.filter((r) => r.status === 'NOT_ELIGIBLE').length}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" fontWeight={500}>Not Eligible</Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ pb: '12px !important' }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth placeholder="Search by employee name or number..."
                size="small"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <Box component="span" sx={{ mr: 1, display: 'flex', color: 'text.disabled' }}>
                      <Search fontSize="small" />
                    </Box>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select value={statusFilter} label="Status" onChange={(e) => setStatusFilter(e.target.value)}>
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="PENDING">Pending</MenuItem>
                  <MenuItem value="ELIGIBLE">Eligible</MenuItem>
                  <MenuItem value="NOT_ELIGIBLE">Not Eligible</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={3} md={6}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'right' }}>
                {filtered.length} request{filtered.length !== 1 ? 's' : ''}
                {statusFilter && ` · ${statusFilter.toLowerCase().replace('_', ' ')}`}
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
                <TableCell>Employee</TableCell>
                <TableCell>Items</TableCell>
                <TableCell>Date Given</TableCell>
                <TableCell>Due Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Requested By</TableCell>
                <TableCell>Reviewed By</TableCell>
                <TableCell>Created</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <Box sx={{ textAlign: 'center', py: 2 }}>
                      <HealthAndSafety sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {requests?.length === 0
                          ? 'No PPE requests have been created yet'
                          : 'No requests match your search filters'}
                      </Typography>
                      {requests?.length === 0 && (
                        <Button size="small" variant="outlined" startIcon={<Add />}
                          onClick={() => navigate('/ppe/new')} sx={{ mt: 1 }}>
                          Create your first request
                        </Button>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((req) => (
                  <TableRow
                    key={req.id}
                    hover
                    onClick={() => navigate(`/ppe/${req.id}`)}
                    sx={{ cursor: 'pointer', '&:last-child td': { border: 0 } }}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {req.employeeName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {req.employeeNumber}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                        {req.items?.map((item) => (
                          <Chip key={item.id} label={item.name} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                        ))}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {req.dateGiven ? dayjs(req.dateGiven).format('DD/MM/YYYY') : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {dayjs(req.dueDate).format('DD/MM/YYYY')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <StatusChip status={req.status} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{req.requestedByName}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{req.reviewedByName || '—'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {dayjs(req.createdAt).format('DD/MM/YYYY')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Box>
  );
}
