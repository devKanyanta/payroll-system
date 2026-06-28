import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Button, Card, CardContent, Alert, Stack, alpha,
  Stepper, Step, StepLabel, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Select, MenuItem,
  FormControl, InputLabel, LinearProgress, Chip, Paper,
} from '@mui/material';
import {
  CloudUpload, CheckCircle, PlayArrow, Download, Description, UploadFile,
  Cancel, WarningAmber,
} from '@mui/icons-material';
import { payrollRunService } from '../services/payrollRunService';
import apiService from '../services/api';
import dayjs from 'dayjs';

const steps = ['Select Payroll Run', 'Upload File', 'Review Results', 'Import Results', 'Complete'];

export default function PayrollImport() {
  const [activeStep, setActiveStep] = useState(0);
  const [selectedRunId, setSelectedRunId] = useState('');
  const [file, setFile] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [processingResult, setProcessingResult] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const queryClient = useQueryClient();

  const { data: payrollRuns } = useQuery({
    queryKey: ['payroll-runs-mini'],
    queryFn: async () => {
      const res = await payrollRunService.getAll({ status: 'DRAFT', size: 50 });
      return res.data.content;
    },
  });

  const handleDownloadTemplate = async () => {
    try {
      const res = await apiService.get('/payroll-import/template', {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'payroll-import-template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to download template');
    }
  };

  const handleUpload = async () => {
    if (!file || !selectedRunId) return;
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('payrollRunId', selectedRunId);
      const res = await apiService.post('/payroll-import/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportResult(res.data);
      setActiveStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleProcess = async () => {
    if (!importResult) return;
    setProcessing(true);
    setError('');
    try {
      const res = await apiService.post(`/payroll-import/${importResult.id}/process`);
      setProcessingResult(res.data);
      setActiveStep(3);
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
    } catch (err) {
      setError(err.response?.data?.message || 'Processing failed');
    } finally {
      setProcessing(false);
    }
  };

  const reset = () => {
    setActiveStep(0);
    setSelectedRunId('');
    setFile(null);
    setImportResult(null);
    setProcessingResult(null);
    setError('');
  };

  return (
    <Box>
      {/* ── Header ── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Payroll Import</Typography>
          <Typography variant="body2" color="text.secondary">
            Import employee payroll data from an Excel file using the PAYROLL TEMPLATE format
          </Typography>
        </Box>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stepper activeStep={activeStep} sx={{ mb: 4, mt: 1 }}>
            {steps.map((label, idx) => (
              <Step key={label}>
                <StepLabel
                  optional={
                    <Typography variant="caption" color="text.disabled">
                      {idx === 0 ? 'choose run' : idx === 1 ? 'upload' : idx === 2 ? 'verify' : idx === 3 ? 'results' : 'done'}
                    </Typography>
                  }
                >
                  {label}
                </StepLabel>
              </Step>
            ))}
          </Stepper>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          {/* ── Step 0: Download Template & Select Run ── */}
          {activeStep === 0 && (
            <Box>
              <Box sx={{ textAlign: 'center', py: 3, mb: 3 }}>
                <Box sx={{
                  width: 80, height: 80, borderRadius: 2,
                  bgcolor: alpha('#2563eb', 0.1),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  mx: 'auto', mb: 2.5,
                }}>
                  <Description sx={{ fontSize: 40, color: '#2563eb' }} />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                  Step 1: Download the Payroll Template
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 540, mx: 'auto', lineHeight: 1.6 }}>
                  Download the PAYROLL TEMPLATE (.xlsx), fill in your employee payroll data,
                  then upload it in the next steps.
                </Typography>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<Download />}
                  onClick={handleDownloadTemplate}
                  sx={{ mb: 3, px: 4, py: 1.2 }}
                >
                  Download Template
                </Button>
                <Box sx={{
                  maxWidth: 500, mx: 'auto', p: 2,
                  bgcolor: alpha('#2563eb', 0.04),
                  borderRadius: 2,
                  border: '1px solid', borderColor: alpha('#2563eb', 0.1),
                  textAlign: 'left',
                }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.8 }}>
                    <strong>Template columns:</strong><br />
                    Employee info (names, NRC, employee number, job title, site, phone, email, bank details)
                    and payroll calculation fields (rate, present days, overtime, etc.)
                  </Typography>
                </Box>
              </Box>

              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2 }}>
                Step 2: Select a Draft Payroll Run
              </Typography>
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>Payroll Run (Draft)</InputLabel>
                <Select
                  value={selectedRunId} label="Payroll Run (Draft)"
                  onChange={(e) => setSelectedRunId(e.target.value)}
                >
                  {payrollRuns?.map((run) => (
                    <MenuItem key={run.id} value={run.id}>
                      {dayjs().month(run.month - 1).format('MMMM')} {run.year}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Stack direction="row" spacing={2} justifyContent="flex-end">
                <Button variant="contained" disabled={!selectedRunId}
                  onClick={() => setActiveStep(1)} sx={{ px: 3 }}>
                  Next — Upload File
                </Button>
              </Stack>
            </Box>
          )}

          {/* ── Step 1: Upload File ── */}
          {activeStep === 1 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Box sx={{
                width: 80, height: 80, borderRadius: 2,
                bgcolor: alpha('#0891b2', 0.1),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                mx: 'auto', mb: 2.5,
              }}>
                <UploadFile sx={{ fontSize: 40, color: '#0891b2' }} />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                Upload Your Completed File
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Select the completed PAYROLL TEMPLATE (.xlsx) from your computer
              </Typography>

              {/* Drop zone */}
              <Box
                sx={{
                  border: '2px dashed',
                  borderColor: file ? alpha('#2563eb', 0.4) : alpha('#6b7280', 0.25),
                  borderRadius: 2, p: 4, mb: 3, maxWidth: 480, mx: 'auto',
                  cursor: 'pointer', transition: 'all 0.2s',
                  bgcolor: file ? alpha('#2563eb', 0.04) : 'transparent',
                  '&:hover': { borderColor: '#2563eb', bgcolor: alpha('#2563eb', 0.04) },
                }}
                onClick={() => document.getElementById('file-upload').click()}
              >
                <input
                  accept=".xlsx,.xls,.csv"
                  style={{ display: 'none' }}
                  id="file-upload"
                  type="file"
                  onChange={(e) => setFile(e.target.files[0])}
                />
                <CloudUpload sx={{ fontSize: 40, color: file ? '#2563eb' : 'text.disabled', mb: 1 }} />
                {file ? (
                  <Box>
                    <Typography variant="body2" fontWeight={600} color="primary">
                      {file.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {(file.size / 1024).toFixed(1)} KB
                    </Typography>
                  </Box>
                ) : (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Drop your file here, or <Typography component="span" color="primary" variant="body2" sx={{ textDecoration: 'underline', cursor: 'pointer' }}>browse</Typography>
                    </Typography>
                    <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: 'block' }}>
                      Only .xlsx files are supported
                    </Typography>
                  </Box>
                )}
              </Box>

              <Stack direction="row" spacing={2} justifyContent="center">
                <Button onClick={() => setActiveStep(0)} variant="outlined">Back</Button>
                <Button variant="contained" disabled={!file || uploading} onClick={handleUpload} startIcon={<CloudUpload />}>
                  {uploading ? 'Uploading...' : 'Upload & Validate'}
                </Button>
              </Stack>
              {uploading && <LinearProgress sx={{ mt: 2 }} />}
            </Box>
          )}

          {/* ── Step 2: Review Results ── */}
          {activeStep === 2 && importResult && (
            <Box sx={{ py: 2 }}>
              <Alert severity="info" icon={<CloudUpload fontSize="small" />} sx={{ mb: 3 }}>
                <Typography variant="body2">
                  <strong>{importResult.fileName}</strong> uploaded successfully. Click "Process Import" below to parse the file and create payroll entries.
                </Typography>
              </Alert>

              <Stack direction="row" spacing={2} justifyContent="flex-end">
                <Button onClick={reset} variant="outlined">Cancel</Button>
                <Button
                  variant="contained"
                  onClick={handleProcess}
                  disabled={processing}
                  startIcon={processing ? undefined : <PlayArrow />}
                  sx={{ px: 3 }}
                >
                  {processing ? 'Processing...' : 'Process Import'}
                </Button>
              </Stack>
              {processing && (
                <Box sx={{ mt: 2 }}>
                  <LinearProgress />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    Processing payroll data...
                  </Typography>
                </Box>
              )}
            </Box>
          )}

          {/* ── Step 3: Import Results ── */}
          {activeStep === 3 && processingResult && (
            <Box sx={{ py: 2 }}>
              {processingResult.status === 'FAILED' || processingResult.errorRows > 0 ? (
                /* ── Import failed with errors ── */
                <Box>
                  <Alert
                    severity="error"
                    icon={<Cancel />}
                    sx={{ mb: 3 }}
                  >
                    <Box>
                      <Typography variant="body1" fontWeight={700} sx={{ mb: 0.5 }}>
                        Import Rejected — {processingResult.errorRows} error{processingResult.errorRows !== 1 ? 's' : ''} found
                      </Typography>
                      <Typography variant="body2" color="error.dark">
                        The import has been rejected because some rows contain errors.
                        Please fix the errors listed below and try again.
                      </Typography>
                      <Stack direction="row" spacing={1.5} sx={{ mt: 1.5 }} flexWrap="wrap">
                        <Chip
                          label={`${processingResult.totalRows} total rows`}
                          size="small"
                          variant="outlined"
                          sx={{ fontWeight: 600, fontSize: '0.75rem' }}
                        />
                        <Chip
                          label={`${processingResult.errorRows} error${processingResult.errorRows !== 1 ? 's' : ''}`}
                          size="small"
                          sx={{ color: '#dc2626', bgcolor: '#fee2e2', fontWeight: 600, fontSize: '0.75rem' }}
                        />
                      </Stack>
                    </Box>
                  </Alert>

                  {processingResult.errorDetails && (
                    <Paper
                      variant="outlined"
                      sx={{
                        borderColor: alpha('#dc2626', 0.3),
                        bgcolor: alpha('#dc2626', 0.03),
                        borderRadius: 2,
                        overflow: 'hidden',
                        mb: 3,
                      }}
                    >
                      <Box sx={{
                        px: 2.5, py: 1.5,
                        borderBottom: '1px solid',
                        borderColor: alpha('#dc2626', 0.15),
                        display: 'flex', alignItems: 'center', gap: 1,
                      }}>
                        <WarningAmber sx={{ fontSize: 18, color: '#dc2626' }} />
                        <Typography variant="subtitle2" fontWeight={700} color="error.dark">
                          Error Details
                        </Typography>
                      </Box>
                      <Box sx={{ px: 2.5, py: 1.5 }}>
                        {processingResult.errorDetails.split('\n').map((errorLine, idx) => (
                          <Box
                            key={idx}
                            sx={{
                              display: 'flex',
                              gap: 1.5,
                              py: 1,
                              borderBottom: idx < processingResult.errorDetails.split('\n').length - 1
                                ? `1px solid ${alpha('#dc2626', 0.08)}`
                                : 'none',
                            }}
                          >
                            <Typography
                              variant="caption"
                              sx={{
                                color: '#dc2626',
                                fontWeight: 800,
                                minWidth: 24,
                                pt: 0.3,
                                fontFamily: 'monospace',
                              }}
                            >
                              {idx + 1}.
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{ color: '#7f1d1d', lineHeight: 1.5 }}
                            >
                              {errorLine}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    </Paper>
                  )}

                  <Stack direction="row" spacing={2} justifyContent="flex-end">
                    <Button onClick={() => setActiveStep(1)} variant="outlined">
                      Upload Different File
                    </Button>
                    <Button onClick={reset} variant="contained" color="error" sx={{ px: 3 }}>
                      Start Over
                    </Button>
                  </Stack>
                </Box>
              ) : (
                /* ── Import succeeded ── */
                <Box>
                  <Alert
                    severity="success"
                    icon={<CheckCircle fontSize="small" />}
                    sx={{ mb: 3 }}
                  >
                    <Box>
                      <Typography variant="body2" fontWeight={600}>
                        {processingResult.totalRows} rows processed successfully
                      </Typography>
                      <Stack direction="row" spacing={1.5} sx={{ mt: 0.5 }} flexWrap="wrap">
                        <Chip
                          label={`${processingResult.successRows} imported`}
                          size="small"
                          sx={{ color: '#059669', bgcolor: '#d1fae5', fontWeight: 600, fontSize: '0.75rem' }}
                        />
                      </Stack>
                    </Box>
                  </Alert>

                  <Stack direction="row" spacing={2} justifyContent="flex-end">
                    <Button onClick={reset} variant="outlined">Import Another File</Button>
                    <Button variant="contained" color="success" startIcon={<CheckCircle />}
                      onClick={() => setActiveStep(4)} sx={{ px: 3 }}>
                      Complete
                    </Button>
                  </Stack>
                </Box>
              )}
            </Box>
          )}

          {/* ── Step 4: Complete ── */}
          {activeStep === 4 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Box sx={{
                width: 80, height: 80, borderRadius: '50%',
                bgcolor: alpha('#059669', 0.12),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                mx: 'auto', mb: 2.5,
              }}>
                <CheckCircle sx={{ fontSize: 40, color: '#059669' }} />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                Import Completed Successfully
              </Typography>
              {processingResult && (
                <Typography color="text.secondary" sx={{ mb: 0.5 }}>
                  {processingResult.successRows} employee{processingResult.successRows !== 1 ? 's' : ''} added to payroll
                </Typography>
              )}
              {processingResult?.errorRows > 0 && (
                <Typography color="warning.main" variant="body2" sx={{ mb: 2 }}>
                  {processingResult.errorRows} row{processingResult.errorRows !== 1 ? 's' : ''} could not be processed
                  (unmatched employees or duplicates)
                </Typography>
              )}
              <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 3 }}>
                <Button variant="outlined" onClick={() => {
                  reset();
                  window.location.href = `/payroll-runs/${selectedRunId}`;
                }}>
                  View Payroll Run
                </Button>
                <Button variant="contained" onClick={reset} sx={{ px: 3 }}>
                  Import Another File
                </Button>
              </Stack>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
