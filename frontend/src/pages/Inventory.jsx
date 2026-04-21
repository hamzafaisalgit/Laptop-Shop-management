import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Plus, Upload, Search, AlertTriangle, Pencil, Trash2,
  ChevronLeft, ChevronRight, Minus, Package,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import LaptopFormDialog from '@/components/inventory/LaptopFormDialog';
import BulkImportDialog from '@/components/inventory/BulkImportDialog';
import { useAuth } from '@/hooks/useAuth';
import { useInventory } from '@/hooks/useInventory';
import { currency, compact, statusColor, conditionColor } from '@/lib/formatters';
import api from '@/lib/api';

function useDebounce(value, delay = 350) {
  const [deb, setDeb] = useState(value);
  useEffect(() => { const t = setTimeout(() => setDeb(value), delay); return () => clearTimeout(t); }, [value, delay]);
  return deb;
}

export default function Inventory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [condition, setCondition] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editLaptop, setEditLaptop] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const dSearch = useDebounce(search);

  const { data, total, loading, refetch } = useInventory({
    search: dSearch || undefined,
    condition: condition || undefined,
    status: status || undefined,
    page,
    limit: 25,
  });

  // Optimistic quantity update
  const [qtyLoading, setQtyLoading] = useState({});
  const handleQty = async (laptop, delta) => {
    setQtyLoading((p) => ({ ...p, [laptop._id]: true }));
    // optimistic
    const origData = [...data];
    try {
      await api.patch(`/laptops/${laptop._id}/quantity`, { delta });
      refetch();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed');
    } finally {
      setQtyLoading((p) => ({ ...p, [laptop._id]: false }));
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/laptops/${deleteTarget._id}`);
      toast.success('Laptop archived');
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Delete failed');
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / 25));
  const isLowStock = (l) => l.trackingMode === 'batch' && l.quantity <= l.lowStockThreshold;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Inventory</h1>
          <p className="text-sm text-slate-500 mt-0.5">{total} laptop{total !== 1 ? 's' : ''} in stock</p>
        </div>
        {user?.role === 'admin' && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" /> Bulk Import
            </Button>
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> Add Laptop
            </Button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="mb-4 flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search SKU, brand, model, serial…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Select value={condition} onChange={(e) => { setCondition(e.target.value); setPage(1); }} className="w-36">
          <option value="">All conditions</option>
          {['New', 'Used', 'Refurbished', 'Open-box'].map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-36">
          <option value="">All statuses</option>
          {['in_stock', 'sold', 'reserved', 'damaged'].map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              {['SKU', 'Brand / Model', 'Condition', 'Specs', 'Qty', user?.role === 'admin' ? 'Cost / Sell' : 'Price', 'Status', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} className="py-16 text-center text-slate-400">Loading…</td></tr>
            )}
            {!loading && data.length === 0 && (
              <tr>
                <td colSpan={8} className="py-16 text-center">
                  <Package className="mx-auto h-10 w-10 text-slate-300 mb-3" />
                  <p className="text-slate-500 font-medium">No laptops found</p>
                  <p className="text-slate-400 text-xs mt-1">Add a laptop or adjust your filters</p>
                </td>
              </tr>
            )}
            {!loading && data.map((laptop) => (
              <tr
                key={laptop._id}
                className={`border-t border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer ${isLowStock(laptop) ? 'border-l-4 border-l-amber-400' : ''}`}
                onClick={() => navigate(`/inventory/${laptop._id}`)}
              >
                <td className="px-4 py-3 font-mono text-xs text-slate-600">{laptop.sku}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{laptop.brand} {laptop.model}</p>
                  {laptop.modelNumber && <p className="text-xs text-slate-400">{laptop.modelNumber}</p>}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${conditionColor[laptop.condition] || ''}`}>
                    {laptop.condition}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500 max-w-40 truncate">{compact(laptop.specs)}</td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  {laptop.trackingMode === 'batch' ? (
                    <div className="flex items-center gap-1.5">
                      {user?.role === 'admin' && (
                        <button
                          disabled={qtyLoading[laptop._id] || laptop.quantity === 0}
                          onClick={() => handleQty(laptop, -1)}
                          className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                      )}
                      <span className={`min-w-6 text-center font-semibold ${laptop.quantity === 0 ? 'text-red-500' : isLowStock(laptop) ? 'text-amber-600' : 'text-slate-900'}`}>
                        {laptop.quantity}
                        {isLowStock(laptop) && laptop.quantity > 0 && (
                          <AlertTriangle className="inline ml-1 h-3 w-3 text-amber-500" />
                        )}
                      </span>
                      <button
                        disabled={qtyLoading[laptop._id]}
                        onClick={() => handleQty(laptop, 1)}
                        className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-slate-700">1 unit</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs">
                  {user?.role === 'admin' ? (
                    <>
                      <p className="text-slate-400">Cost: {currency(laptop.costPrice)}</p>
                      <p className="font-medium text-slate-900">Sell: {currency(laptop.sellingPrice)}</p>
                    </>
                  ) : (
                    <p className="font-medium text-slate-900">{currency(laptop.sellingPrice)}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[laptop.status] || ''}`}>
                    {laptop.status}
                  </span>
                </td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setEditLaptop(laptop)}
                      className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {user?.role === 'admin' && (
                      <button
                        onClick={() => setDeleteTarget(laptop)}
                        className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                        title="Archive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {total > 25 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
            <p className="text-xs text-slate-500">Showing {(page - 1) * 25 + 1}–{Math.min(page * 25, total)} of {total}</p>
            <div className="flex gap-1">
              <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="secondary" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <LaptopFormDialog open={addOpen} onClose={() => setAddOpen(false)} onSaved={() => refetch()} />
      {editLaptop && (
        <LaptopFormDialog
          open
          laptop={editLaptop}
          onClose={() => setEditLaptop(null)}
          onSaved={() => { refetch(); setEditLaptop(null); }}
        />
      )}
      <BulkImportDialog open={importOpen} onClose={() => setImportOpen(false)} onImported={() => refetch()} />

      {/* Delete confirm */}
      {deleteTarget && (
        <Dialog open onClose={() => setDeleteTarget(null)}>
          <DialogContent title="Archive laptop?" onClose={() => setDeleteTarget(null)} className="max-w-sm">
            <p className="text-sm text-slate-600 mb-4">
              Archive <strong>{deleteTarget.brand} {deleteTarget.model}</strong> ({deleteTarget.sku})?
              It will be hidden from inventory but preserved in sales history.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete}>Archive</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
