import { SensitiveWordLevel } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { requireAuth } from "../../middleware/auth";
import { fail, ok } from "../../utils/response";
import {
  addSensitiveWord,
  listSensitiveWords,
  refreshSensitiveFilter,
  removeSensitiveWord
} from "./sensitive-word.service";

export const sensitiveWordsRouter = Router();

const addWordSchema = z.object({
  word: z.string().min(1, "敏感词不能为空").max(100, "敏感词过长"),
  level: z.enum(["forbidden", "warning"]),
  category: z.string().optional()
});

const removeWordSchema = z.object({
  word: z.string().min(1)
});

sensitiveWordsRouter.get("/", requireAuth, async (req, res) => {
  try {
    const level = req.query.level as SensitiveWordLevel | undefined;
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 20;

    const result = await listSensitiveWords(level, page, pageSize);
    ok(res, result);
  } catch (error) {
    fail(res, 500, "获取敏感词列表失败");
  }
});

sensitiveWordsRouter.post("/", requireAuth, async (req, res) => {
  const parsed = addWordSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, 400, parsed.error.issues[0]?.message ?? "参数错误");
    return;
  }

  try {
    const result = await addSensitiveWord(
      parsed.data.word,
      parsed.data.level as SensitiveWordLevel,
      parsed.data.category
    );
    ok(res, result, "添加成功", 201);
  } catch (error) {
    fail(res, 500, "添加敏感词失败");
  }
});

sensitiveWordsRouter.delete("/", requireAuth, async (req, res) => {
  const parsed = removeWordSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, 400, "参数错误");
    return;
  }

  try {
    await removeSensitiveWord(parsed.data.word);
    ok(res, null, "删除成功");
  } catch (error) {
    fail(res, 500, "删除敏感词失败");
  }
});

sensitiveWordsRouter.post("/refresh", requireAuth, async (_req, res) => {
  try {
    await refreshSensitiveFilter();
    ok(res, null, "刷新成功");
  } catch (error) {
    fail(res, 500, "刷新敏感词失败");
  }
});
