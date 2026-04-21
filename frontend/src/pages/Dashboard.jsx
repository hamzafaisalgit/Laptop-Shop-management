import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, TrendingUp, Package, ShoppingCart, AlertTriangle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { currency, date } from '@/lib/formatters';
import api from '@/lib/api';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [recentSales, setRecentSales] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [invRes, salesRes, lowRes] = await Promise.all([
          api.get('/laptops', { params: { limit: 1 } }),
          api.get('/sales', { params: { limit: 5 } }),
          api.get('/laptops/low-stock'),
        ]);

        const today = new Date().toISOString().split('T')[0];
        const salesToday = await api.get('/sales', { params: { from: today, to: today, limit: 100 } });
        const todayRevenue = salesToday.data.data.reduce((s, sale) => s + sale.grandTotal, 0);
        const todayProfit = user?.role === 'admin'
          ? salesToday.data.data.reduce((s, sale) => s + (sale.profit || 0), 0)
          : null;

        setStats({
          totalLaptops: invRes.data.total,
          salesToday: salesToday.data.total,
          revenueToday: todayRevenue,
          profitToday: todayProfit,
          lowStockCount: lowRes.data.length,
        });
        setRecentSales(salesRes.data.data);
        setLowStock(lowRes.data.slice(0, 5));
      } catch { /* ignore */ }
      finally { setLoading(false); }
    };
    load();
  }, [user]);

  const StatCard = ({ label, value, sub, icon: Icon, accent }) => (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${accent || 'bg-indigo-50'}`}>
          <Icon className={`h-4 w-4 ${accent ? 'text-white' : 'text-indigo-600'}`} />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-900">{loading ? '…' : value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">
            <LayoutDashboard className="h-3.5 w-3.5" />
            Dashboard
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">Welcome back, {user?.name}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <Button onClick={() => navigate('/sales/new')}>
          <Plus className="h-4 w-4" /> New Sale
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
        <StatCard label="Total Inventory" value={stats?.totalLaptops ?? '—'} sub="laptops in stock" icon={Package} />
        <StatCard label="Sales Today" value={stats?.salesToday ?? '—'} sub="invoices" icon={ShoppingCart} />
        <StatCard label="Revenue Today" value={stats ? currency(stats.revenueToday) : '—'} icon={TrendingUp} />
        {user?.role === 'admin' && (
          <StatCard label="Profit Today" value={stats ? currency(stats.profitToday) : '—'} icon={TrendingUp} accent="bg-emerald-500" />
        )}
        {stats?.lowStockCount > 0 && (
          <div className="col-span-2 lg:col-span-4">
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
              <p className="text-sm text-amber-700">
                <strong>{stats.lowStockCount} batch item{stats.lowStockCount !== 1 ? 's' : ''}</strong> running low on stock
              </p>
              <button onClick={() => navigate('/inventory')} className="ml-auto text-xs font-medium text-amber-600 hover:text-amber-800">
                View inventory →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Recent sales */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 className="font-semibold text-slate-900">Recent Sales</h2>
            <button onClick={() => navigate('/sales')} className="text-xs font-medium text-indigo-600 hover:text-indigo-700">View all →</button>
          </div>
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-400">Loading…</p>
          ) : recentSales.length === 0 ? (
            <div className="py-10 text-center">
              <ShoppingCart className="mx-auto h-8 w-8 text-slate-300 mb-2" />
              <p className="text-sm text-slate-400">No sales yet</p>
              <Button className="mt-3" size="sm" onClick={() => navigate('/sales/new')}>Make first sale</Button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {recentSales.map((s) => (
                  <tr key={s._id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-5 py-3 font-mono text-xs text-indigo-600">{s.invoiceNumber}</td>
                    <td className="px-5 py-3 font-medium text-slate-900">{s.customer.name}</td>
                    <td className="px-5 py-3 text-slate-400 text-xs">{date(s.saleDate)}</td>
                    <td className="px-5 py-3 font-semibold text-slate-900 text-right">{currency(s.grandTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Low stock */}
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="font-semibold text-slate-900">Low Stock</h2>
          </div>
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-400">Loading…</p>
          ) : lowStock.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">All stocked up 👍</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {lowStock.map((l) => (
                <div key={l._id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{l.brand} {l.model}</p>
                    <p className="text-xs text-slate-400">{l.sku}</p>
                  </div>
                  <span className={`text-sm font-bold ${l.quantity === 0 ? 'text-red-500' : 'text-amber-600'}`}>
                    {l.quantity}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
