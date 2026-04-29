import { cn } from '@/lib/utils';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('skeleton h-4 w-full', className)} {...props} />;
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 py-2.5 border-b border-[var(--border)]">
      <Skeleton className="h-3 w-5" />
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-3 w-14" />
      <Skeleton className="h-3 w-24 ml-auto" />
    </div>
  );
}
