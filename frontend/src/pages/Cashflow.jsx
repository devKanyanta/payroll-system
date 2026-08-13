import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Card, CardContent, Grid, TextField, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Select, MenuItem, FormControl, InputLabel, IconButton, Tooltip,
  Stack, Chip, Divider, Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, alpha, useTheme,
} from '@mui/material';
import {
  Save, Refresh, AccountBalance, TrendingUp, TrendingDown,
  CalendarMonth, CurrencyExchange,
} from '@mui/icons-material';
import { cashflowService } from '../services/cashflowService';
import { useAuth } from '../contexts/AuthContext';
import LoadingScreen from '../components/LoadingScreen';

const SITES = ['Kitwe Invoice', 'Mufulira Smelter', 'Mufulira Mining', 'Chingola'];

const months = [
  { value: 1, label: 'January' }, { value: 2, label: 'February' },
  { value: 3, label: 'March' }, { value: 4, label: 'April' },
  { value: 5, label: 'May' }, { value: 6, label: 'June' },
  { value: 7, label: 'July' }, { value: 8, label: 'August' },
  { value: 9, label: 'September' }, { value: 10, label: 'October' },
  { value: 11, label: 'November' }, { value: 12, label: 'December' },
];

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-ZM', {
    style: 'currency', currency: 'ZMW', minimumFractionDigits: 2,
  }).format(value || 0);

export default function Cashflow() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  // Local form state for revenue entries
  const [revenues, setRevenues] = useState({});
  const [hasChanges, setHasChanges] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [recalcLoading, setRecalcLoading] = useState(false);

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['cashflow-summary', selectedMonth, selectedYear],
    queryFn: async () => {
      const res = await cashflowService.getSummary(selectedMonth, selectedYear);
      return res.data;
    },
  });

  const { data: revenuesData, isLoading: revenuesLoading } = useQuery({
    queryKey: ['cashflow-revenues', selectedMonth, selectedYear],
    queryFn: async () => {
      const res = await cashflowService.getRevenues(selectedMonth, selectedYear);
      return res.data;
    },
  });

  // Initialize form state when revenue data loads
  useEffect(() => {
    if (revenuesData) {
      const revMap = {};
      revenuesData.forEach((rev) => {
        revMap[rev.site] = {
          subTotal: rev.subTotal?.toString() || '0',
          vatRate: rev.vatRate?.toString() || '16.00',
        };
      });
      // Ensure all 4 sites are present
      SITES.forEach((site) => {
        if (!revMap[site]) {
          revMap[site] = { subTotal: '0', vatRate: '16.00' };
        }
      });
      setRevenues(revMap);
      setHasChanges(false);
    }
  }, [revenuesData]);

  const handleSubTotalChange = (site, value) => {
    setRevenues((prev) => ({
      ...prev,
      [site]: { ...prev[site], subTotal: value },
    }));
    setHasChanges(true);
  };

  const handleRecalculate = async () => {
    setRecalcLoading(true);
    try {
      await cashflowService.recalculate(selectedMonth, selectedYear);
      // Recompute totals for every stored revenue this month, then refresh
      queryClient.invalidateQueries({ queryKey: ['cashflow-revenues', selectedMonth, selectedYear] });
      queryClient.invalidateQueries({ queryKey: ['cashflow-summary', selectedMonth, selectedYear] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (error) {
      console.error('Failed to recalculate cashflow totals:', error);
    } finally {
      setRecalcLoading(false);
    }
  };

  const handleSave = async () => {
    setSaveLoading(true);
    try {
      const requests = SITES.map((site) => ({
        site,
        subTotal: parseFloat(revenues[site]?.subTotal || 0),
        vatRate: parseFloat(revenues[site]?.vatRate || 16.00),
        month: selectedMonth,
        year: selectedYear,
      }));

      await cashflowService.batchUpdate(requests);
      setHasChanges(false);
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['cashflow-summary', selectedMonth, selectedYear] });
      queryClient.invalidateQueries({ queryKey: ['cashflow-revenues', selectedMonth, selectedYear] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (error) {
      console.error('Failed to save cashflow data:', error);
    } finally {
      setSaveLoading(false);
    }
  };

  const isLoading = summaryLoading || revenuesLoading;

  if (isLoading && !summary) return <LoadingScreen />;

  const profitColor = summary?.companyProfit >= 0 ? 'success.main' : 'error.main';
  const profitIcon = summary?.companyProfit >= 0 ? <TrendingUp /> : <TrendingDown />;

  return (
    <Box>
      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            Company Cashflow
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage monthly revenue/invoice data per site
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>Month</InputLabel>
            <Select value={selectedMonth} label="Month" onChange={(e) => { setSelectedMonth(e.target.value); setHasChanges(false); }}>
              {months.map((m) => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel>Year</InputLabel>
            <Select value={selectedYear} label="Year" onChange={(e) => { setSelectedYear(e.target.value); setHasChanges(false); }}>
              {[2024, 2025, 2026].map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
            </Select>
          </FormControl>

          <Button
            variant="outlined"
            color="secondary"
            startIcon={recalcLoading ? <CircularProgress size={18} /> : <Refresh />}
            onClick={handleRecalculate}
            disabled={recalcLoading}
          >
            {recalcLoading ? 'Recalculating...' : 'Recalculate Totals'}
          </Button>

          {hasChanges && (
            <Button
              variant="contained"
              color="primary"
              startIcon={saveLoading ? <CircularProgress size={18} /> : <Save />}
              onClick={handleSave}
              disabled={saveLoading}
            >
              {saveLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          )}
        </Stack>
      </Box>

      {/* ── Summary Cards ── */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Box sx={{
                  p: 1.5, borderRadius: 2,
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  color: 'primary.main', display: 'flex',
                }}>
                  <AccountBalance fontSize="large" />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    Total Revenue
                  </Typography>
                  <Typography variant="h5" fontWeight={800}>
                    {formatCurrency(summary?.totalSubMonthlyAccumulated || 0)}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Box sx={{
                  p: 1.5, borderRadius: 2,
                  bgcolor: alpha(theme.palette.warning.main, 0.1),
                  color: 'warning.main', display: 'flex',
                }}>
                  <CurrencyExchange fontSize="large" />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    Employee Gross Pay
                  </Typography>
                  <Typography variant="h5" fontWeight={800}>
                    {formatCurrency(summary?.employeeGrossPay || 0)}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Box sx={{
                  p: 1.5, borderRadius: 2,
                  bgcolor: alpha(profitColor === 'success.main' ? theme.palette.success.main : theme.palette.error.main, 0.1),
                  color: profitColor, display: 'flex',
                }}>
                  {profitIcon}
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    Company Profit
                  </Typography>
                  <Typography variant="h5" fontWeight={800} color={profitColor}>
                    {formatCurrency(summary?.companyProfit || 0)}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Box sx={{
                  p: 1.5, borderRadius: 2,
                  bgcolor: alpha(theme.palette.info.main, 0.1),
                  color: 'info.main', display: 'flex',
                }}>
                  <CalendarMonth fontSize="large" />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    Period
                  </Typography>
                  <Typography variant="h5" fontWeight={800}>
                    {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ── Revenue Entry Form ── */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
            <Typography variant="h6" fontWeight={700}>
              Revenue by Site
            </Typography>
            {hasChanges && (
              <Chip label="Unsaved changes" color="warning" size="small" icon={<Save />} />
            )}
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Site</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Sub Total (ZMW)</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Total (ZMW)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {SITES.map((site) => {
                  const rev = revenues[site] || { subTotal: '0', vatRate: '16.00' };
                  const subTotal = parseFloat(rev.subTotal) || 0;

                  return (
                    <TableRow key={site} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{site}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <TextField
                          type="number"
                          size="small"
                          value={rev.subTotal}
                          onChange={(e) => handleSubTotalChange(site, e.target.value)}
                          InputProps={{
                            sx: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
                          }}
                          sx={{ width: 180 }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          fontWeight={700}
                          sx={{ fontVariantNumeric: 'tabular-nums' }}
                        >
                          {formatCurrency(subTotal)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* ── Cashflow Summary Table ── */}
      {summary && summary.sites && summary.sites.length > 0 && (
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
              Cashflow Summary
            </Typography>

            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Item</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Amount (ZMW)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {summary.sites.map((site) => (
                    <TableRow key={site.site} hover>
                      <TableCell>
                        <Typography variant="body2">{site.site} — Total</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={500} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                          {formatCurrency(site.total)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, borderTop: '2px solid' }}>
                      Total Sub Monthly Accumulated
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, borderTop: '2px solid' }}>
                      <Typography variant="body1" fontWeight={800} color="primary.main">
                        {formatCurrency(summary.totalSubMonthlyAccumulated)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>Employee Gross Pay</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight={600} color="warning.main">
                        {formatCurrency(summary.employeeGrossPay)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, borderTop: '2px solid' }}>
                      <Typography variant="body1" fontWeight={800}>Company Profit</Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ borderTop: '2px solid' }}>
                      <Typography variant="h6" fontWeight={800} color={profitColor}>
                        {formatCurrency(summary.companyProfit)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
