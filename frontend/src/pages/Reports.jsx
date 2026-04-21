import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Download, TrendingUp, BarChart2, Users, Package, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import AdminOnly from '@/components/AdminOnly';
import { currency } from '@/lib/formatters';
import api from '@/lib/api';

const CHART_TOOLTIP_STYLE = { fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' };
const currentYear = new Date().getFullYear();

function pct(n) { return `${(n ?? 0).toFixed(1)}%`; }
function growth(n) {
  if (n === null || n === undefined) return <span className="text-slate-400">—</span>;
  const up = n >= 0;
  return <span className={up ? 'text-emerald-600' : 'text-red-500'}>{up ? '+' : ''}{n}%</span>;
}
function SectionCard({ children, className = '' }) {
  return (
    <div className={`rounded-lg border border-slate-200 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}
function TableHead({ cols }) {
  return (
    <thead className="border-b border-slate-200 bg-slate-50 sticky top-0">
      <tr>
        {cols.map((c) => (
          <th key={c} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">{c}</th>
        ))}
      </tr>
    </thead>
  );
}

// ─── Monthly ─────────────────────────────────────────────────────────────
function MonthlyTab() {
  const [year, setYear] = useState(currentYear);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/reports/monthly', { params: { year } })
      .then((r) => { setData(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [year]);

  useEffect(() => { load(); }, [load]);

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const handleExport = async () => {
    const res = await api.get('/reports/export/sales', {
      params: { from: `${year}-01-01`, to: `${year}-12-31` },
      responseType: 'blob',
    });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a'); a.href = url; a.download = `sales_${year}.xlsx`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-32">
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </Select>
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <Download className="h-4 w-4" /> Export {year}
        </button>
      </div>

      <SectionCard className="p-5">
        <h3 className="font-semibold text-slate-900 mb-4">Revenue vs Profit — {year}</h3>
        {loading ? (
          <div className="h-64 flex items-center justify-center text-sm text-slate-400">Loading…</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data?.rows ?? []} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} width={48} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v, n) => [currency(v), n]} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="revenue" fill="#4f46e5" name="Revenue" radius={[4, 4, 0, 0]} />
              <Bar dataKey="profit" fill="#10b981" name="Profit" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </SectionCard>

      <SectionCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <TableHead cols={['Month', 'Revenue', 'Profit', 'Margin', 'Sales', 'Units', 'MoM Growth']} />
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="py-8 text-center text-slate-400">Loading…</td></tr>
              ) : data?.rows?.map((r) => (
                <tr key={r.month} className={`border-t border-slate-100 hover:bg-slate-50 ${r.revenue === 0 ? 'opacity-40' : ''}`}>
                  <td className="px-4 py-3 font-medium text-slate-900">{r.month}</td>
                  <td className="px-4 py-3 text-slate-700">{currency(r.revenue)}</td>
                  <td className="px-4 py-3 text-emerald-700">{currency(r.profit)}</td>
                  <td className="px-4 py-3 text-slate-500">{pct(r.margin)}</td>
                  <td className="px-4 py-3 text-slate-500">{r.salesCount}</td>
                  <td className="px-4 py-3 text-slate-500">{r.unitsSold}</td>
                  <td className="px-4 py-3">{growth(r.growth)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

// ─── Yearly ───────────────────────────────────────────────────────────────
function YearlyTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/reports/yearly')
      .then((r) => { setData(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <SectionCard className="p-5">
        <h3 className="font-semibold text-slate-900 mb-4">Year-over-Year Revenue & Profit</h3>
        {loading ? (
          <div className="h-64 flex items-center justify-center text-sm text-slate-400">Loading…</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data?.rows ?? []} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} axisLine={false} tickLine={false} width={52} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v, n) => [currency(v), n]} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="revenue" stroke="#4f46e5" name="Revenue" strokeWidth={2} dot={{ fill: '#4f46e5', r: 4 }} />
              <Line type="monotone" dataKey="profit" stroke="#10b981" name="Profit" strokeWidth={2} dot={{ fill: '#10b981', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </SectionCard>

      <SectionCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <TableHead cols={['Year', 'Revenue', 'Cost', 'Profit', 'Margin', 'Sales', 'Units']} />
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="py-8 text-center text-slate-400">Loading…</td></tr>
              ) : data?.rows?.map((r) => (
                <tr key={r.year} className={`border-t border-slate-100 hover:bg-slate-50 ${r.revenue === 0 ? 'opacity-40' : ''}`}>
                  <td className="px-4 py-3 font-bold text-slate-900">{r.year}</td>
                  <td className="px-4 py-3 text-slate-700">{currency(r.revenue)}</td>
                  <td className="px-4 py-3 text-slate-500">{currency(r.cost)}</td>
                  <td className="px-4 py-3 text-emerald-700">{currency(r.profit)}</td>
                  <td className="px-4 py-3 text-slate-500">{pct(r.margin)}</td>
                  <td className="px-4 py-3 text-slate-500">{r.salesCount}</td>
                  <td className="px-4 py-3 text-slate-500">{r.unitsSold}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

// ─── By Brand ─────────────────────────────────────────────────────────────
function ByBrandTab() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/reports/sales-by-brand', { params: { from: from || undefined, to: to || undefined } })
      .then((r) => { setData(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const handleExport = async () => {
    const res = await api.get('/reports/export/sales', {
      params: { from: from || undefined, to: to || undefined },
      responseType: 'blob',
    });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a'); a.href = url; a.download = `sales_by_brand.xlsx`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-36" title="From" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-36" title="To" />
        {(from || to) && (
          <Button variant="ghost" size="sm" onClick={() => { setFrom(''); setTo(''); }}>Clear</Button>
        )}
        <div className="ml-auto">
          <button onClick={handleExport} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
            <Download className="h-4 w-4" /> Export Excel
          </button>
        </div>
      </div>

      <SectionCard className="p-5">
        <h3 className="font-semibold text-slate-900 mb-4">Revenue by Brand</h3>
        {loading ? (
          <div className="h-52 flex items-center justify-center text-sm text-slate-400">Loading…</div>
        ) : (data?.data?.length ?? 0) === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">No sales in selected period</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(160, data.data.length * 44)}>
            <BarChart layout="vertical" data={data.data} margin={{ left: 5, right: 15 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="brand" tick={{ fontSize: 12, fill: '#475569' }} width={62} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v, n) => [currency(v), n]} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="revenue" fill="#4f46e5" radius={[0, 4, 4, 0]} name="Revenue" />
              <Bar dataKey="profit" fill="#10b981" radius={[0, 4, 4, 0]} name="Profit" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </SectionCard>

      <SectionCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <TableHead cols={['Brand', 'Units Sold', 'Revenue', 'Profit']} />
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="py-8 text-center text-slate-400">Loading…</td></tr>
              ) : (data?.data ?? []).map((r) => (
                <tr key={r.brand} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{r.brand}</td>
                  <td className="px-4 py-3 text-slate-600">{r.unitsSold}</td>
                  <td className="px-4 py-3 text-slate-700">{currency(r.revenue)}</td>
                  <td className="px-4 py-3 text-emerald-700">{currency(r.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

// ─── By Salesperson ────────────────────────────────────────────────────────
function SalespersonTab() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/reports/salesperson-performance', { params: { from: from || undefined, to: to || undefined } })
      .then((r) => { setData(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-36" title="From" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-36" title="To" />
        {(from || to) && (
          <Button variant="ghost" size="sm" onClick={() => { setFrom(''); setTo(''); }}>Clear</Button>
        )}
      </div>

      <SectionCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <TableHead cols={['Rank', 'Salesperson', 'Sales', 'Units', 'Revenue', 'Profit', 'Margin']} />
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="py-8 text-center text-slate-400">Loading…</td></tr>
              ) : (data?.data?.length ?? 0) === 0 ? (
                <tr><td colSpan={7} className="py-8 text-center text-slate-400">No data</td></tr>
              ) : data.data.map((r, i) => (
                <tr key={`${r.name}-${i}`} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs">#{i + 1}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{r.name}</td>
                  <td className="px-4 py-3 text-slate-600">{r.salesCount}</td>
                  <td className="px-4 py-3 text-slate-600">{r.unitsSold}</td>
                  <td className="px-4 py-3 text-slate-700">{currency(r.revenue)}</td>
                  <td className="px-4 py-3 text-emerald-700">{currency(r.profit)}</td>
                  <td className="px-4 py-3 text-slate-500">{pct(r.profitMargin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

// ─── Slow Movers ──────────────────────────────────────────────────────────
function SlowMoversTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/reports/slow-movers')
      .then((r) => { setData(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        In-stock laptops added more than 90 days ago — sorted by age, oldest first. Red rows = over 180 days.
      </p>

      <SectionCard className="overflow-hidden">
        <div className="overflow-x-auto max-h-140 overflow-y-auto">
          <table className="w-full text-sm">
            <TableHead cols={['SKU', 'Brand / Model', 'Condition', 'Qty', 'Age (Days)', 'Selling Price']} />
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="py-8 text-center text-slate-400">Loading…</td></tr>
              ) : (data?.data?.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <Clock className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                    <p className="text-slate-500">No slow movers — all inventory is fresh!</p>
                  </td>
                </tr>
              ) : data.data.map((l) => (
                <tr
                  key={l._id}
                  className={`border-t border-slate-100 hover:bg-slate-50 ${l.ageInDays > 180 ? 'bg-red-50/60' : ''}`}
                >
                  <td className="px-4 py-3 font-mono text-xs text-indigo-600">{l.sku}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{l.brand} {l.model}</p>
                    <p className="text-xs text-slate-400">{[l.specs?.processor, l.specs?.ram].filter(Boolean).join(' / ')}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{l.condition}</td>
                  <td className="px-4 py-3 text-slate-600">{l.quantity}</td>
                  <td className="px-4 py-3">
                    <span className={`font-semibold ${l.ageInDays > 180 ? 'text-red-600' : 'text-amber-600'}`}>
                      {l.ageInDays}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{currency(l.sellingPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

// ─── Tabs config ──────────────────────────────────────────────────────────
const TABS = [
  { id: 'monthly', label: 'Monthly', icon: BarChart2, Component: MonthlyTab },
  { id: 'yearly', label: 'Yearly', icon: TrendingUp, Component: YearlyTab },
  { id: 'brand', label: 'By Brand', icon: Package, Component: ByBrandTab },
  { id: 'salesperson', label: 'By Salesperson', icon: Users, Component: SalespersonTab },
  { id: 'slow', label: 'Slow Movers', icon: Clock, Component: SlowMoversTab },
];

function ReportsContent() {
  const [activeTab, setActiveTab] = useState('monthly');
  const active = TABS.find((t) => t.id === activeTab);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Reports & Analytics</h1>
        <p className="text-sm text-slate-500 mt-0.5">Sales performance, inventory insights, and trends</p>
      </div>

      <div className="border-b border-slate-200 mb-6">
        <nav className="-mb-px flex gap-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {active && <active.Component />}
    </div>
  );
}

export default function Reports() {
  return (
    <AdminOnly>
      <ReportsContent />
    </AdminOnly>
  );
}
