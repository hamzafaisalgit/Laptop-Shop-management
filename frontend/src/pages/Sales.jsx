import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, Search, FileText, Download, XCircle, ShoppingCart, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { currency, date, statusColor } from '@/lib/formatters';
import api from '@/lib/api';

function useDebounce(val, delay = 350) {
  const [d, setD] = useState(val);
  useEffect(() => { const t = setTimeout(() => setD(val), delay); return () => clearTimeout(t); }, [val, delay]);
  return d;
}

export default function Sales() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sales, setSales] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const dSearch = useDebounce(search);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/sales', {
        params: {
          search: dSearch || undefined,
          paymentMethod: paymentMethod || undefined,
          from: from || undefined,
          to: to || undefined,
          page,
          limit: 25,
        },
      });
      setSales(res.data.data);
      setTotal(res.data.total);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [dSearch, paymentMethod, from, to, page]);

  const openInvoice = (saleId) => {
    window.open(`/api/sales/${saleId}/invoice`, '_blank');
  };

  const handleCancel = async () => {
    try {
      await api.post(`/sales/${cancelTarget._id}/cancel`, { reason: cancelReason });
      toast.success('Sale cancelled and inventory restored');
      setCancelTarget(null);
      setCancelReason('');
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Cancel failed');
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / 25));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Sales</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{total} invoice{total !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={load} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => navigate('/sales/new')}>
            <Plus className="h-4 w-4" /> New Sale
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Invoice #, customer name…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
        </div>
        <Select value={paymentMethod} onChange={(e) => { setPaymentMethod(e.target.value); setPage(1); }} className="w-40">
          <option value="">All payment</option>
          {['Cash', 'Card', 'Bank Transfer', 'Cheque'].map((m) => <option key={m} value={m}>{m}</option>)}
        </Select>
        <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="w-36" title="From date" />
        <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="w-36" title="To date" />
        {(from || to || paymentMethod || search) && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setPaymentMethod(''); setFrom(''); setTo(''); setPage(1); }}>
            Clear filters
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
            <tr>
              {['Invoice', 'Date', 'Customer', 'Items', 'Total', user?.role === 'admin' ? 'Profit' : null, 'Payment', 'Salesperson', 'Status', ''].filter(Boolean).map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={10} className="py-12 text-center text-slate-400">Loading…</td></tr>}
            {!loading && sales.length === 0 && (
              <tr><td colSpan={10} className="py-12 text-center">
                <ShoppingCart className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600 mb-3" />
                <p className="text-slate-500 dark:text-slate-400 font-medium">No sales yet</p>
                <Button className="mt-3" onClick={() => navigate('/sales/new')}>Make first sale</Button>
              </td></tr>
            )}
            {!loading && sales.map((s) => (
              <tr key={s._id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-indigo-600 dark:text-indigo-400 font-medium">{s.invoiceNumber}</td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">{date(s.saleDate)}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900 dark:text-slate-100">{s.customer.name}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{s.customer.phone}</p>
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                  <p>{s.items.length} laptop{s.items.length !== 1 ? 's' : ''}</p>
                  {s.items[0] && <p className="text-xs text-slate-400 dark:text-slate-500">{s.items[0].brand} {s.items[0].model}</p>}
                </td>
                <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">{currency(s.grandTotal)}</td>
                {user?.role === 'admin' && (
                  <td className="px-4 py-3 text-emerald-600 dark:text-emerald-400 font-medium text-xs">{currency(s.profit)}</td>
                )}
                <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{s.paymentMethod}</td>
                <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{s.salesperson?.name || s.salespersonName}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${s.status === 'cancelled' ? 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'}`}>
                    {s.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => openInvoice(s._id)} title="View Invoice" className="rounded p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-indigo-600">
                      <FileText className="h-4 w-4" />
                    </button>
                    {user?.role === 'admin' && s.status !== 'cancelled' && (
                      <button onClick={() => { setCancelTarget(s); setCancelReason(''); }} title="Cancel Sale" className="rounded p-1.5 text-slate-400 hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-500">
                        <XCircle className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {total > 25 && (
          <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 px-4 py-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">Page {page} of {totalPages} ({total} total)</p>
            <div className="flex gap-1">
              <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>←</Button>
              <Button variant="secondary" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>→</Button>
            </div>
          </div>
        )}
      </div>

      {/* Cancel dialog */}
      {cancelTarget && (
        <Dialog open onClose={() => setCancelTarget(null)}>
          <DialogContent title="Cancel Sale" onClose={() => setCancelTarget(null)} className="max-w-sm">
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
              Cancel <strong>{cancelTarget.invoiceNumber}</strong>? Inventory will be restored.
            </p>
            <Input
              placeholder="Reason (optional)"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="mb-4"
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setCancelTarget(null)}>Keep Sale</Button>
              <Button variant="destructive" onClick={handleCancel}>Cancel Sale</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
