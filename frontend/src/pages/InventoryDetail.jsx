import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Pencil, Package, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import LaptopFormDialog from '@/components/inventory/LaptopFormDialog';
import { useAuth } from '@/hooks/useAuth';
import { currency, date, statusColor, conditionColor } from '@/lib/formatters';
import api from '@/lib/api';

function Row({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
      <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{value}</span>
    </div>
  );
}

export default function InventoryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [laptop, setLaptop] = useState(null);
  const [audit, setAudit] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [qtyInput, setQtyInput] = useState('');
  const [qtyLoading, setQtyLoading] = useState(false);

  const load = async () => {
    try {
      const [laptopRes, auditRes] = await Promise.all([
        api.get(`/laptops/${id}`),
        api.get(`/laptops/${id}/audit`),
      ]);
      setLaptop(laptopRes.data);
      setAudit(auditRes.data);
    } catch {
      toast.error('Failed to load laptop');
      navigate('/inventory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleDelta = async (delta) => {
    setQtyLoading(true);
    try {
      const res = await api.patch(`/laptops/${id}/quantity`, { delta });
      setLaptop(res.data);
      toast.success(`Quantity ${delta > 0 ? 'increased' : 'decreased'}`);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed');
    } finally {
      setQtyLoading(false);
    }
  };

  const handleSetQty = async () => {
    const target = parseInt(qtyInput, 10);
    if (isNaN(target) || target < 0) return toast.error('Enter a valid quantity');
    const delta = target - laptop.quantity;
    if (delta === 0) return;
    await handleDelta(delta);
    setQtyInput('');
  };

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
    </div>
  );

  if (!laptop) return null;

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/inventory')}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{laptop.brand} {laptop.model}</h1>
          <p className="text-sm font-mono text-slate-400 dark:text-slate-500">{laptop.sku}</p>
        </div>
        <Button variant="secondary" onClick={() => setEditOpen(true)}>
          <Pencil className="h-4 w-4" /> Edit
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main info */}
        <div className="col-span-2 space-y-6">
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">Overview</h2>
            <div className="grid grid-cols-2 gap-x-8">
              <div>
                <Row label="Condition" value={<span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${conditionColor[laptop.condition]}`}>{laptop.condition}</span>} />
                <Row label="Model Number" value={laptop.modelNumber} />
                <Row label="Supplier" value={laptop.supplier} />
                <Row label="Purchase Date" value={date(laptop.purchaseDate)} />
                <Row label="Warranty" value={laptop.warrantyMonths ? `${laptop.warrantyMonths} months` : null} />
              </div>
              <div>
                <Row label="Status" value={<span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[laptop.status]}`}>{laptop.status}</span>} />
                {user?.role === 'admin' && <Row label="Cost Price" value={currency(laptop.costPrice)} />}
                <Row label="Selling Price" value={currency(laptop.sellingPrice)} />
                {user?.role === 'admin' && laptop.minSalePrice && <Row label="Min Sale Price" value={currency(laptop.minSalePrice)} />}
                <Row label="Added" value={date(laptop.createdAt)} />
              </div>
            </div>
            {laptop.notes && (
              <div className="mt-4 rounded-lg bg-slate-50 dark:bg-slate-800 px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                {laptop.notes}
              </div>
            )}
          </div>

          {/* Specs */}
          {laptop.specs && Object.values(laptop.specs).some(Boolean) && (
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
              <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">Specifications</h2>
              <div className="grid grid-cols-2 gap-x-8">
                {[
                  ['Processor', laptop.specs.processor],
                  ['Generation', laptop.specs.generation],
                  ['RAM', laptop.specs.ram],
                  ['Storage', laptop.specs.storage],
                  ['GPU', laptop.specs.gpu],
                  ['Display', laptop.specs.display],
                  ['Battery', laptop.specs.battery],
                  ['OS', laptop.specs.os],
                  ['Keyboard', laptop.specs.keyboard],
                  ['Ports', laptop.specs.ports],
                  ['Weight', laptop.specs.weight],
                  ['Color', laptop.specs.color],
                  ['Touchscreen', laptop.specs.touchscreen ? 'Yes' : null],
                ].map(([label, val]) => <Row key={label} label={label} value={val} />)}
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Quantity card */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
              <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">Stock</h2>
              <div className="flex items-center gap-3 mb-4">
                <button
                  disabled={qtyLoading || laptop.quantity === 0 || user?.role !== 'admin'}
                  onClick={() => handleDelta(-1)}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 text-xl font-bold"
                >
                  −
                </button>
                <span className="flex-1 text-center text-3xl font-bold text-slate-900 dark:text-slate-100">{laptop.quantity}</span>
                <button
                  disabled={qtyLoading}
                  onClick={() => handleDelta(1)}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 text-xl font-bold"
                >
                  +
                </button>
              </div>
              {user?.role === 'admin' && (
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={0}
                    placeholder="Set exact qty"
                    value={qtyInput}
                    onChange={(e) => setQtyInput(e.target.value)}
                    className="text-sm"
                  />
                  <Button variant="secondary" size="sm" onClick={handleSetQty}>Set</Button>
                </div>
              )}
          </div>

          {/* Audit log */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-400 dark:text-slate-500" /> Recent Activity
            </h2>
            {audit.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500">No activity yet.</p>
            ) : (
              <div className="space-y-2">
                {audit.map((log) => (
                  <div key={log._id} className="flex justify-between text-xs">
                    <span className="font-medium text-slate-700 dark:text-slate-300">{log.action}</span>
                    <span className="text-slate-400 dark:text-slate-500">{log.user?.name || '—'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <LaptopFormDialog
        open={editOpen}
        laptop={laptop}
        onClose={() => setEditOpen(false)}
        onSaved={(updated) => { setLaptop(updated); setEditOpen(false); }}
      />
    </div>
  );
}
