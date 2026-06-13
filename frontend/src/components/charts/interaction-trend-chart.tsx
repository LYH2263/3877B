import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { CreatorTrendPoint } from "@/types/models";
import {
  fillMissingDates,
  formatDateLabel,
  computeNiceTicks,
  buildLayout,
  mapToPoints,
  buildPath,
  findNearestIndex,
  computeYMax,
  formatTooltipNumber,
  type DataPoint
} from "@/lib/chart-utils";

export type SeriesKey = "posts" | "likes" | "comments" | "reposts";

export interface SeriesConfig {
  key: SeriesKey;
  label: string;
  color: string;
  lightColor: string;
}

export const DEFAULT_SERIES: SeriesConfig[] = [
  { key: "posts", label: "发布", color: "#6366f1", lightColor: "rgba(99,102,241,0.12)" },
  { key: "likes", label: "点赞", color: "#f43f5e", lightColor: "rgba(244,63,94,0.12)" },
  { key: "comments", label: "评论", color: "#0ea5e9", lightColor: "rgba(14,165,233,0.12)" },
  { key: "reposts", label: "转发", color: "#10b981", lightColor: "rgba(16,185,129,0.12)" }
];

export interface InteractionTrendChartProps {
  trend: CreatorTrendPoint[];
  days: number;
  height?: number;
  series?: SeriesConfig[];
}

export function InteractionTrendChart({
  trend,
  days,
  height = 280,
  series = DEFAULT_SERIES
}: InteractionTrendChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [width, setWidth] = useState(600);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [focusIndex, setFocusIndex] = useState<number>(0);
  const [visibleSeries, setVisibleSeries] = useState<Set<SeriesKey>>(
    () => new Set(series.map((s) => s.key))
  );
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const filledTrend = useMemo(() => fillMissingDates(trend, days), [trend, days]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setWidth(Math.max(320, Math.floor(entry.contentRect.width)));
      }
    });
    resizeObserver.observe(node);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    setFocusIndex(0);
  }, [days]);

  const layout = useMemo(() => buildLayout(width, height), [width, height]);

  const activeKeys = useMemo(
    () => series.filter((s) => visibleSeries.has(s.key)).map((s) => s.key),
    [series, visibleSeries]
  );

  const yMax = useMemo(() => computeYMax(filledTrend, activeKeys), [filledTrend, activeKeys]);
  const yTicks = useMemo(() => computeNiceTicks(yMax, 5), [yMax]);
  const yMaxTick = useMemo(() => yTicks[yTicks.length - 1] ?? 1, [yTicks]);

  const seriesPoints = useMemo(() => {
    const map = new Map<SeriesKey, DataPoint[]>();
    for (const s of series) {
      map.set(s.key, mapToPoints(filledTrend, s.key, layout, yMaxTick));
    }
    return map;
  }, [series, filledTrend, layout, yMaxTick]);

  const xTickStep = useMemo(() => {
    const n = filledTrend.length;
    if (n <= 7) return 1;
    if (n <= 14) return 2;
    return Math.max(1, Math.floor(n / 7));
  }, [filledTrend.length]);

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const ratioX = layout.width / rect.width;
      const svgX = (event.clientX - rect.left) * ratioX;
      const index = findNearestIndex(svgX, filledTrend, layout);
      setHoverIndex(index);
      const point = (seriesPoints.values().next().value as DataPoint[] | undefined)?.[index];
      if (point) {
        setTooltipPos({
          x: (point.x / layout.width) * rect.width,
          y: ((layout.paddingTop) / layout.height) * rect.height
        });
      }
    },
    [filledTrend, layout, seriesPoints]
  );

  const handleMouseLeave = useCallback(() => {
    setHoverIndex(null);
    setTooltipPos(null);
  }, []);

  const toggleSeries = useCallback((key: SeriesKey) => {
    setVisibleSeries((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<SVGSVGElement>) => {
      const n = filledTrend.length;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setFocusIndex((i) => Math.max(0, i - 1));
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        setFocusIndex((i) => Math.min(n - 1, i + 1));
      } else if (event.key === "Home") {
        event.preventDefault();
        setFocusIndex(0);
      } else if (event.key === "End") {
        event.preventDefault();
        setFocusIndex(n - 1);
      }
    },
    [filledTrend.length]
  );

  useEffect(() => {
    setHoverIndex(focusIndex);
    const svg = svgRef.current;
    const container = containerRef.current;
    if (svg && container) {
      const rect = svg.getBoundingClientRect();
      const point = (seriesPoints.values().next().value as DataPoint[] | undefined)?.[focusIndex];
      if (point) {
        setTooltipPos({
          x: (point.x / layout.width) * rect.width,
          y: ((layout.paddingTop) / layout.height) * rect.height
        });
      }
    }
  }, [focusIndex, layout, seriesPoints]);

  const displayIndex = hoverIndex ?? focusIndex;
  const displayPoint = displayIndex;

  const tooltipData = displayPoint !== null ? filledTrend[displayPoint] : null;

  return (
    <div className="w-full" ref={containerRef}>
      <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="数据序列切换">
        {series.map((s) => {
          const active = visibleSeries.has(s.key);
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => toggleSeries(s.key)}
              aria-pressed={active}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                active
                  ? "border-slate-300 bg-white text-slate-700 shadow-sm"
                  : "border-slate-200 bg-slate-50 text-slate-400"
              }`}
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-full transition-opacity"
                style={{ backgroundColor: s.color, opacity: active ? 1 : 0.35 }}
                aria-hidden="true"
              />
              {s.label}
            </button>
          );
        })}
      </div>

      <div className="relative">
        <svg
          ref={svgRef}
          width={layout.width}
          height={layout.height}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          role="img"
          aria-label={`近${days}天互动趋势折线图，包含发布、点赞、评论、转发数据。使用左右方向键在数据点之间切换。`}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="block w-full h-auto focus:outline-none focus:ring-2 focus:ring-brand-400 rounded-lg"
          preserveAspectRatio="none"
        >
          <defs>
            {series.map((s) => (
              <linearGradient
                key={`grad-${s.key}`}
                id={`trend-area-${s.key}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={s.color} stopOpacity="0.18" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>

          {yTicks.map((tick) => {
            const y =
              layout.paddingTop +
              layout.plotHeight -
              (tick / yMaxTick) * layout.plotHeight;
            return (
              <g key={`ytick-${tick}`}>
                <line
                  x1={layout.paddingLeft}
                  x2={layout.width - layout.paddingRight}
                  y1={y}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeWidth={1}
                  strokeDasharray={tick === 0 ? undefined : "4 4"}
                  aria-hidden="true"
                />
                <text
                  x={layout.paddingLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-400 text-[10px]"
                  fontSize="10"
                  fontFamily="system-ui, sans-serif"
                  aria-hidden="true"
                >
                  {formatTooltipNumber(tick)}
                </text>
              </g>
            );
          })}

          {filledTrend.map((item, index) => {
            if (index % xTickStep !== 0 && index !== filledTrend.length - 1) return null;
            const { plotWidth, paddingLeft, plotHeight, paddingTop } = layout;
            const n = filledTrend.length;
            const stepX = n > 1 ? plotWidth / (n - 1) : plotWidth;
            const x = paddingLeft + (n === 1 ? plotWidth / 2 : index * stepX);
            return (
              <g key={`xtick-${item.date}`}>
                <line
                  x1={x}
                  x2={x}
                  y1={paddingTop + plotHeight}
                  y2={paddingTop + plotHeight + 4}
                  stroke="#cbd5e1"
                  strokeWidth={1}
                  aria-hidden="true"
                />
                <text
                  x={x}
                  y={paddingTop + plotHeight + 18}
                  textAnchor="middle"
                  className="fill-slate-500"
                  fontSize="10"
                  fontFamily="system-ui, sans-serif"
                  aria-hidden="true"
                >
                  {formatDateLabel(item.date)}
                </text>
              </g>
            );
          })}

          {series.map((s) => {
            if (!visibleSeries.has(s.key)) return null;
            const points = seriesPoints.get(s.key) ?? [];
            return (
              <path
                key={`area-${s.key}`}
                d={(() => {
                  if (points.length === 0) return "";
                  const baseY = layout.paddingTop + layout.plotHeight;
                  const [first, ...rest] = points;
                  const head = `M ${first.x.toFixed(2)} ${baseY.toFixed(2)} L ${first.x.toFixed(2)} ${first.y.toFixed(2)}`;
                  const top = rest.map((p) => `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
                  const last = points[points.length - 1];
                  return `${head} ${top} L ${last.x.toFixed(2)} ${baseY.toFixed(2)} Z`;
                })()}
                fill={`url(#trend-area-${s.key})`}
                aria-hidden="true"
              />
            );
          })}

          {series.map((s) => {
            if (!visibleSeries.has(s.key)) return null;
            const points = seriesPoints.get(s.key) ?? [];
            return (
              <path
                key={`line-${s.key}`}
                d={buildPath(points)}
                fill="none"
                stroke={s.color}
                strokeWidth={2.25}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              />
            );
          })}

          {filledTrend.map((_, index) => {
            const isActive = displayPoint === index;
            const { plotWidth, paddingLeft, paddingTop, plotHeight } = layout;
            const n = filledTrend.length;
            const stepX = n > 1 ? plotWidth / (n - 1) : plotWidth;
            const x = paddingLeft + (n === 1 ? plotWidth / 2 : index * stepX);
            return (
              <line
                key={`vline-${index}`}
                x1={x}
                x2={x}
                y1={paddingTop}
                y2={paddingTop + plotHeight}
                stroke={isActive ? "#94a3b8" : "transparent"}
                strokeWidth={1}
                strokeDasharray="3 3"
                opacity={isActive ? 0.6 : 0}
                aria-hidden="true"
              />
            );
          })}

          {filledTrend.map((item, index) => {
            const { plotWidth, paddingLeft, paddingTop, plotHeight } = layout;
            const n = filledTrend.length;
            const stepX = n > 1 ? plotWidth / (n - 1) : plotWidth;
            const x = paddingLeft + (n === 1 ? plotWidth / 2 : index * stepX);
            const isFocused = focusIndex === index;
            return (
              <g key={`focus-${index}`}>
                <rect
                  x={x - stepX / 2}
                  y={paddingTop}
                  width={stepX}
                  height={plotHeight}
                  fill="transparent"
                  role="button"
                  tabIndex={-1}
                  aria-label={`${formatDateLabel(item.date)}，发布${item.posts}，点赞${item.likes}，评论${item.comments}，转发${item.reposts}`}
                  onFocus={() => setFocusIndex(index)}
                />
                {isFocused && (
                  <rect
                    x={x - stepX / 2 + 1}
                    y={paddingTop + 1}
                    width={Math.max(2, stepX - 2)}
                    height={plotHeight - 2}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth={1.5}
                    strokeDasharray="4 2"
                    opacity={0.4}
                    rx={2}
                    aria-hidden="true"
                  />
                )}
              </g>
            );
          })}

          {series.map((s) => {
            if (!visibleSeries.has(s.key)) return null;
            const points = seriesPoints.get(s.key) ?? [];
            return points.map((p, i) => {
              const isActive = displayPoint === i;
              return (
                <circle
                  key={`dot-${s.key}-${i}`}
                  cx={p.x}
                  cy={p.y}
                  r={isActive ? 5 : 2.75}
                  fill="white"
                  stroke={s.color}
                  strokeWidth={isActive ? 2.5 : 1.75}
                  aria-hidden="true"
                />
              );
            });
          })}
        </svg>

        {tooltipData && tooltipPos ? (
          <div
            role="tooltip"
            className="pointer-events-none absolute z-10 min-w-[160px] -translate-x-1/2 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur"
            style={{
              left: Math.min(
                Math.max(tooltipPos.x, 90),
                (containerRef.current?.clientWidth ?? width) - 90
              ),
              top: tooltipPos.y - 8,
              transform: "translate(-50%, -100%)"
            }}
            aria-live="polite"
          >
            <div className="mb-1.5 font-medium text-slate-700">
              {formatDateLabel(tooltipData.date)}
            </div>
            <div className="space-y-1">
              {series.map((s) => {
                const active = visibleSeries.has(s.key);
                const value = tooltipData[s.key];
                return (
                  <div
                    key={s.key}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{
                          backgroundColor: s.color,
                          opacity: active ? 1 : 0.35
                        }}
                      />
                      {s.label}
                    </span>
                    <span
                      className={`font-semibold tabular-nums ${
                        active ? "text-slate-900" : "text-slate-300"
                      }`}
                    >
                      {formatTooltipNumber(value)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
