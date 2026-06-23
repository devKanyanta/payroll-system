import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import {
  Box, Typography, Button, Card, CardContent, Alert,
  Stepper, Step, StepLabel, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, LinearProgress,
} from '@mui/material';
import {
  CloudUpload, CheckCircle, PlayArrow, Download,
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
      <Typography variant="h4" sx={{ mb: 0.5 }}>Employee Import</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Import or update employee records from an Excel file
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}><StepLabel>{label}</StepLabel></Step>
            ))}
          </Stepper>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          {activeStep === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Download sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
              <Typography variant="h6" sx={{ mb: 1 }}>
                Step 1: Download the Template
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 500, mx: 'auto' }}>
                Download the employee import template (.xlsx), fill in your employee data,
                then upload it in the next step. Required columns: NAMES and NRC.
              </Typography>
              <Button
                variant="contained"
                startIcon={<Download />}
                onClick={handleDownloadTemplate}
                sx={{ mb: 2 }}
              >
                Download Template
              </Button>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 3 }}>
                The template includes columns for NAMES, NRC, EMPLOYEE NUMBER, JOB TITLE, SITE, RATE/HRS,
                SORT CODE, ACCOUNT NUMBER, PHONE, DEPARTMENT, EMPLOYMENT TYPE, SALARY TYPE, and DATE HIRED.
              </Typography>
              <Button
                variant="outlined"
                onClick={() => setActiveStep(1)}
              >
                Next: Upload File
              </Button>
            </Box>
          )}

          {activeStep === 1 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CloudUpload sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
              <Typography variant="h6" sx={{ mb: 1 }}>
                Step 2: Upload Your File
              </Typography>
              <input
                accept=".xlsx,.xls"
                style={{ display: 'none' }}
                id="file-upload"
                type="file"
                onChange={(e) => setFile(e.target.files[0])}
              />
              <label htmlFor="file-upload">
                <Button variant="outlined" component="span" startIcon={<CloudUpload />} sx={{ mb: 2 }}>
                  Choose File
                </Button>
              </label>
              {file && (
                <Typography variant="body2" sx={{ mb: 2 }}>
                  Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                Upload a file in the employee import template format (.xlsx)
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                <Button onClick={() => setActiveStep(0)}>Back</Button>
                <Button variant="contained" disabled={!file || uploading} onClick={handleUpload}>
                  {uploading ? 'Uploading...' : 'Upload & Process'}
                </Button>
              </Box>
              {uploading && <LinearProgress sx={{ mt: 2 }} />}
            </Box>
          )}

          {activeStep === 2 && importResult && (
            <Box>
              <Alert severity="info" sx={{ mb: 2 }}>
                File uploaded successfully. Click "Process Import" to parse the file and create/update employee records.
              </Alert>
              <Typography variant="body2" sx={{ mb: 2 }}>
                File: {importResult.fileName}
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button onClick={reset}>Cancel</Button>
                <Button variant="contained" onClick={handleProcess} disabled={processing}
                  startIcon={<PlayArrow />}>
                  {processing ? 'Processing...' : 'Process Import'}
                </Button>
              </Box>
              {processing && <LinearProgress sx={{ mt: 2 }} />}
            </Box>
          )}

          {activeStep === 3 && processingResult && (
            <Box>
              <Alert
                severity={processingResult.errorRows > 0 && processingResult.successRows === 0 ? 'error'
                  : processingResult.errorRows > 0 ? 'warning' : 'success'}
                sx={{ mb: 2 }}
              >
                {processingResult.totalRows} rows processed: {processingResult.successRows} imported/updated,
                {processingResult.errorRows} with errors
              </Alert>

              {processingResult.errorRows > 0 && processingResult.errors && (
                <TableContainer sx={{ mb: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>Row</strong></TableCell>
                        <TableCell><strong>Error</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {parseErrors(processingResult.errors).map((err, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{err.row}</TableCell>
                          <TableCell sx={{ color: 'error.main' }}>{err.message}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  Employees created/updated via import will have a placeholder email (null). 
                  You can edit employee details later to add email addresses.
                </Typography>
              </Alert>

              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button onClick={reset}>Import Another File</Button>
                <Button variant="contained" onClick={() => navigate('/employees')}
                  startIcon={<CheckCircle />}>
                  View Employees
                </Button>
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
