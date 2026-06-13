import { useEffect, useMemo, useState, useCallback } from "react";
import { BarChart3, ChartLine, Heart, MessageCircle, Repeat2, Users, Calendar } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { fetchCreatorDashboard } from "@/api/creator";
import { CheckInPanel } from "@/components/checkin/checkin-panel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { InteractionTrendChart } from "@/components/charts/interaction-trend-chart";
import { InteractionCompositionChart } from "@/components/charts/interaction-composition-chart";
import {
  TrendChartSkeleton,
  CompositionChartSkeleton,
  ChartEmptyState
} from "@/components/charts/chart-skeletons";
import { formatCount } from "@/lib/format";
import { parseApiError } from "@/lib/api-error";
import {
  fillMissingDates,
  computeInteractionComposition,
  formatDateLabel
} from "@/lib/chart-utils";
import type { CreatorDashboardPayload } from "@/types/models";

const DAY_OPTIONS: ReadonlyArray<{ value: 7 | 14 | 30; label: string }> = [
  { value: 7, label: "近 7 天" },
  { value: 14, label: "近 14 天" },
  { value: 30, label: "近 30 天" }
] as const;

type DayOption = (typeof DAY_OPTIONS)[number]["value"];

function StatCard({
  title,
  value,
  hint,
  icon
}: {
  title: string;
  value: string;
  hint: string;
  icon: JSX.Element;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500">{title}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
            <p className="mt-1 text-xs text-slate-500">{hint}</p>
          </div>
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            {icon}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function StatCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="mt-2 h-7 w-14" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
        </div>
      </CardContent>
    </Card>
  );
}

function DaysSelector({
  value,
  onChange,
  disabled
}: {
  value: DayOption;
  onChange: (v: DayOption) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="tablist"
      aria-label="选择统计时间范围"
      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-sm"
    >
      {DAY_OPTIONS.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            type="button"
            aria-selected={active}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
              active
                ? "bg-brand-500 text-white shadow-sm"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
            } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
          >
            <Calendar className="h-3 w-3" aria-hidden="true" />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export default function CreatorCenterPage() {
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<CreatorDashboardPayload | null>(null);
  const [days, setDays] = useState<DayOption>(7);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  const loadData = useCallback(async (d: DayOption) => {
    setLoading(true);
    try {
      const data = await fetchCreatorDashboard(d);
      setPayload(data);
    } catch (error) {
      const parsed = parseApiError(error);
      toast.error(parsed.message || "数据中心加载失败");
    } finally {
      setLoading(false);
      setInitialLoadDone(true);
    }
  }, []);

  useEffect(() => {
    void loadData(days);
  }, [loadData, days]);

  const handleDaysChange = useCallback((next: DayOption) => {
    setDays(next);
  }, []);

  const filledTrend = useMemo(
    () => (payload ? fillMissingDates(payload.trend, days) : []),
    [payload, days]
  );

  const rangeComposition = useMemo(
    () =>
      filledTrend.length > 0
        ? computeInteractionComposition(filledTrend)
        : { likes: 0, comments: 0, reposts: 0, total: 0 },
    [filledTrend]
  );

  const latestTrend = filledTrend[filledTrend.length - 1] ?? null;

  const hasTrendData = filledTrend.length > 0;

  if (!initialLoadDone && loading) {
    return (
      <main className="mx-auto mt-6 w-full max-w-6xl space-y-4 px-4 pb-12">
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-7 w-36" />
              <Skeleton className="h-3.5 w-52" />
            </div>
            <Skeleton className="h-9 w-28 rounded-xl" />
          </CardContent>
        </Card>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <StatCardSkeleton key={index} />
          ))}
        </section>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">互动趋势</CardTitle>
                  <CardDescription className="mt-1 text-xs">
                    发布、点赞、评论、转发变化
                  </CardDescription>
                </div>
                <Skeleton className="h-8 w-32 rounded-full" />
              </div>
            </CardHeader>
            <CardContent>
              <TrendChartSkeleton />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">互动构成</CardTitle>
              <CardDescription className="mt-1 text-xs">
                点赞、评论、转发占比
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CompositionChartSkeleton />
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  if (!payload) {
    return (
      <main className="mx-auto mt-6 w-full max-w-6xl space-y-4 px-4 pb-12">
        <CheckInPanel />
        <ChartEmptyState
          title="暂无可展示的数据"
          description="请稍后再试或去发布你的第一条动态"
        />
      </main>
    );
  }

  return (
    <main className="mx-auto mt-6 w-full max-w-6xl space-y-4 px-4 pb-12">
      <CheckInPanel />

      <Card className="overflow-hidden border-brand-100 bg-gradient-to-r from-white to-brand-50/40">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <p className="text-sm text-slate-600">创作者数据中心</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">
              @{payload.creator.nickname}
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              {DAY_OPTIONS.find((o) => o.value === days)?.label}创作表现与互动趋势一目了然
            </p>
          </div>
          <Link
            to="/compose"
            className="inline-flex items-center gap-2 rounded-xl border border-brand-200 bg-white px-3 py-2 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-50"
          >
            <BarChart3 className="h-4 w-4" aria-hidden="true" />
            去创作
          </Link>
        </CardContent>
      </Card>

      <section
        aria-label="核心数据指标"
        className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6"
      >
        <StatCard
          title="总发布数"
          value={formatCount(payload.summary.postsCount)}
          hint="累计内容产出"
          icon={<BarChart3 className="h-4 w-4" aria-hidden="true" />}
        />
        <StatCard
          title="总获赞"
          value={formatCount(payload.summary.totalLikes)}
          hint="累计点赞"
          icon={<Heart className="h-4 w-4" aria-hidden="true" />}
        />
        <StatCard
          title="总评论"
          value={formatCount(payload.summary.totalComments)}
          hint="累计评论"
          icon={<MessageCircle className="h-4 w-4" aria-hidden="true" />}
        />
        <StatCard
          title="总转发"
          value={formatCount(payload.summary.totalReposts)}
          hint="累计转发"
          icon={<Repeat2 className="h-4 w-4" aria-hidden="true" />}
        />
        <StatCard
          title="当前粉丝"
          value={formatCount(payload.summary.followersCount)}
          hint="账号粉丝规模"
          icon={<Users className="h-4 w-4" aria-hidden="true" />}
        />
        <StatCard
          title={`${days}天净增`}
          value={formatCount(payload.summary.followersNetChange)}
          hint={`近 ${days} 天新增关注`}
          icon={<ChartLine className="h-4 w-4" aria-hidden="true" />}
        />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">互动趋势</CardTitle>
                <CardDescription className="mt-1 text-xs">
                  发布、点赞、评论、转发的每日变化，点击序列可切换显示
                </CardDescription>
              </div>
              <DaysSelector
                value={days}
                onChange={handleDaysChange}
                disabled={loading}
              />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <TrendChartSkeleton />
            ) : hasTrendData ? (
              <InteractionTrendChart
                trend={payload.trend}
                days={days}
                height={280}
              />
            ) : (
              <ChartEmptyState
                title="暂无趋势数据"
                description={`近${days}天还没有发布内容或互动`}
              />
            )}
            {latestTrend && hasTrendData ? (
              <div
                aria-label="最新一天详情"
                className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-600 sm:grid-cols-4"
              >
                <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                  <div className="text-[10px] text-slate-400">
                    {formatDateLabel(latestTrend.date)} 发帖
                  </div>
                  <div className="mt-0.5 text-sm font-semibold tabular-nums text-slate-800">
                    {formatCount(latestTrend.posts)}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                  <div className="text-[10px] text-slate-400">
                    {formatDateLabel(latestTrend.date)} 点赞
                  </div>
                  <div className="mt-0.5 text-sm font-semibold tabular-nums text-rose-600">
                    {formatCount(latestTrend.likes)}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                  <div className="text-[10px] text-slate-400">
                    {formatDateLabel(latestTrend.date)} 评论
                  </div>
                  <div className="mt-0.5 text-sm font-semibold tabular-nums text-sky-600">
                    {formatCount(latestTrend.comments)}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                  <div className="text-[10px] text-slate-400">
                    {formatDateLabel(latestTrend.date)} 转发
                  </div>
                  <div className="mt-0.5 text-sm font-semibold tabular-nums text-emerald-600">
                    {formatCount(latestTrend.reposts)}
                  </div>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">互动构成</CardTitle>
                <CardDescription className="mt-1 text-xs">
                  {DAY_OPTIONS.find((o) => o.value === days)?.label}赞评转比例分布（共
                  {formatCount(rangeComposition.total)}）
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <CompositionChartSkeleton />
            ) : hasTrendData ? (
              <InteractionCompositionChart trend={payload.trend} days={days} />
            ) : (
              <ChartEmptyState
                title="暂无互动数据"
                description={`近${days}天还没有点赞、评论或转发`}
                icon={<Heart className="h-6 w-6" aria-hidden="true" />}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">我的动态榜单</CardTitle>
          <CardDescription className="mt-1 text-xs">
            按热度排序的优质内容
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {payload.topPosts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 px-3 py-10 text-center text-sm text-slate-500">
              还没有发布动态
            </div>
          ) : null}
          {payload.topPosts.map((post, index) => (
            <Link
              key={post.id}
              to={`/post/${post.id}`}
              className="flex items-start gap-3 rounded-xl border border-slate-200 px-3 py-3 transition-colors hover:bg-slate-50"
              aria-label={`第${index + 1}名动态，内容摘要：${post.content.slice(0, 30)}`}
            >
              <span
                className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  index === 0
                    ? "bg-amber-100 text-amber-700"
                    : index === 1
                    ? "bg-slate-200 text-slate-600"
                    : index === 2
                    ? "bg-orange-100 text-orange-700"
                    : "bg-slate-100 text-slate-600"
                }`}
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm text-slate-800">{post.content}</p>
                <p className="mt-1 text-xs text-slate-500">
                  点赞 {formatCount(post.likesCount)} · 评论 {formatCount(post.commentsCount)} ·
                  转发 {formatCount(post.repostsCount)}
                </p>
              </div>
              {post.cover ? (
                <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-slate-200">
                  {post.cover.type === "image" ? (
                    <img
                      src={post.cover.url}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <video
                      src={post.cover.url}
                      className="h-full w-full object-cover"
                      aria-hidden="true"
                    />
                  )}
                </span>
              ) : null}
            </Link>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}
