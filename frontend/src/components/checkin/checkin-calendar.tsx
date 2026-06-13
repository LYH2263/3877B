import { Check, Gift } from "lucide-react";

import { cn } from "@/lib/utils";
import type { CheckInDayRecord } from "@/types/models";

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

interface CheckInCalendarProps {
  records: CheckInDayRecord[];
  year: number;
  month: number;
}

export function CheckInCalendar({ records, year, month }: CheckInCalendarProps) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startWeekday = firstDay.getDay();

  const cells: Array<{ type: "empty" } | { type: "day"; record: CheckInDayRecord }> = [];

  for (let i = 0; i < startWeekday; i++) {
    cells.push({ type: "empty" });
  }

  const recordMap = new Map<string, CheckInDayRecord>();
  for (const record of records) {
    recordMap.set(record.date, record);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const record = recordMap.get(dateStr) ?? {
      date: dateStr,
      checkedIn: false,
      isToday: false,
      pointsEarned: 0,
      streakDays: 0
    };
    cells.push({ type: "day", record });
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="py-1 text-xs font-medium text-slate-500">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, index) => {
          if (cell.type === "empty") {
            return <div key={`empty-${index}`} className="aspect-square" />;
          }

          const { record } = cell;
          const dayNum = Number(record.date.split("-")[2]);
          const future = !record.isToday && new Date(`${record.date}T23:59:59`) > new Date();

          return (
            <div
              key={record.date}
              className={cn(
                "relative flex aspect-square flex-col items-center justify-center rounded-lg text-xs transition-all",
                record.isToday && record.checkedIn && "ring-2 ring-brand-400 ring-offset-1",
                record.isToday && !record.checkedIn && "ring-2 ring-brand-300 ring-offset-1",
                record.checkedIn && !record.isToday && "bg-brand-50 text-brand-700",
                !record.checkedIn && !record.isToday && !future && "bg-slate-50 text-slate-400",
                !record.checkedIn && !record.isToday && future && "text-slate-300",
              )}
              title={`${record.date}${record.checkedIn ? ` · 获得 ${record.pointsEarned} 积分` : ""}`}
            >
              <span
                className={cn(
                  "font-medium",
                  record.isToday && !record.checkedIn && "text-brand-600",
                  record.isToday && record.checkedIn && "text-brand-700",
                )}
              >
                {dayNum}
              </span>

              {record.checkedIn ? (
                <span className="mt-0.5 inline-flex items-center justify-center">
                  <Check className={cn("h-3 w-3", record.pointsEarned > 10 ? "text-amber-500" : "text-brand-500")} />
                </span>
              ) : record.isToday ? (
                <Gift className="mt-0.5 h-3 w-3 text-brand-400 animate-pulse" />
              ) : null}

              {record.isToday && (
                <span className="absolute -top-1 right-1 rounded-full bg-brand-500 px-1 text-[9px] font-medium text-white">
                  今
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
