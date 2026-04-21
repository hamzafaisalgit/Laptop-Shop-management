import { cn } from '@/lib/utils';

function Card({ className, ...props }) {
  return (
    <div
      className={cn('rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900', className)}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }) {
  return <div className={cn('mb-4', className)} {...props} />;
}

function CardTitle({ className, ...props }) {
  return <h3 className={cn('text-lg font-semibold text-slate-900 dark:text-slate-100', className)} {...props} />;
}

function CardDescription({ className, ...props }) {
  return <p className={cn('text-sm text-slate-500 dark:text-slate-400 mt-1', className)} {...props} />;
}

function CardContent({ className, ...props }) {
  return <div className={cn('', className)} {...props} />;
}

function CardFooter({ className, ...props }) {
  return <div className={cn('mt-4 flex items-center', className)} {...props} />;
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
