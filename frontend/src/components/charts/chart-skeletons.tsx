import { Skeleton } from "@/components/ui/skeleton";
import { Heart, MessageCircle, Repeat2, BarChart3 } from "lucide-react";

export function TrendChartSkeleton() {
  return (
    <div className="w-full">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-7 w-16 rounded-full"
          />
        ))}
      </div>
      <div className="relative w-full" style={{ height: 280 }}>
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 600 280"
          preserveAspectRatio="none"
          className="block h-auto w-full"
          aria-hidden="true"
        >
          {[0, 1, 2, 3, 4].map((i) => {
            const y = 20 + (i * 220) / 4;
            return (
              <line
                key={i}
                x1="44"
                x2="584"
                y1={y}
                y2={y}
                stroke="#e2e8f0"
                strokeWidth="1"
                strokeDasharray={i === 4 ? undefined : "4 4"}
              />
            );
          })}
          <line x1="44" x2="584" y1="252" y2="252" stroke="#cbd5e1" strokeWidth="1" />
          {Array.from({ length: 7 }).map((_, i) => {
            const x = 44 + (i * 540) / 6;
            return (
              <line
                key={i}
                x1={x}
                x2={x}
                y1="252"
                y2="256"
                stroke="#cbd5e1"
                strokeWidth="1"
              />
            );
          })}
          <path
            d="M 44 180 L 134 120 L 224 150 L 314 80 L 404 100 L 494 60 L 584 90"
            fill="none"
            stroke="url(#skeleton-grad)"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <defs>
            <linearGradient id="skeleton-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#e2e8f0" />
              <stop offset="50%" stopColor="#cbd5e1" />
              <stop offset="100%" stopColor="#e2e8f0" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex h-full w-full animate-pulse items-center justify-center bg-white/30" />
        </div>
      </div>
    </div>
  );
}

export function CompositionChartSkeleton() {
  return (
    <div className="flex h-full items-center justify-center gap-4 sm:gap-6">
      <div className="relative shrink-0" style={{ width: 200, height: 200 }}>
        <Skeleton className="h-full w-full rounded-full" />
        <div className="absolute inset-[28%] rounded-full bg-white" />
      </div>
      <ul className="flex min-w-0 flex-1 flex-col gap-2">
        {[
          { icon: <Heart className="h-3.5 w-3.5" /> },
          { icon: <MessageCircle className="h-3.5 w-3.5" /> },
          { icon: <Repeat2 className="h-3.5 w-3.5" /> }
        ].map((_, i) => (
          <li key={i} className="w-full">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-transparent px-3 py-2.5">
              <span className="flex min-w-0 items-center gap-2">
                <Skeleton className="h-7 w-7 shrink-0 rounded-lg" />
                <span className="min-w-0 space-y-1.5">
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-3 w-16" />
                </span>
              </span>
              <Skeleton className="h-4 w-10 shrink-0" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ChartEmptyState({
  title = "暂无数据",
  description,
  icon
}: {
  title?: string;
  description?: string;
  icon?: JSX.Element;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-300">
        {icon ?? <BarChart3 className="h-6 w-6" aria-hidden="true" />}
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-slate-600">{title}</p>
        {description ? (
          <p className="mt-1 text-xs text-slate-400">{description}</p>
        ) : null}
      </div>
    </div>
  );
}
