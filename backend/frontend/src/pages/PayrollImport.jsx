import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Button, Card, CardContent, Alert,
  Stepper, Step, StepLabel, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Select, MenuItem,
  FormControl, InputLabel, LinearProgress,
} from '@mui/material';
import { CloudUpload, CheckCircle, PlayArrow } from '@mui/icons-material';
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
      <Typography variant="h4" sx={{ mb: 0.5 }}>Payroll Import</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Import employee payroll data from an Excel file using the PAYROLL TEMPLATE format
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
            <Box>
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
              <Button variant="contained" disabled={!selectedRunId}
                onClick={() => setActiveStep(1)}>
                Next: Upload File
              </Button>
            </Box>
          )}

          {activeStep === 1 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <input
                accept=".xlsx,.xls,.csv"
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
                Upload a file in the PAYROLL TEMPLATE format (.xlsx) with employee payroll data
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                <Button onClick={() => setActiveStep(0)}>Back</Button>
                <Button variant="contained" disabled={!file || uploading} onClick={handleUpload}>
                  {uploading ? 'Uploading...' : 'Upload & Validate'}
                </Button>
              </Box>
              {uploading && <LinearProgress sx={{ mt: 2 }} />}
            </Box>
          )}

          {activeStep === 2 && importResult && (
            <Box>
              <Alert severity="info" sx={{ mb: 2 }}>
                File uploaded successfully. Click "Process Import" to parse the file and create payroll entries.
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
                severity={processingResult.errorRows > 0 ? 'warning' : 'success'}
                sx={{ mb: 2 }}
                action={
                  <Button color="inherit" size="small" onClick={() => setActiveStep(4)}>
                    View Summary
                  </Button>
                }
              >
                {processingResult.totalRows} rows processed: {processingResult.successRows} imported, {processingResult.errorRows} with errors
              </Alert>

              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button onClick={reset}>Import Another File</Button>
                <Button variant="contained" color="success" startIcon={<CheckCircle />}
                  onClick={() => setActiveStep(4)}>
                  Complete
                </Button>
              </Box>
            </Box>
          )}

          {activeStep === 4 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
              <Typography variant="h6">Import Completed Successfully</Typography>
              {processingResult && (
                <Typography color="text.secondary" sx={{ mb: 1 }}>
                  {processingResult.successRows} employee{processingResult.successRows !== 1 ? 's' : ''} added to payroll
                </Typography>
              )}
              {processingResult?.errorRows > 0 && (
                <Typography color="warning.main" variant="body2" sx={{ mb: 2 }}>
                  {processingResult.errorRows} row{processingResult.errorRows !== 1 ? 's' : ''} could not be processed (unmatched employees or duplicates)
                </Typography>
              )}
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 2 }}>
                <Button variant="outlined" onClick={() => {
                  reset();
                  window.location.href = `/payroll-runs/${selectedRunId}`;
                }}>
                  View Payroll Run
                </Button>
                <Button variant="contained" onClick={reset}>Import Another File</Button>
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
