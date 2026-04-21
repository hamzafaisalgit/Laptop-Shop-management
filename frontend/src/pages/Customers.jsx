import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Search, Pencil, Users, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { currency, date } from '@/lib/formatters';
import api from '@/lib/api';

function useDebounce(val, delay = 350) {
  const [d, setD] = useState(val);
  useEffect(() => { const t = setTimeout(() => setD(val), delay); return () => clearTimeout(t); }, [val, delay]);
  return d;
}

const schema = z.object({
  name: z.string().min(1, 'Required'),
  phone: z.string().min(1, 'Required'),
  cnic: z.string().optional(),
  email: z.string().email({ message: 'Invalid email' }).optional().or(z.literal('')),
  address: z.string().optional(),
});

function CustomerForm({ customer, onClose, onSaved }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: customer || {},
  });

  const onSubmit = async (data) => {
    try {
      const res = customer
        ? await api.patch(`/customers/${customer._id}`, data)
        : await api.post('/customers', data);
      toast.success(customer ? 'Customer updated' : 'Customer added');
      onSaved(res.data);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Save failed');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Name *</Label>
          <Input placeholder="Ahmed Khan" {...register('name')} />
          {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Phone *</Label>
          <Input placeholder="0300-0000000" {...register('phone')} />
          {errors.phone && <p className="text-xs text-red-500">{errors.phone.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>CNIC</Label>
          <Input placeholder="42101-0000000-0" {...register('cnic')} />
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input type="email" placeholder="ahmed@example.com" {...register('email')} />
          {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Address</Label>
        <Input placeholder="Street, City" {...register('address')} />
      </div>
      <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={isSubmitting}>
          {customer ? 'Save Changes' : 'Add Customer'}
        </Button>
      </div>
    </form>
  );
}

export default function Customers() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [customers, setCustomers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);
  const [detailCustomer, setDetailCustomer] = useState(null);
  const dSearch = useDebounce(search);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/customers', { params: { search: dSearch || undefined, page, limit: 25 } });
      setCustomers(res.data.data);
      setTotal(res.data.total);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [dSearch, page]);

  const totalPages = Math.max(1, Math.ceil(total / 25));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Customers</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{total} total</p>
        </div>
        <Button onClick={() => { setEditCustomer(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4" /> Add Customer
        </Button>
      </div>

      <div className="mb-4 flex gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Search name or phone…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
            <tr>
              {['Name', 'Phone', 'CNIC', 'Purchases', 'Total Spent', 'Added', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="py-12 text-center text-slate-400">Loading…</td></tr>}
            {!loading && customers.length === 0 && (
              <tr><td colSpan={7} className="py-12 text-center">
                <Users className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600 mb-3" />
                <p className="text-slate-500 dark:text-slate-400 font-medium">No customers yet</p>
              </td></tr>
            )}
            {!loading && customers.map((c) => (
              <tr key={c._id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer" onClick={() => setDetailCustomer(c)}>
                <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{c.name}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{c.phone}</td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono text-xs">{c.cnic || '—'}</td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{c.totalPurchases}</td>
                <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{currency(c.totalSpent)}</td>
                <td className="px-4 py-3 text-slate-400 dark:text-slate-500 text-xs">{date(c.createdAt)}</td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => { setEditCustomer(c); setFormOpen(true); }} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-200">
                    <Pencil className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {total > 25 && (
          <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 px-4 py-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">Page {page} of {totalPages}</p>
            <div className="flex gap-1">
              <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="secondary" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit dialog */}
      <Dialog open={formOpen} onClose={() => setFormOpen(false)}>
        <DialogContent title={editCustomer ? 'Edit Customer' : 'Add Customer'} onClose={() => setFormOpen(false)} className="max-w-lg">
          <CustomerForm
            customer={editCustomer}
            onClose={() => setFormOpen(false)}
            onSaved={() => { setFormOpen(false); load(); }}
          />
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      {detailCustomer && (
        <CustomerDetail customer={detailCustomer} onClose={() => setDetailCustomer(null)} />
      )}
    </div>
  );
}

function CustomerDetail({ customer, onClose }) {
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    api.get(`/customers/${customer._id}`).then((r) => setDetail(r.data)).catch(() => {});
  }, [customer._id]);

  return (
    <Dialog open onClose={onClose}>
      <DialogContent title={customer.name} onClose={onClose} className="max-w-lg">
        {!detail ? (
          <div className="py-8 text-center text-slate-400">Loading…</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-slate-400 dark:text-slate-500">Phone</span><p className="font-medium text-slate-900 dark:text-slate-100">{detail.phone}</p></div>
              <div><span className="text-slate-400 dark:text-slate-500">CNIC</span><p className="font-medium text-slate-900 dark:text-slate-100">{detail.cnic || '—'}</p></div>
              <div><span className="text-slate-400 dark:text-slate-500">Email</span><p className="font-medium text-slate-900 dark:text-slate-100">{detail.email || '—'}</p></div>
              <div><span className="text-slate-400 dark:text-slate-500">Address</span><p className="font-medium text-slate-900 dark:text-slate-100">{detail.address || '—'}</p></div>
              <div><span className="text-slate-400 dark:text-slate-500">Purchases</span><p className="font-medium text-slate-900 dark:text-slate-100">{detail.totalPurchases}</p></div>
              <div><span className="text-slate-400 dark:text-slate-500">Total Spent</span><p className="font-medium text-slate-900 dark:text-slate-100">{currency(detail.totalSpent)}</p></div>
            </div>
            {detail.sales?.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">Purchase History</p>
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700 max-h-48 overflow-y-auto">
                  {detail.sales.map((s) => (
                    <div key={s._id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400">{s.invoiceNumber}</span>
                      <span className="text-slate-400 dark:text-slate-500 text-xs">{date(s.saleDate)}</span>
                      <span className="font-medium text-slate-900 dark:text-slate-100">{currency(s.grandTotal)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
