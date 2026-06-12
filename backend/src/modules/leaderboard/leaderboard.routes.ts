import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../config/prisma";
import { ok } from "../../utils/response";
import { withMediaPrefix } from "../../utils/post-mapper";
import { FEED_POST_INCLUDE, toFeedItems } from "../posts/post.presenter";

export type LeaderboardPeriod = "day" | "week" | "total";
export type CreatorSortBy = "followers" | "interactions";

const periodSchema = z.enum(["day", "week", "total"]).default("total");
const limitSchema = z.coerce.number().min(1).max(50).default(20);
const cursorSchema = z.string().optional();

function getPeriodDateRange(period: LeaderboardPeriod): {
  start: Date;
  end: Date;
  prevStart: Date;
  prevEnd: Date;
} {
  const now = new Date();
  const end = new Date(now);

  if (period === "day") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const prevEnd = new Date(start);
    prevEnd.setMilliseconds(prevEnd.getMilliseconds() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setHours(0, 0, 0, 0);
    return { start, end, prevStart, prevEnd };
  }

  if (period === "week") {
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const start = new Date(now);
    start.setDate(start.getDate() + diffToMonday);
    start.setHours(0, 0, 0, 0);
    const prevEnd = new Date(start);
    prevEnd.setMilliseconds(prevEnd.getMilliseconds() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - 6);
    prevStart.setHours(0, 0, 0, 0);
    return { start, end, prevStart, prevEnd };
  }

  const start = new Date(0);
  const prevStart = new Date(0);
  const prevEnd = new Date(0);
  return { start, end, prevStart, prevEnd };
}

function computeRateChange(current: number, previous: number): number | null {
  if (previous === 0) {
    return current > 0 ? 100 : null;
  }
  const rate = ((current - previous) / previous) * 100;
  return Math.round(rate * 10) / 10;
}

export const leaderboardRouter = Router();

const postsQuerySchema = z.object({
  period: periodSchema,
  limit: limitSchema,
  cursor: cursorSchema
});

leaderboardRouter.get("/leaderboard/posts", async (req, res) => {
  const { period, limit, cursor } = postsQuerySchema.parse(req.query);
  const { start, end, prevStart, prevEnd } = getPeriodDateRange(period);
  const cursorId = cursor ? Number(cursor) : null;
  const currentUserId = req.auth?.userId;

  const where =
    period === "total"
      ? cursorId
        ? { hotScore: { lte: cursorId } }
        : undefined
      : {
          createdAt: { gte: start, lte: end },
          ...(cursorId ? { id: { lt: cursorId } } : {})
        };

  const posts = await prisma.post.findMany({
    where,
    orderBy:
      period === "total"
        ? [{ hotScore: "desc" }, { id: "desc" }]
        : [{ hotScore: "desc" }, { id: "desc" }],
    take: limit + 1,
    include: FEED_POST_INCLUDE
  });

  const hasMore = posts.length > limit;
  const slice = hasMore ? posts.slice(0, limit) : posts;
  const items = await toFeedItems(slice, currentUserId);

  let previousPostIds: number[] = [];
  if (period !== "total" && slice.length > 0) {
    const previousPosts = await prisma.post.findMany({
      where: {
        createdAt: { gte: prevStart, lte: prevEnd }
      },
      orderBy: [{ hotScore: "desc" }, { id: "desc" }],
      take: limit * 3,
      select: { id: true, hotScore: true }
    });
    previousPostIds = previousPosts.map((p) => p.id);
  }

  const rankedItems = items.map((item, idx) => {
    const previousRank =
      period === "total"
        ? null
        : previousPostIds.indexOf(item.id);
    const rankChange =
      previousRank === -1 || previousRank === null
        ? null
        : previousRank - idx;

    return {
      rank: idx + 1,
      rankChange,
      hotScore: slice[idx].hotScore,
      hotScoreChange: null as number | null,
      item
    };
  });

  if (period !== "total" && slice.length > 0) {
    const currentPostIds = slice.map((p) => p.id);
    const [currentInteractions, previousInteractions] = await Promise.all([
      prisma.like.groupBy({
        by: ["postId"],
        where: { postId: { in: currentPostIds }, createdAt: { gte: start, lte: end } },
        _count: { postId: true }
      }),
      prisma.like.groupBy({
        by: ["postId"],
        where: { postId: { in: currentPostIds }, createdAt: { gte: prevStart, lte: prevEnd } },
        _count: { postId: true }
      })
    ]);

    const currentCountMap = new Map<number, number>(
      currentInteractions.map((i: any) => [i.postId as number, i._count.postId as number])
    );
    const previousCountMap = new Map<number, number>(
      previousInteractions.map((i: any) => [i.postId as number, i._count.postId as number])
    );

    rankedItems.forEach((entry, idx) => {
      const postId = slice[idx].id;
      const currentCount = currentCountMap.get(postId) ?? 0;
      const previousCount = previousCountMap.get(postId) ?? 0;
      entry.hotScoreChange = computeRateChange(currentCount, previousCount);
    });
  }

  const lastItem = slice[slice.length - 1];
  const nextCursor =
    hasMore && lastItem
      ? period === "total"
        ? String(lastItem.hotScore)
        : String(lastItem.id)
      : null;

  ok(res, {
    items: rankedItems,
    nextCursor
  });
});

const topicsQuerySchema = z.object({
  period: periodSchema,
  limit: limitSchema,
  cursor: cursorSchema
});

leaderboardRouter.get("/leaderboard/topics", async (req, res) => {
  const { period, limit, cursor } = topicsQuerySchema.parse(req.query);
  const { start, end, prevStart, prevEnd } = getPeriodDateRange(period);
  const cursorId = cursor ? Number(cursor) : null;

  if (period === "total") {
    const where = cursorId ? { rank: { gte: cursorId } } : undefined;
    const topics = await prisma.topic.findMany({
      where,
      orderBy: [{ rank: "asc" }, { id: "asc" }],
      take: limit + 1
    });

    const hasMore = topics.length > limit;
    const slice = hasMore ? topics.slice(0, limit) : topics;

    const rankedItems = slice.map((topic, idx) => ({
      rank: idx + 1,
      rankChange: null as number | null,
      heat: topic.heat,
      heatChange: null as number | null,
      topic: {
        id: topic.id,
        keyword: topic.keyword,
        tag: topic.tag,
        heat: topic.heat
      }
    }));

    const lastItem = slice[slice.length - 1];
    const nextCursor = hasMore && lastItem ? String(lastItem.rank) : null;

    ok(res, { items: rankedItems, nextCursor });
    return;
  }

  const cursorHeat = cursorId ?? null;

  const topicPosts = await prisma.postTopic.findMany({
    where: {
      post: {
        createdAt: { gte: start, lte: end }
      }
    },
    include: {
      topic: true,
      post: {
        select: {
          likesCount: true,
          commentsCount: true,
          repostsCount: true,
          hotScore: true
        }
      }
    }
  });

  const topicHeatMap = new Map<
    number,
    { topic: typeof topicPosts[0]["topic"]; heat: number; postCount: number }
  >();

  for (const tp of topicPosts) {
    const existing = topicHeatMap.get(tp.topicId);
    const postHeat =
      tp.post.likesCount + tp.post.commentsCount * 2 + tp.post.repostsCount * 3 + tp.post.hotScore;

    if (existing) {
      existing.heat += postHeat;
      existing.postCount += 1;
    } else {
      topicHeatMap.set(tp.topicId, {
        topic: tp.topic,
        heat: postHeat,
        postCount: 1
      });
    }
  }

  const rankedTopics = Array.from(topicHeatMap.values()).sort((a, b) => b.heat - a.heat);

  let filtered = rankedTopics;
  if (cursorHeat !== null) {
    filtered = rankedTopics.filter((t) => t.heat < cursorHeat);
  }

  const hasMore = filtered.length > limit;
  const slice = hasMore ? filtered.slice(0, limit) : filtered;

  const prevTopicPosts = await prisma.postTopic.findMany({
    where: {
      post: {
        createdAt: { gte: prevStart, lte: prevEnd }
      }
    },
    include: {
      topic: true,
      post: {
        select: {
          likesCount: true,
          commentsCount: true,
          repostsCount: true,
          hotScore: true
        }
      }
    }
  });

  const prevHeatMap = new Map<number, number>();
  for (const tp of prevTopicPosts) {
    const postHeat =
      tp.post.likesCount + tp.post.commentsCount * 2 + tp.post.repostsCount * 3 + tp.post.hotScore;
    prevHeatMap.set(tp.topicId, (prevHeatMap.get(tp.topicId) ?? 0) + postHeat);
  }

  const prevRanked = Array.from(prevHeatMap.entries()).sort((a, b) => b[1] - a[1]);
  const prevRankMap = new Map(prevRanked.map((entry, idx) => [entry[0], idx]));

  const rankedItems = slice.map((entry, idx) => {
    const prevHeat = prevHeatMap.get(entry.topic.id) ?? 0;
    const prevRank = prevRankMap.get(entry.topic.id);
    const rankChange = prevRank === undefined ? null : prevRank - idx;

    return {
      rank: idx + 1,
      rankChange,
      heat: entry.heat,
      heatChange: computeRateChange(entry.heat, prevHeat),
      topic: {
        id: entry.topic.id,
        keyword: entry.topic.keyword,
        tag: entry.topic.tag,
        heat: entry.heat,
        postCount: entry.postCount
      }
    };
  });

  const lastItem = slice[slice.length - 1];
  const nextCursor = hasMore && lastItem ? String(lastItem.heat) : null;

  ok(res, { items: rankedItems, nextCursor });
});

const creatorsQuerySchema = z.object({
  period: periodSchema,
  sortBy: z.enum(["followers", "interactions"]).default("followers"),
  limit: limitSchema,
  cursor: cursorSchema
});

leaderboardRouter.get("/leaderboard/creators", async (req, res) => {
  const { period, sortBy, limit, cursor } = creatorsQuerySchema.parse(req.query);
  const { start, end, prevStart, prevEnd } = getPeriodDateRange(period);
  const currentUserId = req.auth?.userId;
  const cursorValue = cursor ? Number(cursor) : null;

  let creators: Array<{
    user: {
      id: number;
      nickname: string;
      avatarUrl: string | null;
      level: string;
      bio: string | null;
      followersCount: number;
    };
    followersDelta: number;
    interactionsScore: number;
  }> = [];

  if (period === "total") {
    const where = cursorValue ? { followersCount: { lte: cursorValue } } : undefined;
    const users = await prisma.user.findMany({
      where,
      orderBy: [{ followersCount: "desc" }, { id: "asc" }],
      take: limit + 1,
      select: {
        id: true,
        nickname: true,
        avatarUrl: true,
        level: true,
        bio: true,
        followersCount: true
      }
    });

    creators = users.map((user) => ({
      user,
      followersDelta: user.followersCount,
      interactionsScore: 0
    }));
  } else {
    const [newFollows, postsWithInteractions] = await Promise.all([
      prisma.follow.groupBy({
        by: ["followingId"],
        where: { createdAt: { gte: start, lte: end } },
        _count: { followingId: true }
      }),
      prisma.post.findMany({
        where: { createdAt: { gte: start, lte: end } },
        select: {
          authorId: true,
          likesCount: true,
          commentsCount: true,
          repostsCount: true,
          hotScore: true
        }
      })
    ]);

    const followMap = new Map<number, number>(newFollows.map((f: any) => [f.followingId as number, f._count.followingId as number]));

    const interactionsMap = new Map<number, number>();
    for (const post of postsWithInteractions) {
      const score =
        post.likesCount + post.commentsCount * 2 + post.repostsCount * 3 + post.hotScore;
      interactionsMap.set(
        post.authorId,
        (interactionsMap.get(post.authorId) ?? 0) + score
      );
    }

    const allUserIds = new Set<number>([
      ...followMap.keys(),
      ...interactionsMap.keys()
    ]);

    const userIds = Array.from(allUserIds);
    const users =
      userIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: {
              id: true,
              nickname: true,
              avatarUrl: true,
              level: true,
              bio: true,
              followersCount: true
            }
          })
        : [];

    const userMap = new Map(users.map((u) => [u.id, u]));

    creators = userIds
      .map((id) => {
        const user = userMap.get(id);
        if (!user) return null;
        return {
          user,
          followersDelta: followMap.get(id) ?? 0,
          interactionsScore: interactionsMap.get(id) ?? 0
        };
      })
      .filter(
        (c): c is NonNullable<typeof c> => c !== null
      );

    if (sortBy === "followers") {
      creators.sort((a, b) => b.followersDelta - a.followersDelta || b.user.followersCount - a.user.followersCount);
    } else {
      creators.sort((a, b) => b.interactionsScore - a.interactionsScore || b.user.followersCount - a.user.followersCount);
    }

    if (cursorValue !== null) {
      creators = creators.filter((c) =>
        sortBy === "followers"
          ? c.followersDelta < cursorValue
          : c.interactionsScore < cursorValue
      );
    }

    if (creators.length > limit + 1) {
      creators = creators.slice(0, limit + 1);
    }
  }

  const hasMore = creators.length > limit;
  const slice = hasMore ? creators.slice(0, limit) : creators;

  let followSet = new Set<number>();
  if (currentUserId && slice.length > 0) {
    const follows = await prisma.follow.findMany({
      where: {
        followerId: currentUserId,
        followingId: { in: slice.map((c) => c.user.id) }
      },
      select: { followingId: true }
    });
    followSet = new Set(follows.map((f) => f.followingId));
  }

  let prevData: Map<number, { rank: number; value: number }> = new Map();
  if (period !== "total" && slice.length > 0) {
    const [prevFollows, prevPosts] = await Promise.all([
      prisma.follow.groupBy({
        by: ["followingId"],
        where: { createdAt: { gte: prevStart, lte: prevEnd } },
        _count: { followingId: true }
      }),
      prisma.post.findMany({
        where: { createdAt: { gte: prevStart, lte: prevEnd } },
        select: {
          authorId: true,
          likesCount: true,
          commentsCount: true,
          repostsCount: true,
          hotScore: true
        }
      })
    ]);

    const prevFollowMap = new Map<number, number>(prevFollows.map((f: any) => [f.followingId as number, f._count.followingId as number]));
    const prevInteractionsMap = new Map<number, number>();
    for (const post of prevPosts as any[]) {
      const score =
        post.likesCount + post.commentsCount * 2 + post.repostsCount * 3 + post.hotScore;
      prevInteractionsMap.set(
        post.authorId,
        (prevInteractionsMap.get(post.authorId) ?? 0) + score
      );
    }

    const sliceUserIds = slice.map((c) => c.user.id);
    const prevCreators: Array<{ id: number; value: number }> = sliceUserIds
      .map((id) => ({
        id,
        value: sortBy === "followers"
          ? (prevFollowMap.get(id) ?? 0)
          : (prevInteractionsMap.get(id) ?? 0)
      }))
      .sort((a, b) => b.value - a.value);

    prevData = new Map<number, { rank: number; value: number }>(prevCreators.map((c, idx) => [c.id, { rank: idx, value: c.value }]));
  }

  const rankedItems = slice.map((entry, idx) => {
    const metricValue =
      sortBy === "followers" ? entry.followersDelta : entry.interactionsScore;
    const prevEntry = prevData.get(entry.user.id);
    const rankChange = prevEntry ? prevEntry.rank - idx : null;
    const metricChange = prevEntry ? computeRateChange(metricValue, prevEntry.value) : null;

    return {
      rank: idx + 1,
      rankChange,
      metricValue,
      metricChange,
      creator: {
        id: entry.user.id,
        nickname: entry.user.nickname,
        avatarUrl: withMediaPrefix(entry.user.avatarUrl),
        level: entry.user.level,
        bio: entry.user.bio,
        followersCount: entry.user.followersCount,
        isFollowed: followSet.has(entry.user.id)
      }
    };
  });

  const lastItem = slice[slice.length - 1];
  const nextCursor =
    hasMore && lastItem
      ? period === "total"
        ? String(lastItem.user.followersCount)
        : sortBy === "followers"
          ? String(lastItem.followersDelta)
          : String(lastItem.interactionsScore)
      : null;

  ok(res, {
    items: rankedItems,
    nextCursor
  });
});
