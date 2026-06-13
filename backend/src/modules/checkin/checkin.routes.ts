import { Router } from "express";

import { requireAuth } from "../../middleware/auth";
import { fail, ok } from "../../utils/response";
import { BONUS_TIERS, BASE_POINTS, getCheckInStatus, performCheckIn, TIMEZONE_OFFSET } from "./checkin.service";

export const checkInRouter = Router();

checkInRouter.use(requireAuth);

checkInRouter.get("/status", async (req, res) => {
  try {
    if (!req.auth) {
      fail(res, 401, "请先登录");
      return;
    }

    const timezoneOffset = Number(req.query.timezoneOffset) || TIMEZONE_OFFSET;
    const status = await getCheckInStatus(req.auth.userId, timezoneOffset);

    ok(res, status);
  } catch (error) {
    console.error("获取签到状态失败:", error);
    fail(res, 500, "获取签到状态失败");
  }
});

checkInRouter.post("/checkin", async (req, res) => {
  try {
    if (!req.auth) {
      fail(res, 401, "请先登录");
      return;
    }

    const timezoneOffset = Number(req.body?.timezoneOffset) || TIMEZONE_OFFSET;
    const result = await performCheckIn(req.auth.userId, timezoneOffset);

    if (result.alreadyCheckedIn) {
      ok(res, result, "今日已签到");
      return;
    }

    ok(res, result, "签到成功");
  } catch (error) {
    console.error("签到失败:", error);
    fail(res, 500, "签到失败，请稍后重试");
  }
});

checkInRouter.get("/config", async (_req, res) => {
  ok(res, {
    basePoints: BASE_POINTS,
    bonusTiers: BONUS_TIERS,
    timezoneOffset: TIMEZONE_OFFSET
  });
});
