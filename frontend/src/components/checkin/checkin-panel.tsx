import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Award, Calendar, Flame, Gift, Sparkles, Trophy, Zap } from "lucide-react";
import { toast } from "sonner";

import { fetchCheckInStatus, fetchCheckInConfig, performCheckIn } from "@/api/checkin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { parseApiError } from "@/lib/api-error";
import type { BonusTier, CheckInConfig, CheckInStatus, CheckInResult } from "@/types/models";
import { CheckInCalendar } from "./checkin-calendar";

const WEEKDAY_NAMES = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

interface SignInAnimationState {
  show: boolean;
  points: number;
  streak: number;
  label: string;
}

function getMonthLabel(date: Date) {
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long"
  });
}

function getTimezoneOffsetMinutes(): number {
  return -new Date().getTimezoneOffset();
}

function getNextMidnightMs(): number {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}

export function CheckInPanel() {
  const [status, setStatus] = useState<CheckInStatus | null>(null);
  const [config, setConfig] = useState<CheckInConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [animation, setAnimation] = useState<SignInAnimationState | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const animTimerRef = useRef<number | null>(null);
  const midnightTimerRef = useRef<number | null>(null);
  const refreshTimerRef = useRef<number | null>(null);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }
    try {
      const timezoneOffset = getTimezoneOffsetMinutes();
      const [statusData, configData] = await Promise.all([
        fetchCheckInStatus(timezoneOffset),
        fetchCheckInConfig()
      ]);
      setStatus(statusData);
      setConfig(configData);
    } catch (error) {
      if (!silent) {
        const parsed = parseApiError(error);
        toast.error(parsed.message || "签到数据加载失败");
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadData();

    return () => {
      if (animTimerRef.current !== null) {
        window.clearTimeout(animTimerRef.current);
      }
      if (midnightTimerRef.current !== null) {
        window.clearTimeout(midnightTimerRef.current);
      }
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
      }
    };
  }, [loadData]);

  useEffect(() => {
    const scheduleMidnightRefresh = () => {
      const delay = getNextMidnightMs() + 2000;
      midnightTimerRef.current = window.setTimeout(() => {
        void loadData(true);
        const now = new Date();
        setCurrentMonth({ year: now.getFullYear(), month: now.getMonth() });
        scheduleMidnightRefresh();
      }, delay);
    };

    scheduleMidnightRefresh();

    return () => {
      if (midnightTimerRef.current !== null) {
        window.clearTimeout(midnightTimerRef.current);
      }
    };
  }, [loadData]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void loadData(true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [loadData]);

  const handleCheckIn = useCallback(async () => {
    if (checkingIn || !status || status.todayCheckedIn) {
      return;
    }

    setCheckingIn(true);
    try {
      const timezoneOffset = getTimezoneOffsetMinutes();
      const result: CheckInResult = await performCheckIn(timezoneOffset);

      if (result.alreadyCheckedIn) {
        toast.info("今日已签到，明天再来吧～");
      } else if (result.success) {
        if (animTimerRef.current !== null) {
          window.clearTimeout(animTimerRef.current);
        }
        setAnimation({
          show: true,
          points: result.pointsEarned,
          streak: result.streakDays,
          label: result.bonusLabel
        });

        animTimerRef.current = window.setTimeout(() => {
          setAnimation(null);
        }, 2500);

        toast.success(`签到成功！获得 ${result.pointsEarned} 积分${result.bonusLabel !== "基础签到" ? `（${result.bonusLabel}）` : ""}`);
      }

      await loadData(true);
    } catch (error) {
      const parsed = parseApiError(error);
      toast.error(parsed.message || "签到失败，请稍后重试");
    } finally {
      setCheckingIn(false);
    }
  }, [checkingIn, status, loadData]);

  const todayInfo = useMemo(() => {
    const now = new Date();
    return {
      dateLabel: now.toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric"
      }),
      weekdayLabel: WEEKDAY_NAMES[now.getDay()]
    };
  }, []);

  const nextBonusInfo = status?.nextBonus;

  if (loading && !status) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-brand-500" />
            每日签到
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden">
      {animation?.show && (
        <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
          <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-brand-100/60 via-amber-50/40 to-transparent" />
          {Array.from({ length: 12 }).map((_, i) => (
            <Sparkles
              key={i}
              className="absolute text-amber-400 animate-bounce"
              style={{
                left: `${10 + (i * 7) % 80}%`,
                top: `${10 + (i * 11) % 70}%`,
                animationDelay: `${i * 80}ms`,
                animationDuration: `${800 + (i % 3) * 200}ms`,
                width: `${12 + (i % 3) * 4}px`,
                height: `${12 + (i % 3) * 4}px`,
                opacity: 0.8
              }}
            />
          ))}
          <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 text-center animate-[fadeInUp_0.4s_ease-out]">
            <p className="text-lg font-bold text-brand-600 drop-shadow-sm">+{animation.points}</p>
            <p className="text-xs text-brand-500">积分</p>
          </div>
        </div>
      )}

      <CardHeader className="border-b border-slate-100">
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="h-4 w-4 text-brand-500" />
          每日签到
          <span className="ml-auto text-xs font-normal text-slate-500">
            {todayInfo.dateLabel} {todayInfo.weekdayLabel}
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <div className="rounded-xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white p-3">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Zap className="h-3.5 w-3.5 text-brand-500" />
              累计积分
            </div>
            <p className="mt-1 text-xl font-bold text-brand-700 tabular-nums">
              {status?.totalPoints ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-orange-100 bg-gradient-to-br from-orange-50 to-white p-3">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Flame className="h-3.5 w-3.5 text-orange-500" />
              连续签到
            </div>
            <p className="mt-1 text-xl font-bold text-orange-700 tabular-nums">
              {status?.currentStreak ?? 0}
              <span className="ml-0.5 text-sm font-normal text-orange-500">天</span>
            </p>
          </div>
          <div className="rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-3">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Trophy className="h-3.5 w-3.5 text-amber-500" />
              最长连续
            </div>
            <p className="mt-1 text-xl font-bold text-amber-700 tabular-nums">
              {status?.longestStreak ?? 0}
              <span className="ml-0.5 text-sm font-normal text-amber-500">天</span>
            </p>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-3">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Award className="h-3.5 w-3.5 text-emerald-500" />
              累计签到
            </div>
            <p className="mt-1 text-xl font-bold text-emerald-700 tabular-nums">
              {status?.totalCheckInDays ?? 0}
              <span className="ml-0.5 text-sm font-normal text-emerald-500">天</span>
            </p>
          </div>
        </div>

        {config && (
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
            <p className="mb-2 text-xs font-medium text-slate-600">梯度奖励规则</p>
            <div className="flex flex-wrap gap-1.5">
              {config.bonusTiers.slice(1).map((tier: BonusTier, idx: number) => {
                const achieved = (status?.currentStreak ?? 0) >= tier.streakThreshold;
                return (
                  <div
                    key={tier.streakThreshold}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition",
                      achieved
                        ? "bg-amber-100 text-amber-700 ring-1 ring-amber-200"
                        : idx === 0 && nextBonusInfo?.threshold === tier.streakThreshold
                        ? "bg-brand-50 text-brand-600 ring-1 ring-brand-200 animate-pulse"
                        : "bg-white text-slate-500 ring-1 ring-slate-200"
                    )}
                  >
                    <Gift className="h-3 w-3" />
                    {tier.streakThreshold}天 +{tier.bonusPoints}
                  </div>
                );
              })}
            </div>
            {nextBonusInfo && (
              <p className="mt-2 text-xs text-slate-500">
                再签到 <span className="font-medium text-brand-600">{nextBonusInfo.daysUntilNext}</span> 天即可解锁
                <span className="mx-1 font-medium text-brand-600">{nextBonusInfo.label}</span>
                (+{nextBonusInfo.bonusPoints} 积分)
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 rounded-xl bg-gradient-to-r from-brand-50 via-amber-50 to-orange-50 p-4 border border-brand-100">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900">
              {status?.todayCheckedIn ? "今日已完成签到" : "今天还没有签到哦"}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {status?.todayCheckedIn
                ? `已获得 ${config ? config.basePoints : 10}+ 积分奖励，明天继续`
                : "签到可获得积分，连续签到奖励更多"}
            </p>
          </div>
          <Button
            onClick={handleCheckIn}
            disabled={checkingIn || status?.todayCheckedIn}
            size="lg"
            className={cn(
              "shrink-0 transition-all",
              !status?.todayCheckedIn && !checkingIn && "shadow-lg shadow-brand-500/20 hover:shadow-xl hover:shadow-brand-500/30 hover:-translate-y-0.5"
            )}
          >
            {checkingIn ? (
              <>
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-white" />
                签到中
              </>
            ) : status?.todayCheckedIn ? (
              <>
                <CheckDoneIcon />
                已签到
              </>
            ) : (
              <>
                <Gift className="h-4 w-4" />
                立即签到
              </>
            )}
          </Button>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">
              {getMonthLabel(new Date(currentMonth.year, currentMonth.month))}签到日历
            </p>
            <div className="flex items-center gap-3 text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded bg-brand-50 text-brand-600 ring-1 ring-brand-200" />
                已签
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded ring-2 ring-brand-300 ring-offset-1" />
                今日
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded bg-slate-50 text-slate-400" />
                未签
              </span>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <CheckInCalendar
              records={status?.monthRecords ?? []}
              year={currentMonth.year}
              month={currentMonth.month}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CheckDoneIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
