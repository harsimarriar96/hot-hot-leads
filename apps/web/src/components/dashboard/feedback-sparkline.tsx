import { useQuery } from '@tanstack/react-query';
import { apiJson } from '@/lib/http';

interface WeekPoint {
  week: string;
  avg: number;
  count: number;
}

const fetchTrend = (product: string) =>
  apiJson<WeekPoint[]>(`/api/feedback/trend?product=${encodeURIComponent(product)}&weeks=12`);

/**
 * Weekly average feedback score, rendered as a small SVG bar-line sparkline.
 * Bar height = avg/10, bar color bucket = score token.
 */
export function FeedbackSparkline({ product }: { product: string | null }) {
  const q = useQuery({
    queryKey: ['feedback-trend', product],
    queryFn: () => fetchTrend(product!),
    enabled: !!product,
    staleTime: 60_000,
  });

  if (!product || q.isPending || q.isError || !q.data || q.data.length === 0) return null;
  const points = q.data;
  const latest = points[points.length - 1];
  const first = points[0];
  const trend = latest.avg - first.avg;

  const W = 160;
  const H = 42;
  const padX = 2;
  const padY = 4;
  const innerW = W - padX * 2;
  const innerH = H - padY * 2;
  const barW = innerW / points.length - 2;

  return (
    <div className="flex items-center gap-3 py-2 px-4 md:px-6 border-b border-[var(--border)]">
      <div className="flex flex-col">
        <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
          Feedback · last {points.length} weeks
        </span>
        <div className="flex items-baseline gap-2 mt-0.5">
          <span className="text-lg font-mono tabular-nums font-semibold">
            {latest.avg.toFixed(1)}
          </span>
          <span
            className={`text-xs font-mono tabular-nums ${
              trend > 0.2
                ? 'text-[var(--success)]'
                : trend < -0.2
                  ? 'text-[var(--error)]'
                  : 'text-[var(--text-tertiary)]'
            }`}
          >
            {trend > 0 ? '▲' : trend < 0 ? '▼' : '·'} {Math.abs(trend).toFixed(1)}
          </span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Feedback quality sparkline">
        {points.map((p, i) => {
          const x = padX + i * (barW + 2);
          const h = (p.avg / 10) * innerH;
          const y = padY + (innerH - h);
          const fill = barColor(p.avg);
          return (
            <rect key={p.week} x={x} y={y} width={barW} height={h} rx={1} fill={fill}>
              <title>
                {p.week} · avg {p.avg} ({p.count} entries)
              </title>
            </rect>
          );
        })}
      </svg>
    </div>
  );
}

function barColor(avg: number): string {
  if (avg >= 8) return 'var(--score-hot)';
  if (avg >= 6) return 'var(--score-warm)';
  if (avg >= 4) return 'var(--score-cold)';
  return 'var(--border-strong)';
}
