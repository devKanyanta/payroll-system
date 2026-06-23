import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import {
  Box, Typography, Button, Card, CardContent, Alert, Stack, alpha,
  Stepper, Step, StepLabel, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, LinearProgress, Chip,
} from '@mui/material';
import {
  CloudUpload, CheckCircle, PlayArrow, Download, Description, UploadFile, People,
} from '@mui/icons-material';
import { employeeImportService } from '../services/employeeImportService';

const steps = ['Download Template', 'Upload File', 'Review Results', 'Complete'];

export default function EmployeeImport() {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [file, setFile] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [processingResult, setProcessingResult] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const uploadMutation = useMutation({
    mutationFn: (uploadFile) => employeeImportService.upload(uploadFile),
    onSuccess: (res) => {
      setImportResult(res.data);
      setActiveStep(2);
      setUploading(false);
    },
    onError: (err) => {
      setError(err.response?.data?.message || 'Upload failed');
      setUploading(false);
    },
  });

  const processMutation = useMutation({
    mutationFn: (id) => employeeImportService.process(id),
    onSuccess: (res) => {
      setProcessingResult(res.data);
      setActiveStep(3);
      setProcessing(false);
    },
    onError: (err) => {
      setError(err.response?.data?.message || 'Processing failed');
      setProcessing(false);
    },
  });

  const handleDownloadTemplate = async () => {
    try {
      const res = await employeeImportService.downloadTemplate();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'employee-import-template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to download template');
    }
  };

  const handleUpload = () => {
    if (!file) return;
    setUploading(true);
    setError('');
    uploadMutation.mutate(file);
  };

  const handleProcess = () => {
    if (!importResult) return;
    setProcessing(true);
    setError('');
    processMutation.mutate(importResult.id);
  };

  const reset = () => {
    setActiveStep(0);
    setFile(null);
    setImportResult(null);
    setProcessingResult(null);
    setError('');
  };

  const parseErrors = (errorsJson) => {
    if (!errorsJson) return [];
    try {
      return JSON.parse(errorsJson);
    } catch {
      return [];
    }
  };

  return (
    <Box>
      {/* ── Header ── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Employee Import</Typography>
          <Typography variant="body2" color="text.secondary">
            Import or update employee records in bulk from an Excel spreadsheet
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<People />} onClick={() => navigate('/employees')}>
          View Employees
        </Button>
      </Box>

      {/* ── Stepper Card ── */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stepper activeStep={activeStep} sx={{ mb: 4, mt: 1 }}>
            {steps.map((label, idx) => (
              <Step key={label}>
                <StepLabel
                  optional={
                    <Typography variant="caption" color="text.disabled">
                      {idx === 0 ? '.xlsx file' : idx === 1 ? 'upload' : idx === 2 ? 'verify' : 'done'}
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

          {/* ── Step 0: Download Template ── */}
          {activeStep === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Box sx={{
                width: 80, height: 80, borderRadius: 2,
                bgcolor: alpha('#2563eb', 0.1),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                mx: 'auto', mb: 2.5,
              }}>
                <Description sx={{ fontSize: 40, color: '#2563eb' }} />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                Step 1: Download the Excel Template
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 540, mx: 'auto', lineHeight: 1.6 }}>
                Download the employee import template, fill in your employee data, then upload it in the next step.
                The template includes columns for employee numbers, names, NRC, position, department, and more.
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
                maxWidth: 480, mx: 'auto', p: 2,
                bgcolor: alpha('#2563eb', 0.04),
                borderRadius: 2,
                border: '1px solid', borderColor: alpha('#2563eb', 0.1),
              }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'left', lineHeight: 1.8 }}>
                  <strong>Template columns:</strong><br />
                  NAMES, NRC, EMPLOYEE NUMBER, JOB TITLE, SITE, RATE/HRS,
                  SORT CODE, ACCOUNT NUMBER, PHONE, DEPARTMENT, EMPLOYMENT TYPE, SALARY TYPE, DATE HIRED
                </Typography>
              </Box>

              <Box sx={{ mt: 3 }}>
                <Button variant="outlined" onClick={() => setActiveStep(1)} sx={{ px: 3 }}>
                  I have the file — Next
                </Button>
              </Box>
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
                Step 2: Upload Your Excel File
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Select the completed employee import template (.xlsx) from your computer
              </Typography>

              <Box
                sx={{
                  border: '2px dashed',
                  borderColor: file ? alpha('#2563eb', 0.4) : alpha('#6b7280', 0.25),
                  borderRadius: 2,
                  p: 4,
                  mb: 3,
                  maxWidth: 480,
                  mx: 'auto',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  bgcolor: file ? alpha('#2563eb', 0.04) : 'transparent',
                  '&:hover': {
                    borderColor: '#2563eb',
                    bgcolor: alpha('#2563eb', 0.04),
                  },
                }}
                onClick={() => document.getElementById('file-upload').click()}
              >
                <input
                  accept=".xlsx,.xls"
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
                <Button onClick={() => setActiveStep(0)} variant="outlined">
                  Back
                </Button>
                <Button
                  variant="contained"
                  disabled={!file || uploading}
                  onClick={handleUpload}
                  startIcon={<CloudUpload />}
                >
                  {uploading ? 'Uploading...' : 'Upload'}
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
                  <strong>{importResult.fileName}</strong> uploaded successfully with <strong>{importResult.totalRows || 0}</strong> rows.
                  Click "Process Import" below to parse the file and create or update employee records.
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
                    Processing employee data...
                  </Typography>
                </Box>
              )}
            </Box>
          )}

          {/* ── Step 3: Complete ── */}
          {activeStep === 3 && processingResult && (
            <Box sx={{ py: 2 }}>
              <Alert
                icon={<CheckCircle fontSize="small" />}
                severity={
                  processingResult.errorRows > 0 && processingResult.successRows === 0 ? 'error'
                    : processingResult.errorRows > 0 ? 'warning' : 'success'
                }
                sx={{ mb: 3 }}
              >
                <Box>
                  <Typography variant="body2" fontWeight={600}>
                    Import complete — {processingResult.totalRows} rows processed
                  </Typography>
                  <Stack direction="row" spacing={1.5} sx={{ mt: 0.5 }} flexWrap="wrap">
                    <Chip
                      label={`${processingResult.successRows} imported/updated`}
                      size="small"
                      sx={{ color: '#059669', bgcolor: '#d1fae5', fontWeight: 600, fontSize: '0.75rem' }}
                    />
                    {processingResult.errorRows > 0 && (
                      <Chip
                        label={`${processingResult.errorRows} with errors`}
                        size="small"
                        sx={{ color: '#dc2626', bgcolor: '#fee2e2', fontWeight: 600, fontSize: '0.75rem' }}
                      />
                    )}
                  </Stack>
                </Box>
              </Alert>

              {processingResult.errorRows > 0 && processingResult.errors && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1, color: '#dc2626' }}>
                    Error Details
                  </Typography>
                  <TableContainer sx={{ maxHeight: 240, border: '1px solid', borderColor: '#fee2e2', borderRadius: 1 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700, bgcolor: '#fef2f2' }}>Row</TableCell>
                          <TableCell sx={{ fontWeight: 700, bgcolor: '#fef2f2' }}>Error</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {parseErrors(processingResult.errors).map((err, idx) => (
                          <TableRow key={idx}>
                            <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{err.row}</TableCell>
                            <TableCell sx={{ color: 'error.main', fontSize: '0.8125rem' }}>{err.message}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}

              <Alert severity="info" sx={{ mb: 3 }}>
                <Typography variant="body2">
                  Employees created or updated via import will have a placeholder email.
                  You can edit employee details later to add email addresses.
                </Typography>
              </Alert>

              <Stack direction="row" spacing={2} justifyContent="flex-end">
                <Button onClick={reset} variant="outlined">
                  Import Another File
                </Button>
                <Button
                  variant="contained"
                  onClick={() => navigate('/employees')}
                  startIcon={<People />}
                  sx={{ px: 3 }}
                >
                  View Employees
                </Button>
              </Stack>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
