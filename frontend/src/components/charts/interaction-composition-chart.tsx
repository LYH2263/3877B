import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { CreatorTrendPoint } from "@/types/models";
import {
  fillMissingDates,
  computeInteractionComposition,
  buildDonutSegments,
  formatTooltipNumber,
  type DonutSegment
} from "@/lib/chart-utils";
import { Heart, MessageCircle, Repeat2 } from "lucide-react";

export interface CompositionConfig {
  key: "likes" | "comments" | "reposts";
  label: string;
  color: string;
  lightColor: string;
  icon: JSX.Element;
}

export const DEFAULT_COMPOSITION: CompositionConfig[] = [
  {
    key: "likes",
    label: "点赞",
    color: "#f43f5e",
    lightColor: "rgba(244,63,94,0.1)",
    icon: <Heart className="h-3.5 w-3.5" aria-hidden="true" />
  },
  {
    key: "comments",
    label: "评论",
    color: "#0ea5e9",
    lightColor: "rgba(14,165,233,0.1)",
    icon: <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
  },
  {
    key: "reposts",
    label: "转发",
    color: "#10b981",
    lightColor: "rgba(16,185,129,0.1)",
    icon: <Repeat2 className="h-3.5 w-3.5" aria-hidden="true" />
  }
];

export interface InteractionCompositionChartProps {
  trend: CreatorTrendPoint[];
  days: number;
  size?: number;
  composition?: CompositionConfig[];
}

export function InteractionCompositionChart({
  trend,
  days,
  size = 220,
  composition = DEFAULT_COMPOSITION
}: InteractionCompositionChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(size);
  const [focusedKey, setFocusedKey] = useState<"likes" | "comments" | "reposts" | null>(null);
  const [hoveredKey, setHoveredKey] = useState<"likes" | "comments" | "reposts" | null>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerWidth(Math.max(240, Math.floor(entry.contentRect.width)));
      }
    });
    resizeObserver.observe(node);
    return () => resizeObserver.disconnect();
  }, []);

  const filledTrend = useMemo(() => fillMissingDates(trend, days), [trend, days]);
  const compositionData = useMemo(
    () => computeInteractionComposition(filledTrend),
    [filledTrend]
  );

  const hasData = compositionData.total > 0;

  const chartSize = useMemo(() => {
    const maxSize = Math.min(260, Math.max(180, containerWidth * 0.55));
    return Math.max(160, maxSize);
  }, [containerWidth]);

  const cx = chartSize / 2;
  const cy = chartSize / 2;
  const outerRadius = chartSize / 2 - 4;
  const innerRadius = outerRadius * 0.62;

  const segments = useMemo((): DonutSegment[] => {
    if (!hasData) return [];
    return buildDonutSegments(
      cx,
      cy,
      outerRadius,
      innerRadius,
      composition.map((c) => ({
        label: c.label,
        value: compositionData[c.key],
        color: c.color
      }))
    );
  }, [hasData, cx, cy, outerRadius, innerRadius, composition, compositionData]);

  const activeKey = hoveredKey ?? focusedKey;

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLUListElement>) => {
      const keys = composition.map((c) => c.key);
      const currentIndex = activeKey ? keys.indexOf(activeKey) : -1;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        const nextIndex = (currentIndex + 1) % keys.length;
        setFocusedKey(keys[nextIndex]);
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        const prevIndex =
          currentIndex <= 0 ? keys.length - 1 : currentIndex - 1;
        setFocusedKey(keys[prevIndex]);
      } else if (event.key === "Escape") {
        event.preventDefault();
        setFocusedKey(null);
      }
    },
    [composition, activeKey]
  );

  const centerValue = activeKey
    ? compositionData[activeKey]
    : compositionData.total;
  const centerLabel = activeKey
    ? composition.find((c) => c.key === activeKey)?.label ?? "总计"
    : "互动总量";
  const centerPercentage =
    activeKey && compositionData.total > 0
      ? ((compositionData[activeKey] / compositionData.total) * 100).toFixed(1)
      : null;

  return (
    <div className="flex h-full flex-col" ref={containerRef}>
      {hasData ? (
        <div className="flex flex-1 items-center justify-center gap-4 sm:gap-6">
          <div className="relative shrink-0" style={{ width: chartSize, height: chartSize }}>
            <svg
              width={chartSize}
              height={chartSize}
              viewBox={`0 0 ${chartSize} ${chartSize}`}
              role="img"
              aria-label={`近${days}天互动构成环形图，点赞${compositionData.likes}次，评论${compositionData.comments}次，转发${compositionData.reposts}次。总计${compositionData.total}次互动。`}
              className="block h-auto w-full"
            >
              <circle
                cx={cx}
                cy={cy}
                r={outerRadius}
                fill="none"
                stroke="#f1f5f9"
                strokeWidth={outerRadius - innerRadius}
                aria-hidden="true"
              />
              {segments.map((seg, idx) => {
                const config = composition.find((c) => c.label === seg.label);
                const key = config?.key;
                const isActive = key === activeKey;
                return (
                  <path
                    key={seg.label}
                    d={seg.path}
                    fill={seg.color}
                    opacity={activeKey ? (isActive ? 1 : 0.3) : 1}
                    stroke="white"
                    strokeWidth={2}
                    tabIndex={-1}
                    role="presentation"
                    style={{
                      transform: isActive ? "scale(1.03)" : undefined,
                      transformOrigin: `${cx}px ${cy}px`,
                      transition: "transform 150ms ease, opacity 150ms ease"
                    }}
                    aria-label={`${seg.label}：${seg.value}，占比${(seg.percentage * 100).toFixed(1)}%`}
                  >
                    <title>
                      {`${seg.label} ${seg.value} (${(seg.percentage * 100).toFixed(1)}%)`}
                    </title>
                  </path>
                );
              })}
            </svg>
            <div
              className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
              aria-hidden="true"
            >
              <div className="text-xs font-medium text-slate-500">
                {centerLabel}
              </div>
              <div className="mt-0.5 text-xl font-semibold tabular-nums text-slate-900 sm:text-2xl">
                {formatTooltipNumber(centerValue)}
              </div>
              {centerPercentage ? (
                <div className="mt-0.5 text-[11px] font-medium text-slate-400">
                  {centerPercentage}%
                </div>
              ) : null}
            </div>
          </div>

          <ul
            role="listbox"
            aria-label="互动构成图例，点击或使用方向键选择"
            tabIndex={0}
            onKeyDown={handleKeyDown}
            className="flex min-w-0 flex-1 flex-col gap-2 focus:outline-none"
          >
            {composition.map((c) => {
              const value = compositionData[c.key];
              const percentage =
                compositionData.total > 0
                  ? ((value / compositionData.total) * 100).toFixed(1)
                  : "0.0";
              const isActive = c.key === activeKey;
              const isFocused = c.key === focusedKey;
              return (
                <li
                  key={c.key}
                  role="option"
                  aria-selected={isActive}
                  aria-label={`${c.label} ${value}，占比${percentage}%`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setFocusedKey((prev) => (prev === c.key ? null : c.key))
                    }
                    onMouseEnter={() => setHoveredKey(c.key)}
                    onMouseLeave={() => setHoveredKey(null)}
                    onFocus={() => setFocusedKey(c.key)}
                    className={`group flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-all ${
                      isActive
                        ? "border-slate-300 bg-slate-50 shadow-sm"
                        : "border-transparent hover:border-slate-200 hover:bg-slate-50/50"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                        style={{
                          backgroundColor: isActive
                            ? c.lightColor
                            : "#f8fafc",
                          color: c.color
                        }}
                      >
                        {c.icon}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-slate-700">
                          {c.label}
                        </span>
                        <span className="block truncate text-[11px] text-slate-400">
                          占比 {percentage}%
                        </span>
                      </span>
                    </span>
                    <span
                      className={`shrink-0 text-sm font-semibold tabular-nums ${
                        isActive ? "text-slate-900" : "text-slate-500"
                      }`}
                    >
                      {formatTooltipNumber(value)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-300">
            <Heart className="h-7 w-7" aria-hidden="true" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-slate-600">暂无互动数据</p>
            <p className="mt-1 text-xs text-slate-400">
              近{days}天还没有点赞、评论或转发
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
