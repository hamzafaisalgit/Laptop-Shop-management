import { useAuth } from '@/hooks/useAuth';
import { ShieldOff } from 'lucide-react';

export default function AdminOnly({ children }) {
  const { user } = useAuth();

  if (user?.role !== 'admin') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 py-24 text-slate-400">
        <ShieldOff className="h-12 w-12" />
        <p className="text-lg font-semibold text-slate-600">Access Denied</p>
        <p className="text-sm">This page is restricted to administrators.</p>
      </div>
    );
  }

  return <>{children}</>;
}
