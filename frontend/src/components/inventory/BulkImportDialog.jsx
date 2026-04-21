import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, GitMerge, Download, Loader2 } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import * as XLSX from 'xlsx';

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
        active
          ? 'border-indigo-600 text-indigo-600'
          : 'border-transparent text-slate-500 hover:text-slate-700'
      )}
    >
      {children}
    </button>
  );
}

export default function BulkImportDialog({ open, onClose, onImported }) {
  const [step, setStep] = useState(1); // 1=upload, 2=preview, 3=done
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState(null);
  const [tab, setTab] = useState('valid');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post('/laptops/import/preview', formData);
      setPreview(res.data);
      setStep(2);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to parse file');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleCommit = async () => {
    setImporting(true);
    try {
      const res = await api.post('/laptops/import/commit', { rows: preview.valid });
      setResult(res.data);
      setStep(3);
      onImported?.();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const downloadErrors = () => {
    const rows = preview.errors.map((e) => ({
      Line: e.line,
      Description: e.sku,
      Errors: e.errors.join('; '),
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Errors');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const blob = new Blob([buf], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'import_errors.xlsx'; a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => { setStep(1); setPreview(null); setResult(null); setTab('valid'); };

  const mergeCount = preview?.valid?.filter((r) => r.mergeTargetId).length ?? 0;
  const newCount = (preview?.valid?.length ?? 0) - mergeCount;

  return (
    <Dialog open={open} onClose={() => { onClose(); reset(); }}>
      <DialogContent title="Bulk Import Laptops" onClose={() => { onClose(); reset(); }} className="max-w-3xl">
        {step === 1 && (
          <div className="space-y-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={cn(
                'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed py-12 transition-colors',
                dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/40'
              )}
            >
              <Upload className="h-8 w-8 text-slate-400" />
              <div className="text-center">
                <p className="text-sm font-medium text-slate-700">Drop your .xlsx file here, or click to browse</p>
                <p className="text-xs text-slate-400 mt-1">Only .xlsx format supported</p>
              </div>
              <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <FileSpreadsheet className="h-4 w-4 text-indigo-500" />
                Download the template to see required columns
              </div>
              <a href="/api/laptops/import/template" download className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
                Download Template
              </a>
            </div>
          </div>
        )}

        {step === 2 && preview && (
          <div className="space-y-4">
            {/* Summary bar */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50', label: `${newCount} will create`, },
                { icon: GitMerge, color: 'text-indigo-600', bg: 'bg-indigo-50', label: `${mergeCount} will merge`, },
                { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50', label: `${preview.errors.length} errors`, },
              ].map(({ icon: Icon, color, bg, label }) => (
                <div key={label} className={cn('flex items-center gap-2 rounded-lg p-3', bg)}>
                  <Icon className={cn('h-5 w-5', color)} />
                  <span className={cn('text-sm font-medium', color)}>{label}</span>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div className="border-b border-slate-200">
              <TabBtn active={tab === 'valid'} onClick={() => setTab('valid')}>
                Create ({newCount})
              </TabBtn>
              <TabBtn active={tab === 'merge'} onClick={() => setTab('merge')}>
                Merge ({mergeCount})
              </TabBtn>
              <TabBtn active={tab === 'errors'} onClick={() => setTab('errors')}>
                Errors ({preview.errors.length})
              </TabBtn>
            </div>

            <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200">
              {tab === 'valid' && (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50">
                    <tr>
                      {['Brand', 'Model', 'Condition', 'Specs', 'Qty', 'Selling Price'].map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-medium text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.valid.filter((r) => !r.mergeTargetId).map((r, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="px-3 py-2">{r.row.brand}</td>
                        <td className="px-3 py-2">{r.row.model}</td>
                        <td className="px-3 py-2">{r.row.condition}</td>
                        <td className="px-3 py-2 text-slate-400 text-xs">{[r.row.specs?.processor, r.row.specs?.ram, r.row.specs?.storage].filter(Boolean).join(' / ')}</td>
                        <td className="px-3 py-2">{r.row.quantity}</td>
                        <td className="px-3 py-2">PKR {r.row.sellingPrice?.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {tab === 'merge' && (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50">
                    <tr>
                      {['Brand / Model', 'Incoming Qty', 'Merges Into', 'Existing Qty'].map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-medium text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.valid.filter((r) => r.mergeTargetId).map((r, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="px-3 py-2">{r.row.brand} {r.row.model}</td>
                        <td className="px-3 py-2 font-medium text-indigo-600">+{r.row.quantity}</td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-500">{r.mergeTargetSku}</td>
                        <td className="px-3 py-2">{r.mergeTargetQty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {tab === 'errors' && (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50">
                    <tr>
                      {['Line', 'Description', 'Errors'].map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-medium text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.errors.map((e, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="px-3 py-2 text-red-500 font-medium">{e.line}</td>
                        <td className="px-3 py-2">{e.sku}</td>
                        <td className="px-3 py-2 text-red-600 text-xs">{e.errors.join('; ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div className="flex gap-2">
                <Button variant="secondary" onClick={reset}>← Back</Button>
                {preview.errors.length > 0 && (
                  <Button variant="secondary" onClick={downloadErrors}>
                    <Download className="h-4 w-4" /> Download error file
                  </Button>
                )}
              </div>
              <Button onClick={handleCommit} disabled={importing || preview.valid.length === 0}>
                {importing && <Loader2 className="h-4 w-4 animate-spin" />}
                Import {preview.valid.length} laptop{preview.valid.length !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        )}

        {step === 3 && result && (
          <div className="py-6 text-center space-y-4">
            <div className="flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle className="h-8 w-8 text-emerald-600" />
              </div>
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-900">Import complete!</p>
              <p className="text-sm text-slate-500 mt-1">
                {result.created} created · {result.merged} merged · {result.skipped} skipped
              </p>
            </div>
            <Button onClick={() => { onClose(); reset(); }}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
