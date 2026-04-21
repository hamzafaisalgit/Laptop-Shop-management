import { cn } from '@/lib/utils';

const variantClasses = {
  default: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  success: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  destructive: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
  secondary: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

function Badge({ className, variant = 'default', ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variantClasses[variant] ?? variantClasses.default,
        className
      )}
      {...props}
    />
  );
}

export { Badge };
