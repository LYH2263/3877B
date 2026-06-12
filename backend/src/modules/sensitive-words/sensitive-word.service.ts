import { SensitiveWordLevel } from "@prisma/client";

import { prisma } from "../../config/prisma";
import {
  type SensitiveWordCheckResult,
  SensitiveWordFilter,
  getSensitiveFilter,
  initSensitiveFilter
} from "../../utils/sensitive-words";

export async function loadSensitiveWords(): Promise<{ word: string; level: SensitiveWordLevel }[]> {
  const words = await prisma.sensitiveWord.findMany({
    select: {
      word: true,
      level: true
    }
  });
  return words.map((w) => ({ word: w.word, level: w.level as SensitiveWordLevel }));
}

export async function refreshSensitiveFilter(): Promise<void> {
  const words = await loadSensitiveWords();
  initSensitiveFilter(words);
}

export async function addSensitiveWord(
  word: string,
  level: SensitiveWordLevel,
  category?: string
): Promise<{ word: string; level: SensitiveWordLevel }> {
  const result = await prisma.sensitiveWord.upsert({
    where: { word },
    create: { word, level, category },
    update: { level, category }
  });
  await refreshSensitiveFilter();
  return { word: result.word, level: result.level as SensitiveWordLevel };
}

export async function removeSensitiveWord(word: string): Promise<void> {
  await prisma.sensitiveWord.delete({ where: { word } });
  await refreshSensitiveFilter();
}

export async function listSensitiveWords(
  level?: SensitiveWordLevel,
  page = 1,
  pageSize = 20
): Promise<{
  items: { id: number; word: string; level: SensitiveWordLevel; category: string | null; createdAt: Date }[];
  total: number;
}> {
  const where = level ? { level } : {};
  const [items, total] = await Promise.all([
    prisma.sensitiveWord.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" }
    }),
    prisma.sensitiveWord.count({ where })
  ]);
  return {
    items: items.map((item) => ({
      id: item.id,
      word: item.word,
      level: item.level as SensitiveWordLevel,
      category: item.category,
      createdAt: item.createdAt
    })),
    total
  };
}

export function checkSensitiveWords(text: string): SensitiveWordCheckResult {
  const filter = getSensitiveFilter();
  return filter.check(text);
}

export async function recordSensitiveHit(
  word: string,
  level: SensitiveWordLevel,
  targetType: string,
  targetId: number | null,
  userId: number | null,
  content: string
): Promise<void> {
  await prisma.sensitiveWordHit.create({
    data: {
      word,
      level,
      targetType,
      targetId,
      userId,
      content
    }
  });
}

export function validateContent(
  content: string
): {
  valid: boolean;
  forbiddenWords: string[];
  warningWords: string[];
  message: string;
} {
  const result = checkSensitiveWords(content);

  const forbiddenWords = result.forbiddenMatches.map((m) => m.word);
  const warningWords = result.warningMatches.map((m) => m.word);

  if (result.hasForbidden) {
    return {
      valid: false,
      forbiddenWords,
      warningWords,
      message: `内容包含违规词汇：${forbiddenWords.join("、")}，请修改后再发布`
    };
  }

  return {
    valid: true,
    forbiddenWords,
    warningWords,
    message: result.hasWarning ? `内容包含敏感词：${warningWords.join("、")}，请注意措辞` : ""
  };
}
