import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  LayoutDashboard, TrendingUp, TrendingDown, Package, ShoppingCart,
  AlertTriangle, Plus, BarChart2, Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { currency, date } from '@/lib/formatters';
import api from '@/lib/api';

// ─── shared ────────────────────────────────────────────────────────────────
function Delta({ value }) {
  if (value === null || value === undefined) return null;
  const up = parseFloat(value) >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${up ? 'text-emerald-600' : 'text-red-500'}`}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {Math.abs(value)}% vs last month
    </span>
  );
}

function KpiCard({ label, value, sub, delta, icon: Icon, accent }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${accent || 'bg-indigo-50'}`}>
          <Icon className={`h-4 w-4 ${accent ? 'text-white' : 'text-indigo-600'}`} />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {delta !== undefined && <div className="mt-1"><Delta value={delta} /></div>}
      {sub && !delta && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

const CHART_TOOLTIP_STYLE = { fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' };

// ─── Admin dashboard ────────────────────────────────────────────────────────
function AdminDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    api.get('/reports/dashboard')
      .then((r) => { setData(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const fmt = (n) => (loading ? '…' : currency(n ?? 0));
  const num = (n) => (loading ? '…' : (n ?? 0).toLocaleString());

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">
            <LayoutDashboard className="h-3.5 w-3.5" />
            Dashboard
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">Welcome back, {user?.name}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <Button onClick={() => navigate('/sales/new')}>
          <Plus className="h-4 w-4" /> New Sale
        </Button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Revenue Today"
          value={fmt(data?.today?.revenue)}
          sub={`${data?.today?.salesCount ?? 0} sale${data?.today?.salesCount !== 1 ? 's' : ''}`}
          icon={ShoppingCart}
        />
        <KpiCard
          label="Revenue This Month"
          value={fmt(data?.thisMonth?.revenue)}
          delta={data?.thisMonth?.revenueGrowth}
          icon={TrendingUp}
        />
        <KpiCard
          label="Profit This Month"
          value={fmt(data?.thisMonth?.profit)}
          delta={data?.thisMonth?.profitGrowth}
          icon={TrendingUp}
          accent="bg-emerald-500"
        />
        <KpiCard
          label="Low Stock Items"
          value={num(data?.inventory?.lowStockCount)}
          sub="batch items"
          icon={AlertTriangle}
          accent={data?.inventory?.lowStockCount > 0 ? 'bg-amber-500' : undefined}
        />
      </div>

      {/* Inventory value strip */}
      {!loading && data && (
        <div className="mb-6 grid grid-cols-4 gap-3">
          {[
            { label: 'Total Laptops', val: (data.inventory.totalUnits + data.inventory.totalBatches).toLocaleString() },
            { label: 'Stock Value (Cost)', val: currency(data.inventory.stockValueCost) },
            { label: 'Stock Value (Retail)', val: currency(data.inventory.stockValueRetail) },
            { label: 'Units Sold This Year', val: data.thisYear.unitsSold?.toLocaleString() ?? '0' },
          ].map(({ label, val }) => (
            <div key={label} className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-xs text-slate-400 mb-0.5">{label}</p>
              <p className="font-semibold text-slate-900">{val}</p>
            </div>
          ))}
        </div>
      )}

      {/* Sales trend chart */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm mb-6 p-5">
        <h2 className="font-semibold text-slate-900 mb-4">Sales Trend — Last 30 Days</h2>
        {loading ? (
          <div className="h-52 flex items-center justify-center text-sm text-slate-400">Loading…</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data?.salesTrend ?? []} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
              <defs>
                <linearGradient id="gRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickFormatter={(d) => d.slice(5)}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                axisLine={false}
                tickLine={false}
                width={45}
              />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                formatter={(v, n) => [currency(v), n]}
                labelFormatter={(l) => `Date: ${l}`}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="revenue" stroke="#4f46e5" fill="url(#gRevenue)" name="Revenue" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              <Area type="monotone" dataKey="profit" stroke="#10b981" fill="url(#gProfit)" name="Profit" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        {/* Top brands */}
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">Top Brands This Month</h2>
            <BarChart2 className="h-4 w-4 text-slate-400" />
          </div>
          {loading ? (
            <div className="h-40 flex items-center justify-center text-sm text-slate-400">Loading…</div>
          ) : (data?.topBrands?.length ?? 0) === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">No sales this month yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart layout="vertical" data={data.topBrands} margin={{ left: 5, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="brand" tick={{ fontSize: 12, fill: '#475569' }} width={55} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => [currency(v), 'Revenue']} />
                <Bar dataKey="revenue" fill="#4f46e5" radius={[0, 4, 4, 0]} name="Revenue" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Recent sales */}
        <div className="col-span-2 rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 className="font-semibold text-slate-900">Recent Sales</h2>
            <button onClick={() => navigate('/sales')} className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
              View all →
            </button>
          </div>
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-400">Loading…</p>
          ) : (data?.recentSales?.length ?? 0) === 0 ? (
            <div className="py-10 text-center">
              <ShoppingCart className="mx-auto h-8 w-8 text-slate-300 mb-2" />
              <p className="text-sm text-slate-400">No sales yet</p>
              <Button className="mt-3" size="sm" onClick={() => navigate('/sales/new')}>Make first sale</Button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {data.recentSales.map((s) => (
                  <tr key={s._id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-5 py-3 font-mono text-xs text-indigo-600">{s.invoiceNumber}</td>
                    <td className="px-5 py-3 font-medium text-slate-900">{s.customer.name}</td>
                    <td className="px-5 py-3 text-slate-400 text-xs">{date(s.saleDate)}</td>
                    <td className="px-5 py-3 text-slate-500 text-xs">{s.paymentMethod}</td>
                    <td className="px-5 py-3 font-semibold text-slate-900 text-right">{currency(s.grandTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Low stock alerts */}
      {(data?.lowStockItems?.length ?? 0) > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Low Stock Alerts
            </h2>
            <button onClick={() => navigate('/inventory')} className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
              Manage inventory →
            </button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {data.lowStockItems.map((l) => (
              <div key={l._id} className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="font-medium text-slate-900 text-sm">{l.brand} {l.model}</p>
                <p className="text-xs text-slate-400 mt-0.5">{l.sku}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-amber-700">
                    <span className="font-bold text-amber-600 text-lg">{l.quantity}</span> left
                  </span>
                  <Button size="sm" variant="secondary" onClick={() => navigate(`/inventory/${l._id}`)}>
                    + Restock
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Salesperson dashboard ──────────────────────────────────────────────────
function SalespersonDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentSales, setRecentSales] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    Promise.all([
      api.get('/sales', { params: { from: today, to: today, limit: 100 } }),
      api.get('/sales', { params: { from: monthStart, limit: 100 } }),
      api.get('/sales', { params: { limit: 5 } }),
    ])
      .then(([todayRes, monthRes, recentRes]) => {
        setStats({
          todayCount: todayRes.data.total,
          todayRevenue: todayRes.data.data.reduce((s, x) => s + x.grandTotal, 0),
          monthCount: monthRes.data.total,
          monthRevenue: monthRes.data.data.reduce((s, x) => s + x.grandTotal, 0),
        });
        setRecentSales(recentRes.data.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const fmt = (n) => (loading ? '…' : currency(n ?? 0));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">
            <LayoutDashboard className="h-3.5 w-3.5" />
            Dashboard
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">Welcome back, {user?.name}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <Button onClick={() => navigate('/sales/new')}>
          <Plus className="h-4 w-4" /> New Sale
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Sales Today" value={loading ? '…' : stats?.todayCount ?? 0} sub="invoices" icon={ShoppingCart} />
        <KpiCard label="Revenue Today" value={fmt(stats?.todayRevenue)} icon={TrendingUp} />
        <KpiCard label="Sales This Month" value={loading ? '…' : stats?.monthCount ?? 0} sub="invoices" icon={Users} />
        <KpiCard label="Revenue This Month" value={fmt(stats?.monthRevenue)} icon={TrendingUp} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Recent Sales</h2>
          <button onClick={() => navigate('/sales')} className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
            View all →
          </button>
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
                  <td className="px-5 py-3 text-slate-500 text-xs">{s.paymentMethod}</td>
                  <td className="px-5 py-3 font-semibold text-slate-900 text-right">{currency(s.grandTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Router ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useAuth();
  if (!user) return null;
  return user.role === 'admin' ? <AdminDashboard /> : <SalespersonDashboard />;
}
