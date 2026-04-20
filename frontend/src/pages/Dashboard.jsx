import { useAuth } from '@/hooks/useAuth';
import { LayoutDashboard } from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">
          <LayoutDashboard className="h-3.5 w-3.5" />
          Dashboard
        </div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Welcome back, {user?.name}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Here's what's happening in your shop today.
        </p>
      </div>

      {/* Placeholder cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total Laptops', value: '—', sub: 'Coming soon' },
          { label: 'Sales Today', value: '—', sub: 'Coming soon' },
          { label: 'Revenue Today', value: '—', sub: 'Coming soon' },
          { label: 'Low Stock', value: '—', sub: 'Coming soon' },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              {card.label}
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{card.value}</p>
            <p className="mt-0.5 text-xs text-slate-400">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-lg border border-dashed border-slate-200 bg-white p-10 text-center">
        <p className="text-sm text-slate-400">
          Inventory, sales, and charts will appear here once data is available.
        </p>
      </div>
    </div>
  );
}
