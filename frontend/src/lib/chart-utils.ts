import type { CreatorTrendPoint } from "@/types/models";

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildDateRange(days: number): string[] {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));

  const range: string[] = [];
  for (let i = 0; i < days; i += 1) {
    const current = new Date(start);
    current.setDate(start.getDate() + i);
    range.push(toDateKey(current));
  }
  return range;
}

export function fillMissingDates(
  trend: CreatorTrendPoint[],
  days: number
): CreatorTrendPoint[] {
  const range = buildDateRange(days);
  const map = new Map(trend.map((item) => [item.date, item]));
  return range.map((date) => {
    const existing = map.get(date);
    return (
      existing ?? {
        date,
        posts: 0,
        likes: 0,
        comments: 0,
        reposts: 0,
        interactions: 0
      }
    );
  });
}

export function formatDateLabel(date: string, locale = "zh-CN"): string {
  const value = new Date(`${date}T00:00:00`);
  return value.toLocaleDateString(locale, {
    month: "2-digit",
    day: "2-digit"
  });
}

export function computeNiceTicks(max: number, targetCount = 5): number[] {
  if (max <= 0) return [0];
  const roughStep = max / targetCount;
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const residual = roughStep / magnitude;
  let niceStep: number;
  if (residual <= 1.5) niceStep = 1;
  else if (residual <= 3) niceStep = 2;
  else if (residual <= 7) niceStep = 5;
  else niceStep = 10;
  niceStep *= magnitude;
  const ticks: number[] = [];
  for (let v = 0; v <= max + niceStep; v += niceStep) {
    ticks.push(v);
    if (v >= max) break;
  }
  return ticks;
}

export interface ChartLayout {
  width: number;
  height: number;
  paddingLeft: number;
  paddingRight: number;
  paddingTop: number;
  paddingBottom: number;
  plotWidth: number;
  plotHeight: number;
}

export function buildLayout(
  width: number,
  height: number,
  options?: Partial<ChartLayout>
): ChartLayout {
  const paddingLeft = options?.paddingLeft ?? 44;
  const paddingRight = options?.paddingRight ?? 16;
  const paddingTop = options?.paddingTop ?? 16;
  const paddingBottom = options?.paddingBottom ?? 32;
  return {
    width,
    height,
    paddingLeft,
    paddingRight,
    paddingTop,
    paddingBottom,
    plotWidth: width - paddingLeft - paddingRight,
    plotHeight: height - paddingTop - paddingBottom
  };
}

export interface DataPoint {
  x: number;
  y: number;
  value: number;
  date: string;
}

export function mapToPoints(
  data: CreatorTrendPoint[],
  key: keyof Pick<CreatorTrendPoint, "posts" | "likes" | "comments" | "reposts" | "interactions">,
  layout: ChartLayout,
  yMax: number
): DataPoint[] {
  const { plotWidth, plotHeight, paddingLeft, paddingTop } = layout;
  const n = data.length;
  const stepX = n > 1 ? plotWidth / (n - 1) : plotWidth;
  return data.map((item, index) => {
    const value = item[key];
    const x = paddingLeft + (n === 1 ? plotWidth / 2 : index * stepX);
    const y =
      paddingTop +
      plotHeight -
      (yMax > 0 ? (value / yMax) * plotHeight : 0);
    return { x, y, value, date: item.date };
  });
}

export function buildPath(points: DataPoint[]): string {
  if (points.length === 0) return "";
  const [first, ...rest] = points;
  const head = `M ${first.x.toFixed(2)} ${first.y.toFixed(2)}`;
  const tail = rest
    .map((p) => `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");
  return tail ? `${head} ${tail}` : head;
}

export function buildAreaPath(points: DataPoint[], layout: ChartLayout): string {
  if (points.length === 0) return "";
  const baseY = layout.paddingTop + layout.plotHeight;
  const [first, ...rest] = points;
  const head = `M ${first.x.toFixed(2)} ${baseY.toFixed(2)} L ${first.x.toFixed(2)} ${first.y.toFixed(2)}`;
  const top = rest
    .map((p) => `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");
  const last = points[points.length - 1];
  return `${head} ${top} L ${last.x.toFixed(2)} ${baseY.toFixed(2)} Z`;
}

export function findNearestIndex(
  mouseX: number,
  data: CreatorTrendPoint[],
  layout: ChartLayout
): number {
  const { plotWidth, paddingLeft } = layout;
  const n = data.length;
  const stepX = n > 1 ? plotWidth / (n - 1) : plotWidth;
  const relativeX = mouseX - paddingLeft;
  const index = n === 1 ? 0 : Math.round(relativeX / stepX);
  return Math.max(0, Math.min(n - 1, index));
}

export function computeYMax(
  data: CreatorTrendPoint[],
  keys: Array<keyof Pick<CreatorTrendPoint, "posts" | "likes" | "comments" | "reposts" | "interactions">>
): number {
  let max = 0;
  for (const item of data) {
    for (const key of keys) {
      if (item[key] > max) max = item[key];
    }
  }
  return Math.max(1, max);
}

export interface InteractionComposition {
  likes: number;
  comments: number;
  reposts: number;
  total: number;
}

export function computeInteractionComposition(
  trend: CreatorTrendPoint[]
): InteractionComposition {
  let likes = 0;
  let comments = 0;
  let reposts = 0;
  for (const item of trend) {
    likes += item.likes;
    comments += item.comments;
    reposts += item.reposts;
  }
  const total = likes + comments + reposts;
  return { likes, comments, reposts, total };
}

export function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  angleDeg: number
): { x: number; y: number } {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad)
  };
}

export function describeArc(
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number
): string {
  const startOuter = polarToCartesian(cx, cy, outerRadius, endAngle);
  const endOuter = polarToCartesian(cx, cy, outerRadius, startAngle);
  const startInner = polarToCartesian(cx, cy, innerRadius, startAngle);
  const endInner = polarToCartesian(cx, cy, innerRadius, endAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;
  return [
    "M",
    startOuter.x.toFixed(2),
    startOuter.y.toFixed(2),
    "A",
    outerRadius,
    outerRadius,
    0,
    largeArcFlag,
    0,
    endOuter.x.toFixed(2),
    endOuter.y.toFixed(2),
    "L",
    startInner.x.toFixed(2),
    startInner.y.toFixed(2),
    "A",
    innerRadius,
    innerRadius,
    0,
    largeArcFlag,
    1,
    endInner.x.toFixed(2),
    endInner.y.toFixed(2),
    "Z"
  ].join(" ");
}

export interface DonutSegment {
  label: string;
  value: number;
  percentage: number;
  startAngle: number;
  endAngle: number;
  color: string;
  path: string;
}

export function buildDonutSegments(
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  segments: Array<{ label: string; value: number; color: string }>
): DonutSegment[] {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return [];
  let currentAngle = 0;
  return segments.map((s) => {
    const percentage = s.value / total;
    const angleSpan = percentage * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angleSpan;
    currentAngle = endAngle;
    const path = describeArc(
      cx,
      cy,
      outerRadius,
      innerRadius,
      startAngle,
      endAngle
    );
    return {
      label: s.label,
      value: s.value,
      percentage,
      startAngle,
      endAngle,
      color: s.color,
      path
    };
  });
}

export function formatTooltipNumber(value: number): string {
  if (value >= 10000) return `${(value / 10000).toFixed(1)}万`;
  return String(value);
}
