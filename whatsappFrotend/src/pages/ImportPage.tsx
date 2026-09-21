import React, { useState } from 'react';
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle, ArrowRight, Download, RefreshCw } from 'lucide-react';
import api from '../api';

export const ImportPage: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({
    phone: '',
    name: '',
    email: '',
    tags: '',
    notes: '',
  });
  const [duplicateStrategy, setDuplicateStrategy] = useState<'SKIP' | 'UPDATE'>('SKIP');
  const [loading, setLoading] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    setLoading(true);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await api.post('/imports/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data.success) {
        setAnalysis(res.data);
        setMapping(res.data.suggestedMapping || {});
      }
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to analyze import file.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartImport = async () => {
    if (!file || !mapping.phone) return alert('Phone number column mapping is required');

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mapping', JSON.stringify(mapping));
    formData.append('duplicate_strategy', duplicateStrategy);

    try {
      const res = await api.post('/imports/process', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data.success) {
        setImportResult(res.data);
      }
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Import processing failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadErrorReport = async () => {
    if (!importResult?.importId) return;
    try {
      const res = await api.get(`/imports/${importResult.importId}/errors`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `import_errors_${importResult.importId}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('Failed to download error report.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-100">Contact Import Engine</h2>
        <p className="text-xs text-slate-400 mt-1">
          Upload CSV or XLSX spreadsheets with automatic column mapping, E.164 phone validation & duplicate handling
        </p>
      </div>

      {/* Step 1: Upload File */}
      {!analysis && !importResult && (
        <div className="p-8 rounded-xl border-2 border-dashed border-slate-800 bg-slate-950/40 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
            <UploadCloud className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-200">Drag and drop CSV or Excel file</h3>
            <p className="text-xs text-slate-500 mt-1">Supports .csv, .xlsx, .xls files up to 10MB</p>
          </div>
          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white cursor-pointer shadow-lg shadow-blue-600/20 transition-all">
            <FileSpreadsheet className="w-4 h-4" />
            Select File
            <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileSelect} className="hidden" />
          </label>
        </div>
      )}

      {/* Step 2: Column Header Mapping */}
      {analysis && !importResult && (
        <div className="space-y-6">
          <div className="p-5 rounded-xl border border-slate-800 bg-slate-950/40 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-100">{analysis.fileName}</h3>
                <p className="text-xs text-slate-400">{analysis.totalRows} records detected in file</p>
              </div>
              <button
                onClick={() => {
                  setFile(null);
                  setAnalysis(null);
                }}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                Change File
              </button>
            </div>

            {/* Field Mapping Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">WhatsApp Phone Number Column *</label>
                <select
                  value={mapping.phone}
                  onChange={(e) => setMapping({ ...mapping, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100"
                >
                  <option value="">Select column...</option>
                  {analysis.headers?.map((h: string) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Contact Name Column</label>
                <select
                  value={mapping.name}
                  onChange={(e) => setMapping({ ...mapping, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100"
                >
                  <option value="">Select column (optional)...</option>
                  {analysis.headers?.map((h: string) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Email Column</label>
                <select
                  value={mapping.email}
                  onChange={(e) => setMapping({ ...mapping, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100"
                >
                  <option value="">Select column (optional)...</option>
                  {analysis.headers?.map((h: string) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Tags Column (Comma-separated)</label>
                <select
                  value={mapping.tags}
                  onChange={(e) => setMapping({ ...mapping, tags: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100"
                >
                  <option value="">Select column (optional)...</option>
                  {analysis.headers?.map((h: string) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Duplicate Strategy Selection */}
            <div className="pt-2 border-t border-slate-800">
              <label className="block text-xs font-semibold text-slate-300 mb-2">Duplicate Phone Handling</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="radio"
                    name="duplicate"
                    value="SKIP"
                    checked={duplicateStrategy === 'SKIP'}
                    onChange={() => setDuplicateStrategy('SKIP')}
                    className="text-blue-600 bg-slate-900 border-slate-800"
                  />
                  Skip existing contacts
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="radio"
                    name="duplicate"
                    value="UPDATE"
                    checked={duplicateStrategy === 'UPDATE'}
                    onChange={() => setDuplicateStrategy('UPDATE')}
                    className="text-blue-600 bg-slate-900 border-slate-800"
                  />
                  Update existing contacts with file data
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              disabled={loading || !mapping.phone}
              onClick={handleStartImport}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-lg shadow-blue-600/20 disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              Execute Contact Import
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Import Complete Summary */}
      {importResult && (
        <div className="p-6 rounded-xl border border-slate-800 bg-slate-950/40 space-y-6">
          <div className="flex items-center gap-3 text-emerald-400">
            <CheckCircle2 className="w-8 h-8" />
            <div>
              <h3 className="text-base font-bold text-slate-100">Contact Import Completed Successfully</h3>
              <p className="text-xs text-slate-400">All rows have been processed and stored in database</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-slate-900 border border-slate-800">
              <p className="text-[10px] uppercase font-semibold text-slate-400">Total Rows</p>
              <p className="text-xl font-bold text-slate-100 mt-1">{importResult.totalRows}</p>
            </div>
            <div className="p-4 rounded-lg bg-slate-900 border border-slate-800">
              <p className="text-[10px] uppercase font-semibold text-slate-400">New Created</p>
              <p className="text-xl font-bold text-emerald-400 mt-1">{importResult.successfulRows}</p>
            </div>
            <div className="p-4 rounded-lg bg-slate-900 border border-slate-800">
              <p className="text-[10px] uppercase font-semibold text-slate-400">Updated / Skipped</p>
              <p className="text-xl font-bold text-blue-400 mt-1">{importResult.updatedRows + importResult.skippedRows}</p>
            </div>
            <div className="p-4 rounded-lg bg-slate-900 border border-slate-800">
              <p className="text-[10px] uppercase font-semibold text-slate-400">Failed / Errors</p>
              <p className="text-xl font-bold text-rose-400 mt-1">{importResult.failedRows}</p>
            </div>
          </div>

          {importResult.failedRows > 0 && (
            <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-400 text-xs">
                <AlertTriangle className="w-4 h-4" />
                <span>{importResult.failedRows} rows failed due to phone format or invalid values</span>
              </div>
              <button
                onClick={handleDownloadErrorReport}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white"
              >
                <Download className="w-3.5 h-3.5" />
                Download Error CSV Report
              </button>
            </div>
          )}

          <div className="pt-4 border-t border-slate-800 flex justify-end">
            <button
              onClick={() => {
                setFile(null);
                setAnalysis(null);
                setImportResult(null);
              }}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200"
            >
              Import Another File
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
