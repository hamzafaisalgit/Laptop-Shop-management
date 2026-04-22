import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Search, Plus, X, AlertTriangle, CheckCircle,
  FileText, ShoppingCart, ChevronDown, ChevronUp, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { currency, compact } from '@/lib/formatters';
import api from '@/lib/api';

const DRAFT_KEY = 'sale_draft';

// ── Customer section ──────────────────────────────────────────────────────────
function CustomerSection({ value, onChange }) {
  const [mode, setMode] = useState(() => value.name && !value.customerId ? 'new' : 'search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!query.trim() || mode !== 'search') return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.get('/customers', { params: { search: query, limit: 8 } });
        setResults(res.data.data);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timerRef.current);
  }, [query, mode]);

  if (value.customerId) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3">
        <div>
          <p className="font-medium text-slate-900 dark:text-slate-100">{value.name}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">{value.phone || 'No phone'}</p>
        </div>
        <button onClick={() => onChange({})} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode('search')}
          className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
            mode === 'search'
              ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          Search existing
        </button>
        <button
          type="button"
          onClick={() => setMode('new')}
          className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
            mode === 'new'
              ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          New customer
        </button>
      </div>

      {mode === 'search' && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search by name or phone…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
          {query && results.length > 0 && (
            <div className="absolute top-full z-20 mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg">
              {results.map((c) => (
                <button
                  key={c._id}
                  type="button"
                  onClick={() => { onChange({ customerId: c._id, name: c.name, phone: c.phone, cnic: c.cnic, email: c.email, address: c.address }); setQuery(''); setResults([]); }}
                  className="flex w-full items-center justify-between px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 text-left"
                >
                  <span className="font-medium text-sm text-slate-900 dark:text-slate-100">{c.name}</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">{c.phone}</span>
                </button>
              ))}
            </div>
          )}
          {query && !searching && results.length === 0 && (
            <p className="mt-1 text-xs text-slate-400">No matches. Switch to "New customer" to add.</p>
          )}
        </div>
      )}

      {mode === 'new' && (
        <div className="grid grid-cols-2 gap-3">
          {[['name', 'Full Name *', 'Ahmed Khan'], ['phone', 'Phone *', '0300-0000000'], ['cnic', 'CNIC', '42101-0000000-0'], ['email', 'Email', 'ahmed@example.com']].map(([field, label, placeholder]) => (
            <div key={field} className="space-y-1">
              <Label className="text-xs">{label}</Label>
              <Input
                placeholder={placeholder}
                value={value[field] || ''}
                onChange={(e) => onChange({ ...value, [field]: e.target.value })}
                className="text-sm"
              />
            </div>
          ))}
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Address</Label>
            <Input
              placeholder="Street, City"
              value={value.address || ''}
              onChange={(e) => onChange({ ...value, address: e.target.value })}
              className="text-sm"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Laptop picker ──────────────────────────────────────────────────────────────
function LaptopPicker({ onSelect, excludeIds = [] }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get('/laptops', {
          params: { search: query || undefined, status: 'in_stock', limit: 20 },
        });
        setResults(res.data.data.filter((l) =>
          !excludeIds.includes(String(l._id)) && l.quantity > 0
        ));
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timerRef.current);
  }, [query, excludeIds.join(',')]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input autoFocus placeholder="Search by SKU, brand, model…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
      </div>
      <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
        {loading && <p className="py-6 text-center text-sm text-slate-400">Searching…</p>}
        {!loading && results.length === 0 && (
          <p className="py-6 text-center text-sm text-slate-400">No in-stock laptops found</p>
        )}
        {results.map((l) => (
          <button
            key={l._id}
            type="button"
            onClick={() => onSelect(l)}
            className="flex w-full items-center justify-between px-4 py-3 hover:bg-indigo-50 dark:hover:bg-indigo-950 text-left transition-colors"
          >
            <div>
              <p className="font-medium text-sm text-slate-900 dark:text-slate-100">{l.brand} {l.model}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">{compact(l.specs)} · {l.condition}</p>
              <p className="font-mono text-xs text-slate-400 dark:text-slate-500 mt-0.5">{l.sku}</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">{currency(l.sellingPrice)}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">{l.quantity} in stock</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function NewSale() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [customer, setCustomer] = useState({});
  const [lineItems, setLineItems] = useState([]);
  const [accessories, setAccessories] = useState([]);
  const [discountFlat, setDiscountFlat] = useState(0);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [taxFlat, setTaxFlat] = useState(0);
  const [taxPercent, setTaxPercent] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [successSale, setSuccessSale] = useState(null);

  // Draft persistence
  useEffect(() => {
    try {
      const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
      if (draft) {
        setCustomer(draft.customer || {});
        setLineItems(draft.lineItems || []);
        setAccessories(draft.accessories || []);
        setDiscountFlat(draft.discountFlat || 0);
        setDiscountPercent(draft.discountPercent || 0);
        setTaxFlat(draft.taxFlat || 0);
        setTaxPercent(draft.taxPercent || 0);
        setPaymentMethod(draft.paymentMethod || 'Cash');
        setNotes(draft.notes || '');
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const draft = { customer, lineItems, accessories, discountFlat, discountPercent, taxFlat, taxPercent, paymentMethod, notes };
    const t = setTimeout(() => localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)), 1000);
    return () => clearTimeout(t);
  }, [customer, lineItems, accessories, discountFlat, discountPercent, taxFlat, taxPercent, paymentMethod, notes]);

  const addLaptop = (laptop) => {
    setLineItems((prev) => [
      ...prev,
      {
        laptopId: String(laptop._id),
        sku: laptop.sku,
        brand: laptop.brand,
        model: laptop.model,
        serialNumber: laptop.serialNumber,
        condition: laptop.condition,
        specs: laptop.specs,
        maxQty: laptop.quantity,
        sellingPrice: laptop.sellingPrice,
        minSalePrice: laptop.minSalePrice,
        unitPrice: laptop.sellingPrice,
        qty: 1,
      },
    ]);
    setPickerOpen(false);
  };

  const updateItem = (idx, field, val) => {
    setLineItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item));
  };

  const removeItem = (idx) => setLineItems((prev) => prev.filter((_, i) => i !== idx));

  const addAccessory = () => setAccessories((prev) => [...prev, { name: '', unitPrice: 0, qty: 1 }]);
  const updateAcc = (idx, field, val) => setAccessories((prev) => prev.map((a, i) => i === idx ? { ...a, [field]: val } : a));
  const removeAcc = (idx) => setAccessories((prev) => prev.filter((_, i) => i !== idx));

  // Totals
  const itemsSubtotal = lineItems.reduce((s, i) => s + (i.unitPrice || 0) * i.qty, 0);
  const accSubtotal = accessories.reduce((s, a) => s + (a.unitPrice || 0) * (a.qty || 1), 0);
  const subtotal = itemsSubtotal + accSubtotal;
  const discountAmount = (Number(discountFlat) || 0) + (subtotal * (Number(discountPercent) || 0) / 100);
  const afterDiscount = subtotal - discountAmount;
  const taxAmount = (Number(taxFlat) || 0) + (afterDiscount * (Number(taxPercent) || 0) / 100);
  const grandTotal = afterDiscount + taxAmount;

  const handleSubmit = async () => {
    if (!customer.name) return toast.error('Select or add a customer');
    if (lineItems.length === 0) return toast.error('Add at least one laptop');

    setSubmitting(true);
    try {
      const payload = {
        customer,
        items: lineItems.map((i) => ({ laptopId: i.laptopId, qty: i.qty, unitPrice: i.unitPrice })),
        accessories: accessories.filter((a) => a.name && a.unitPrice > 0),
        discountFlat: Number(discountFlat) || 0,
        discountPercent: Number(discountPercent) || 0,
        taxFlat: Number(taxFlat) || 0,
        taxPercent: Number(taxPercent) || 0,
        paymentMethod,
        paymentReference,
        notes,
      };
      const res = await api.post('/sales', payload);
      localStorage.removeItem(DRAFT_KEY);
      setSuccessSale(res.data);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Sale failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (successSale) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950">
          <CheckCircle className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Sale Complete!</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">{successSale.invoiceNumber} · {currency(successSale.grandTotal)}</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => window.open(`/api/sales/${successSale._id}/invoice`, '_blank')}>
            <FileText className="h-4 w-4" /> View Invoice PDF
          </Button>
          <Button variant="secondary" onClick={() => { setSuccessSale(null); setCustomer({}); setLineItems([]); setAccessories([]); setDiscountFlat(0); setDiscountPercent(0); setTaxFlat(0); setTaxPercent(0); setPaymentMethod('Cash'); setPaymentReference(''); setNotes(''); }}>
            New Sale
          </Button>
          <Button variant="ghost" onClick={() => navigate('/sales')}>View All Sales</Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">New Sale</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Create a new sale invoice</p>
      </div>

      <div className="flex gap-6 items-start">
        {/* Left column — 2/3 */}
        <div className="flex-1 space-y-5 min-w-0">
          {/* Customer */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">Customer</h2>
            <CustomerSection value={customer} onChange={setCustomer} />
          </div>

          {/* Items */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">Laptops</h2>
              <Button size="sm" onClick={() => setPickerOpen(true)}>
                <Plus className="h-4 w-4" /> Add Laptop
              </Button>
            </div>

            {lineItems.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-slate-400">
                <ShoppingCart className="h-8 w-8 mb-2" />
                <p className="text-sm">No laptops added</p>
              </div>
            ) : (
              <div className="space-y-2">
                {lineItems.map((item, idx) => {
                  const belowMin = item.minSalePrice && item.unitPrice < item.minSalePrice;
                  return (
                    <div key={idx} className={`rounded-lg border p-3 ${belowMin ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'}`}>
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-slate-900 dark:text-slate-100">{item.brand} {item.model}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500">{compact(item.specs)} · {item.condition}</p>
                          <p className="font-mono text-xs text-slate-400 dark:text-slate-500">{item.sku}{item.serialNumber ? ` · SN: ${item.serialNumber}` : ''}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center gap-1">
                            <Label className="text-xs text-slate-500 dark:text-slate-400">Qty</Label>
                            <Input
                              type="number"
                              min={1}
                              max={item.maxQty}
                              value={item.qty}
                              onChange={(e) => updateItem(idx, 'qty', Math.max(1, Math.min(item.maxQty, parseInt(e.target.value, 10) || 1)))}
                              className="w-16 text-center text-sm h-8"
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <Label className="text-xs text-slate-500 dark:text-slate-400">Price</Label>
                            <Input
                              type="number"
                              min={0}
                              value={item.unitPrice}
                              onChange={(e) => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                              className="w-28 text-sm h-8"
                            />
                          </div>
                          <button onClick={() => removeItem(idx)} className="text-slate-400 hover:text-red-500 p-1">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      {belowMin && (
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-700 dark:text-amber-400">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Price is below min sale price ({currency(item.minSalePrice)}). You can still proceed.
                        </div>
                      )}
                      <p className="text-right text-sm font-semibold text-slate-900 dark:text-slate-100 mt-1">{currency(item.unitPrice * item.qty)}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Accessories */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">Accessories</h2>
              <Button size="sm" variant="secondary" onClick={addAccessory}>
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
            {accessories.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500 py-2">No accessories added</p>
            ) : (
              <div className="space-y-2">
                {accessories.map((acc, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input placeholder="Item name" value={acc.name} onChange={(e) => updateAcc(idx, 'name', e.target.value)} className="flex-1 text-sm h-8" />
                    <Input type="number" min={0} placeholder="Price" value={acc.unitPrice} onChange={(e) => updateAcc(idx, 'unitPrice', parseFloat(e.target.value) || 0)} className="w-28 text-sm h-8" />
                    <Input type="number" min={1} value={acc.qty} onChange={(e) => updateAcc(idx, 'qty', parseInt(e.target.value, 10) || 1)} className="w-16 text-center text-sm h-8" />
                    <span className="text-sm font-medium w-24 text-right text-slate-700 dark:text-slate-300">{currency((acc.unitPrice || 0) * (acc.qty || 1))}</span>
                    <button onClick={() => removeAcc(idx)} className="text-slate-400 hover:text-red-500 p-1"><X className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column — sticky summary */}
        <div className="w-72 shrink-0 sticky top-6 space-y-4">
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">Order Summary</h2>

            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Subtotal</span><span>{currency(subtotal)}</span>
              </div>

              {/* Discount */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">Discount</p>
                <div className="flex gap-2">
                  <Input type="number" min={0} placeholder="Flat" value={discountFlat || ''} onChange={(e) => setDiscountFlat(e.target.value)} className="h-7 text-xs" />
                  <Input type="number" min={0} max={100} placeholder="%" value={discountPercent || ''} onChange={(e) => setDiscountPercent(e.target.value)} className="h-7 text-xs" />
                </div>
                {discountAmount > 0 && <p className="text-xs text-emerald-600 dark:text-emerald-400">- {currency(discountAmount)}</p>}
              </div>

              {/* Tax */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">Tax</p>
                <div className="flex gap-2">
                  <Input type="number" min={0} placeholder="Flat" value={taxFlat || ''} onChange={(e) => setTaxFlat(e.target.value)} className="h-7 text-xs" />
                  <Input type="number" min={0} max={100} placeholder="%" value={taxPercent || ''} onChange={(e) => setTaxPercent(e.target.value)} className="h-7 text-xs" />
                </div>
                {taxAmount > 0 && <p className="text-xs text-slate-500 dark:text-slate-400">+ {currency(taxAmount)}</p>}
              </div>

              <div className="border-t border-slate-200 dark:border-slate-700 pt-3 flex justify-between font-bold text-base text-slate-900 dark:text-slate-100">
                <span>Grand Total</span><span className="text-indigo-600 dark:text-indigo-400">{currency(grandTotal)}</span>
              </div>
            </div>

            {/* Payment */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Payment Method</Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {['Cash', 'Card', 'Bank Transfer', 'Cheque'].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaymentMethod(m)}
                      className={`rounded-lg border py-1.5 text-xs font-medium transition-colors ${
                        paymentMethod === m
                          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {paymentMethod !== 'Cash' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Payment Reference</Label>
                  <Input placeholder="Cheque no. / TXN ID" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} className="text-sm" />
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs">Notes</Label>
                <Textarea placeholder="Optional notes…" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="text-sm" />
              </div>

              <Button
                className="w-full"
                size="lg"
                disabled={submitting || lineItems.length === 0 || !customer.name}
                onClick={handleSubmit}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Complete Sale · {currency(grandTotal)}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Laptop picker dialog */}
      <Dialog open={pickerOpen} onClose={() => setPickerOpen(false)}>
        <DialogContent title="Select Laptop" onClose={() => setPickerOpen(false)} className="max-w-lg">
          <LaptopPicker onSelect={addLaptop} excludeIds={lineItems.map((i) => i.laptopId)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
