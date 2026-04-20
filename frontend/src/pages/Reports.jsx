import AdminOnly from '@/components/AdminOnly';

export default function Reports() {
  return (
    <AdminOnly>
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 mb-1">Reports</h1>
        <p className="text-sm text-slate-500">Coming soon.</p>
      </div>
    </AdminOnly>
  );
}
