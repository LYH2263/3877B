import fs from "node:fs";
import path from "node:path";

import { FeedChannel, MediaType, NotificationType } from "@prisma/client";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";

import { env } from "../../config/env";
import { prisma } from "../../config/prisma";
import { requireAuth } from "../../middleware/auth";
import { decodeCursor, encodeCursor } from "../../utils/cursor";
import { fail, ok } from "../../utils/response";
import { FEED_POST_INCLUDE, toFeedItems, toSingleFeedItem } from "./post.presenter";
import { withMediaPrefix } from "../../utils/post-mapper";
import { createNotificationIfAllowed } from "../messages/notification.service";
import { recordSensitiveHit, validateContent } from "../sensitive-words/sensitive-word.service";

const mediaDir = path.resolve(env.UPLOAD_DIR, "media");
fs.mkdirSync(mediaDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, mediaDir);
  },
  filename: (_req, file, cb) => {
    const suffix = path.extname(file.originalname) || ".bin";
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${suffix}`;
    cb(null, name);
  }
});

const upload = multer({ storage, limits: { files: 9, fileSize: 30 * 1024 * 1024 } });

const createPostSchema = z.object({
  content: z.string().trim().min(3, "正文至少 3 个字符").max(1000, "正文最多 1000 个字符"),
  channel: z.enum(["hot", "city"]).default("hot")
});

const commentBodySchema = z.object({
  content: z.string().trim().min(1, "评论不能为空").max(500, "评论最多 500 字")
});

const commentsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(30).default(10)
});

const repostBodySchema = z.object({
  content: z.string().trim().max(280, "短评最多 280 字").optional().default("")
});

function calculateHotScore(likesCount: number, commentsCount: number, repostsCount: number) {
  return likesCount * 4 + commentsCount * 6 + repostsCount * 8;
}

export const postsRouter = Router();

postsRouter.post("/", requireAuth, upload.array("media", 9), async (req, res) => {
  const parsed = createPostSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, 400, parsed.error.issues[0]?.message ?? "参数错误", parsed.error.flatten());
    return;
  }

  const validation = validateContent(parsed.data.content);
  if (!validation.valid) {
    fail(res, 400, validation.message, {
      forbiddenWords: validation.forbiddenWords,
      warningWords: validation.warningWords
    });
    return;
  }

  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const videos = files.filter((file) => file.mimetype.startsWith("video/"));
  const images = files.filter((file) => file.mimetype.startsWith("image/"));

  if (videos.length > 1) {
    fail(res, 400, "最多上传 1 个视频");
    return;
  }

  if (videos.length === 1 && images.length > 0) {
    fail(res, 400, "视频和图片不能混传");
    return;
  }

  const topicMatches = Array.from(parsed.data.content.matchAll(/#([^#\s]+)#/g)).map((item) => item[1]);
  const topicKeywords = Array.from(new Set(topicMatches)).slice(0, 8);

  const post = await prisma.post.create({
    data: {
      authorId: req.auth!.userId,
      content: parsed.data.content,
      source: "Web",
      channel: parsed.data.channel as FeedChannel,
      hotScore: 0,
      media: {
        create: files.map((file, index) => ({
          type: file.mimetype.startsWith("video/") ? MediaType.video : MediaType.image,
          url: `/uploads/media/${file.filename}`,
          sortOrder: index
        }))
      }
    }
  });

  for (const keyword of topicKeywords) {
    const topic = await prisma.topic.upsert({
      where: { keyword },
      create: {
        keyword,
        rank: 999,
        heat: 10000,
        tag: "新"
      },
      update: {
        heat: {
          increment: 1000
        }
      }
    });

    await prisma.postTopic.upsert({
      where: {
        postId_topicId: {
          postId: post.id,
          topicId: topic.id
        }
      },
      update: {},
      create: {
        postId: post.id,
        topicId: topic.id
      }
    });
  }

  const item = await toSingleFeedItem(post.id, req.auth!.userId);
  if (!item) {
    fail(res, 500, "发布成功但读取失败");
    return;
  }

  if (validation.warningWords.length > 0) {
    for (const word of validation.warningWords) {
      void recordSensitiveHit(word, "warning", "post", post.id, req.auth!.userId, parsed.data.content);
    }
  }

  ok(res, item, validation.warningWords.length > 0 ? `发布成功（${validation.message}）` : "发布成功", 201);
});

postsRouter.get("/:postId", async (req, res) => {
  const postId = Number(req.params.postId);
  if (!Number.isFinite(postId)) {
    fail(res, 400, "无效的动态ID");
    return;
  }

  const item = await toSingleFeedItem(postId, req.auth?.userId);
  if (!item) {
    fail(res, 404, "动态不存在");
    return;
  }

  ok(res, item);
});

postsRouter.post("/:postId/like", requireAuth, async (req, res) => {
  const postId = Number(req.params.postId);
  if (!Number.isFinite(postId)) {
    fail(res, 400, "无效的动态ID");
    return;
  }

  const postExists = await prisma.post.findUnique({ where: { id: postId }, select: { id: true, authorId: true } });
  if (!postExists) {
    fail(res, 404, "动态不存在");
    return;
  }

  const userId = req.auth!.userId;

  await prisma.$transaction(async (tx) => {
    const post = await tx.post.findUnique({
      where: { id: postId },
      select: { authorId: true, likesCount: true, commentsCount: true, repostsCount: true }
    });

    if (!post) {
      throw new Error("POST_NOT_FOUND");
    }

    const existing = await tx.like.findUnique({
      where: {
        userId_postId: {
          userId,
          postId
        }
      }
    });

    if (existing) {
      await tx.like.delete({ where: { id: existing.id } });
      const nextLikesCount = Math.max(0, post.likesCount - 1);
      await tx.post.update({
        where: { id: postId },
        data: {
          likesCount: nextLikesCount,
          hotScore: calculateHotScore(nextLikesCount, post.commentsCount, post.repostsCount)
        }
      });
    } else {
      await tx.like.create({ data: { userId, postId } });
      const nextLikesCount = post.likesCount + 1;
      await tx.post.update({
        where: { id: postId },
        data: {
          likesCount: nextLikesCount,
          hotScore: calculateHotScore(nextLikesCount, post.commentsCount, post.repostsCount)
        }
      });
      await createNotificationIfAllowed(tx, {
        targetUserId: post.authorId,
        actorUserId: userId,
        postId,
        type: NotificationType.LIKE,
        content: "赞了你的动态"
      });
    }
  });

  const item = await toSingleFeedItem(postId, userId);
  if (!item) {
    fail(res, 404, "动态不存在");
    return;
  }

  ok(res, item);
});

postsRouter.post("/:postId/repost", requireAuth, async (req, res) => {
  const postId = Number(req.params.postId);
  if (!Number.isFinite(postId)) {
    fail(res, 400, "无效的动态ID");
    return;
  }

  const parsed = repostBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    fail(res, 400, parsed.error.issues[0]?.message ?? "参数错误", parsed.error.flatten());
    return;
  }

  const repostComment = parsed.data.content.trim();

  let repostValidation = { valid: true as boolean, forbiddenWords: [] as string[], warningWords: [] as string[], message: "" };
  if (repostComment) {
    repostValidation = validateContent(repostComment);
    if (!repostValidation.valid) {
      fail(res, 400, repostValidation.message, {
        forbiddenWords: repostValidation.forbiddenWords,
        warningWords: repostValidation.warningWords
      });
      return;
    }
  }

  const postExists = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
  if (!postExists) {
    fail(res, 404, "动态不存在");
    return;
  }

  const userId = req.auth!.userId;
  let createdRepostPostId: number | null = null;

  try {
    await prisma.$transaction(async (tx) => {
      const post = await tx.post.findUnique({
        where: { id: postId },
        select: { authorId: true, likesCount: true, commentsCount: true, repostsCount: true, channel: true }
      });

      if (!post) {
        throw new Error("POST_NOT_FOUND");
      }

      const existing = await tx.repost.findUnique({
        where: {
          userId_postId: {
            userId,
            postId
          }
        }
      });

      if (existing) {
        throw new Error("ALREADY_REPOSTED");
      }

      const repostPost = await tx.post.create({
        data: {
          authorId: userId,
          repostOfId: postId,
          content: repostComment || "转发动态",
          source: "转发",
          channel: post.channel
        },
        select: { id: true }
      });
      createdRepostPostId = repostPost.id;

      await tx.repost.create({
        data: {
          userId,
          postId,
          content: repostComment || null
        }
      });

      const nextRepostsCount = post.repostsCount + 1;
      await tx.post.update({
        where: { id: postId },
        data: {
          repostsCount: nextRepostsCount,
          hotScore: calculateHotScore(post.likesCount, post.commentsCount, nextRepostsCount)
        }
      });

      await createNotificationIfAllowed(tx, {
        targetUserId: post.authorId,
        actorUserId: userId,
        postId,
        type: NotificationType.REPOST,
        content: "转发了你的动态"
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ALREADY_REPOSTED") {
      fail(res, 409, "你已经转发过这条动态，可到个人主页查看");
      return;
    }

    if (error instanceof Error && error.message === "POST_NOT_FOUND") {
      fail(res, 404, "动态不存在");
      return;
    }

    throw error;
  }

  if (!createdRepostPostId) {
    fail(res, 500, "转发失败，请稍后重试");
    return;
  }

  if (repostValidation.warningWords.length > 0) {
    for (const word of repostValidation.warningWords) {
      void recordSensitiveHit(word, "warning", "post", createdRepostPostId, userId, repostComment);
    }
  }

  const [sourcePost, repostPost] = await Promise.all([toSingleFeedItem(postId, userId), toSingleFeedItem(createdRepostPostId, userId)]);
  if (!sourcePost || !repostPost) {
    fail(res, 404, "动态不存在");
    return;
  }

  ok(
    res,
    {
      sourcePost,
      repostPost
    },
    repostValidation.warningWords.length > 0 ? `转发成功（${repostValidation.message}）` : "转发成功"
  );
});

postsRouter.get("/:postId/comments", async (req, res) => {
  const postId = Number(req.params.postId);
  if (!Number.isFinite(postId)) {
    fail(res, 400, "无效的动态ID");
    return;
  }

  const postExists = await prisma.post.findUnique({ where: { id: postId }, select: { id: true, authorId: true } });
  if (!postExists) {
    fail(res, 404, "动态不存在");
    return;
  }

  const { cursor, limit } = commentsQuerySchema.parse(req.query);
  const cursorId = decodeCursor(cursor);

  const comments = await prisma.comment.findMany({
    where: {
      postId,
      ...(cursorId ? { id: { lt: cursorId } } : {})
    },
    orderBy: [{ id: "desc" }],
    take: limit + 1,
    include: {
      user: {
        select: {
          id: true,
          nickname: true,
          avatarUrl: true
        }
      }
    }
  });

  const hasMore = comments.length > limit;
  const slice = hasMore ? comments.slice(0, limit) : comments;

  ok(res, {
    items: slice.map((comment) => ({
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt,
      user: {
        id: comment.user.id,
        nickname: comment.user.nickname,
        avatarUrl: withMediaPrefix(comment.user.avatarUrl)
      }
    })),
    nextCursor: hasMore ? encodeCursor(slice[slice.length - 1]?.id ?? null) : null
  });
});

postsRouter.post("/:postId/comments", requireAuth, async (req, res) => {
  const postId = Number(req.params.postId);
  if (!Number.isFinite(postId)) {
    fail(res, 400, "无效的动态ID");
    return;
  }

  const postExists = await prisma.post.findUnique({ where: { id: postId }, select: { id: true, authorId: true } });
  if (!postExists) {
    fail(res, 404, "动态不存在");
    return;
  }

  const parsed = commentBodySchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, 400, parsed.error.issues[0]?.message ?? "参数错误", parsed.error.flatten());
    return;
  }

  const validation = validateContent(parsed.data.content);
  if (!validation.valid) {
    fail(res, 400, validation.message, {
      forbiddenWords: validation.forbiddenWords,
      warningWords: validation.warningWords
    });
    return;
  }

  const comment = await prisma.$transaction(async (tx) => {
    const created = await tx.comment.create({
      data: {
        postId,
        userId: req.auth!.userId,
        content: parsed.data.content
      },
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
            avatarUrl: true
          }
        }
      }
    });

    await tx.post.update({
      where: { id: postId },
      data: {
        commentsCount: {
          increment: 1
        },
        hotScore: {
          increment: 6
        }
      }
    });

    await createNotificationIfAllowed(tx, {
      targetUserId: postExists.authorId,
      actorUserId: req.auth!.userId,
      postId,
      type: NotificationType.COMMENT,
      content: `评论了你：${parsed.data.content.slice(0, 90)}`
    });

    return created;
  });

  if (validation.warningWords.length > 0) {
    for (const word of validation.warningWords) {
      void recordSensitiveHit(word, "warning", "comment", comment.id, req.auth!.userId, parsed.data.content);
    }
  }

  ok(
    res,
    {
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt,
      user: {
        id: comment.user.id,
        nickname: comment.user.nickname,
        avatarUrl: withMediaPrefix(comment.user.avatarUrl)
      }
    },
    validation.warningWords.length > 0 ? `评论成功（${validation.message}）` : "评论成功",
    201
  );
});

const relatedPostsQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(12).default(8),
  offset: z.coerce.number().min(0).default(0),
  seed: z.coerce.number().optional()
});

postsRouter.get("/:postId/related", async (req, res) => {
  const postId = Number(req.params.postId);
  if (!Number.isFinite(postId)) {
    fail(res, 400, "无效的动态ID");
    return;
  }

  const { limit, offset, seed } = relatedPostsQuerySchema.parse(req.query);
  const currentUserId = req.auth?.userId;
  const randomSeed = seed ?? Math.floor(Math.random() * 1000000);

  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      topics: {
        include: { topic: true }
      }
    }
  });

  if (!post) {
    fail(res, 404, "动态不存在");
    return;
  }

  const topicIds = post.topics.map((pt) => pt.topicId);
  const authorId = post.authorId;

  let candidatePosts: Array<{
    id: number;
    authorId: number;
    sharedTopicCount: number;
    isSameAuthor: boolean;
    hotScore: number;
    createdAt: Date;
  }> = [];

  if (topicIds.length > 0) {
    const topicPostIds = await prisma.postTopic.findMany({
      where: {
        topicId: { in: topicIds },
        postId: { not: postId }
      },
      select: { postId: true, topicId: true }
    });

    const topicCountMap = new Map<number, number>();
    topicPostIds.forEach((item) => {
      topicCountMap.set(item.postId, (topicCountMap.get(item.postId) ?? 0) + 1);
    });

    const topicPosts = await prisma.post.findMany({
      where: {
        id: { in: Array.from(topicCountMap.keys()) }
      },
      select: {
        id: true,
        authorId: true,
        hotScore: true,
        createdAt: true
      }
    });

    candidatePosts = topicPosts.map((p) => ({
      id: p.id,
      authorId: p.authorId,
      sharedTopicCount: topicCountMap.get(p.id) ?? 0,
      isSameAuthor: p.authorId === authorId,
      hotScore: p.hotScore,
      createdAt: p.createdAt
    }));
  }

  const sameAuthorPosts = await prisma.post.findMany({
    where: {
      authorId,
      id: { not: postId }
    },
    select: {
      id: true,
      authorId: true,
      hotScore: true,
      createdAt: true
    }
  });

  const existingIds = new Set(candidatePosts.map((p) => p.id));
  sameAuthorPosts.forEach((p) => {
    if (!existingIds.has(p.id)) {
      candidatePosts.push({
        id: p.id,
        authorId: p.authorId,
        sharedTopicCount: 0,
        isSameAuthor: true,
        hotScore: p.hotScore,
        createdAt: p.createdAt
      });
      existingIds.add(p.id);
    } else {
      const idx = candidatePosts.findIndex((cp) => cp.id === p.id);
      if (idx !== -1) {
        candidatePosts[idx].isSameAuthor = true;
      }
    }
  });

  const hasRelatedCandidates = candidatePosts.length > 0;

  if (candidatePosts.length < limit * 2) {
    const excludeIds = new Set([postId, ...candidatePosts.map((p) => p.id)]);
    const hotPosts = await prisma.post.findMany({
      where: {
        id: { notIn: Array.from(excludeIds) }
      },
      orderBy: [{ hotScore: "desc" }, { id: "desc" }],
      take: limit * 3,
      select: {
        id: true,
        authorId: true,
        hotScore: true,
        createdAt: true
      }
    });

    hotPosts.forEach((p) => {
      if (!existingIds.has(p.id)) {
        candidatePosts.push({
          id: p.id,
          authorId: p.authorId,
          sharedTopicCount: 0,
          isSameAuthor: false,
          hotScore: p.hotScore,
          createdAt: p.createdAt
        });
        existingIds.add(p.id);
      }
    });
  }

  function seededRandom(seedValue: number, index: number) {
    const x = Math.sin(seedValue + index * 9999) * 10000;
    return x - Math.floor(x);
  }

  candidatePosts.sort((a, b) => {
    if (a.sharedTopicCount !== b.sharedTopicCount) {
      return b.sharedTopicCount - a.sharedTopicCount;
    }
    if (a.isSameAuthor !== b.isSameAuthor) {
      return a.isSameAuthor ? -1 : 1;
    }
    const scoreA = a.hotScore * (0.9 + seededRandom(randomSeed, a.id) * 0.2);
    const scoreB = b.hotScore * (0.9 + seededRandom(randomSeed, b.id) * 0.2);
    return scoreB - scoreA;
  });

  const authorCountMap = new Map<number, number>();
  const filteredPosts: typeof candidatePosts = [];
  const maxSameAuthor = Math.max(1, Math.floor(limit / 3));

  for (const post of candidatePosts) {
    const authorPostCount = authorCountMap.get(post.authorId) ?? 0;
    if (authorPostCount >= maxSameAuthor && filteredPosts.length < limit) {
      continue;
    }
    filteredPosts.push(post);
    authorCountMap.set(post.authorId, authorPostCount + 1);
    if (filteredPosts.length >= limit + offset) {
      break;
    }
  }

  const paginatedPosts = filteredPosts.slice(offset, offset + limit);
  const hasMore = filteredPosts.length > offset + limit;

  let posts: any[] = [];
  let isFallback = false;

  if (paginatedPosts.length > 0 && hasRelatedCandidates) {
    posts = await prisma.post.findMany({
      where: {
        id: { in: paginatedPosts.map((p) => p.id) }
      },
      include: FEED_POST_INCLUDE
    });

    const orderMap = new Map(paginatedPosts.map((p, idx) => [p.id, idx]));
    posts.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
  } else {
    isFallback = true;
    const excludeIds = new Set([postId]);
    posts = await prisma.post.findMany({
      where: {
        id: { notIn: Array.from(excludeIds) }
      },
      orderBy: [{ hotScore: "desc" }, { id: "desc" }],
      skip: offset,
      take: limit + 1,
      include: FEED_POST_INCLUDE
    });
  }

  const hasMorePosts = hasMore || posts.length > limit;
  const finalPosts = posts.length > limit ? posts.slice(0, limit) : posts;

  const items = await toFeedItems(finalPosts, currentUserId);

  ok(res, {
    items,
    isFallback,
    hasMore: hasMorePosts,
    nextOffset: hasMorePosts ? offset + limit : null,
    seed: randomSeed
  });
});
