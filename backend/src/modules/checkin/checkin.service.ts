import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";

export interface BonusTier {
  streakThreshold: number;
  bonusPoints: number;
  label: string;
}

export const BONUS_TIERS: BonusTier[] = [
  { streakThreshold: 1, bonusPoints: 0, label: "基础签到" },
  { streakThreshold: 3, bonusPoints: 5, label: "连续3天奖励" },
  { streakThreshold: 7, bonusPoints: 15, label: "连续7天奖励" },
  { streakThreshold: 14, bonusPoints: 30, label: "连续14天奖励" },
  { streakThreshold: 30, bonusPoints: 60, label: "连续30天奖励" }
];

export const BASE_POINTS = 10;
export const TIMEZONE_OFFSET = 8 * 60;

export function getTodayDate(timezoneOffset = TIMEZONE_OFFSET): Date {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  const localDate = new Date(utc + timezoneOffset * 60 * 1000);
  localDate.setHours(0, 0, 0, 0);
  return localDate;
}

export function getYesterdayDate(timezoneOffset = TIMEZONE_OFFSET): Date {
  const today = getTodayDate(timezoneOffset);
  return new Date(today.getTime() - 24 * 60 * 60 * 1000);
}

export function getMonthRange(timezoneOffset = TIMEZONE_OFFSET): { start: Date; end: Date } {
  const today = getTodayDate(timezoneOffset);
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function calculateBonus(nextStreak: number): { tier: BonusTier; totalPoints: number; bonusLevel: number } {
  let currentTier = BONUS_TIERS[0];
  let bonusLevel = 0;

  for (let i = BONUS_TIERS.length - 1; i >= 0; i--) {
    if (nextStreak >= BONUS_TIERS[i].streakThreshold) {
      currentTier = BONUS_TIERS[i];
      bonusLevel = i;
      break;
    }
  }

  return {
    tier: currentTier,
    totalPoints: BASE_POINTS + currentTier.bonusPoints,
    bonusLevel
  };
}

export interface CheckInResult {
  success: boolean;
  alreadyCheckedIn: boolean;
  pointsEarned: number;
  streakDays: number;
  bonusLevel: number;
  bonusLabel: string;
  totalPoints: number;
  totalCheckInDays: number;
  longestStreak: number;
}

export async function performCheckIn(userId: number, timezoneOffset = TIMEZONE_OFFSET): Promise<CheckInResult> {
  const today = getTodayDate(timezoneOffset);
  const yesterday = getYesterdayDate(timezoneOffset);

  try {
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existingRecord = await tx.checkInRecord.findUnique({
        where: {
          userId_checkInDate: {
            userId,
            checkInDate: today
          }
        }
      });

      if (existingRecord) {
        const userPoints = await tx.userPoints.findUnique({
          where: { userId }
        });

        return {
          success: false,
          alreadyCheckedIn: true,
          pointsEarned: 0,
          streakDays: existingRecord.streakDays,
          bonusLevel: existingRecord.bonusLevel,
          bonusLabel: BONUS_TIERS[existingRecord.bonusLevel]?.label ?? "基础签到",
          totalPoints: userPoints?.totalPoints ?? 0,
          totalCheckInDays: userPoints?.totalCheckInDays ?? 0,
          longestStreak: userPoints?.longestStreak ?? 0
        };
      }

      const lastCheckIn = await tx.checkInRecord.findFirst({
        where: { userId },
        orderBy: { checkInDate: "desc" }
      });

      let nextStreak = 1;
      if (lastCheckIn) {
        const lastDate = new Date(lastCheckIn.checkInDate);
        lastDate.setHours(0, 0, 0, 0);
        const yesterdayNormalized = new Date(yesterday);
        yesterdayNormalized.setHours(0, 0, 0, 0);

        if (lastDate.getTime() === yesterdayNormalized.getTime()) {
          nextStreak = (lastCheckIn.streakDays ?? 1) + 1;
        }
      }

      const { tier, totalPoints: pointsEarned, bonusLevel } = calculateBonus(nextStreak);

      const checkInRecord = await tx.checkInRecord.create({
        data: {
          userId,
          checkInDate: today,
          pointsEarned,
          streakDays: nextStreak,
          bonusLevel
        }
      });

      const existingUserPoints = await tx.userPoints.findUnique({
        where: { userId }
      });

      let userPointsResult;
      if (existingUserPoints) {
        const newLongestStreak = Math.max(existingUserPoints.longestStreak, nextStreak);
        userPointsResult = await tx.userPoints.update({
          where: { userId },
          data: {
            totalPoints: { increment: pointsEarned },
            currentStreak: nextStreak,
            longestStreak: newLongestStreak,
            totalCheckInDays: { increment: 1 },
            lastCheckInDate: today
          }
        });
      } else {
        userPointsResult = await tx.userPoints.create({
          data: {
            userId,
            totalPoints: pointsEarned,
            currentStreak: nextStreak,
            longestStreak: nextStreak,
            totalCheckInDays: 1,
            lastCheckInDate: today
          }
        });
      }

      return {
        success: true,
        alreadyCheckedIn: false,
        pointsEarned: checkInRecord.pointsEarned,
        streakDays: checkInRecord.streakDays,
        bonusLevel: checkInRecord.bonusLevel,
        bonusLabel: tier.label,
        totalPoints: userPointsResult.totalPoints,
        totalCheckInDays: userPointsResult.totalCheckInDays,
        longestStreak: userPointsResult.longestStreak
      };
    }, { timeout: 10000 });

    return result;
  } catch (error) {
    const existingRecord = await prisma.checkInRecord.findUnique({
      where: {
        userId_checkInDate: {
          userId,
          checkInDate: today
        }
      }
    });

    if (existingRecord) {
      const userPoints = await prisma.userPoints.findUnique({
        where: { userId }
      });

      return {
        success: false,
        alreadyCheckedIn: true,
        pointsEarned: 0,
        streakDays: existingRecord.streakDays,
        bonusLevel: existingRecord.bonusLevel,
        bonusLabel: BONUS_TIERS[existingRecord.bonusLevel]?.label ?? "基础签到",
        totalPoints: userPoints?.totalPoints ?? 0,
        totalCheckInDays: userPoints?.totalCheckInDays ?? 0,
        longestStreak: userPoints?.longestStreak ?? 0
      };
    }

    throw error;
  }
}

export interface CheckInStatus {
  todayCheckedIn: boolean;
  currentStreak: number;
  longestStreak: number;
  totalPoints: number;
  totalCheckInDays: number;
  lastCheckInDate: string | null;
  monthRecords: Array<{
    date: string;
    checkedIn: boolean;
    isToday: boolean;
    pointsEarned: number;
    streakDays: number;
  }>;
  nextBonus: {
    threshold: number;
    bonusPoints: number;
    label: string;
    daysUntilNext: number;
  } | null;
}

export async function getCheckInStatus(userId: number, timezoneOffset = TIMEZONE_OFFSET): Promise<CheckInStatus> {
  const today = getTodayDate(timezoneOffset);
  const { start: monthStart, end: monthEnd } = getMonthRange(timezoneOffset);

  const [userPoints, monthRecords] = await Promise.all([
    prisma.userPoints.findUnique({
      where: { userId }
    }),
    prisma.checkInRecord.findMany({
      where: {
        userId,
        checkInDate: {
          gte: monthStart,
          lte: monthEnd
        }
      },
      orderBy: { checkInDate: "asc" }
    })
  ]);

  const recordMap = new Map<string, { pointsEarned: number; streakDays: number }>();
  for (const record of monthRecords) {
    const key = record.checkInDate.toISOString().split("T")[0];
    recordMap.set(key, {
      pointsEarned: record.pointsEarned,
      streakDays: record.streakDays
    });
  }

  const monthDates: Array<{
    date: string;
    checkedIn: boolean;
    isToday: boolean;
    pointsEarned: number;
    streakDays: number;
  }> = [];

  const currentDate = new Date(monthStart);
  while (currentDate <= monthEnd) {
    const dateStr = currentDate.toISOString().split("T")[0];
    const record = recordMap.get(dateStr);
    const todayStr = today.toISOString().split("T")[0];

    monthDates.push({
      date: dateStr,
      checkedIn: !!record,
      isToday: dateStr === todayStr,
      pointsEarned: record?.pointsEarned ?? 0,
      streakDays: record?.streakDays ?? 0
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  const currentStreak = userPoints?.currentStreak ?? 0;
  let nextBonus: CheckInStatus["nextBonus"] = null;

  for (const tier of BONUS_TIERS) {
    if (tier.streakThreshold > currentStreak) {
      nextBonus = {
        threshold: tier.streakThreshold,
        bonusPoints: tier.bonusPoints,
        label: tier.label,
        daysUntilNext: tier.streakThreshold - currentStreak
      };
      break;
    }
  }

  const todayRecord = await prisma.checkInRecord.findUnique({
    where: {
      userId_checkInDate: {
        userId,
        checkInDate: today
      }
    }
  });

  return {
    todayCheckedIn: !!todayRecord,
    currentStreak,
    longestStreak: userPoints?.longestStreak ?? 0,
    totalPoints: userPoints?.totalPoints ?? 0,
    totalCheckInDays: userPoints?.totalCheckInDays ?? 0,
    lastCheckInDate: userPoints?.lastCheckInDate ? userPoints.lastCheckInDate.toISOString().split("T")[0] : null,
    monthRecords: monthDates,
    nextBonus
  };
}
