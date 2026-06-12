import { Router } from "express";

import { prisma } from "../../config/prisma";
import { requireAuth } from "../../middleware/auth";
import { validateBody } from "../../middleware/validate";
import { fail, ok } from "../../utils/response";
import { withMediaPrefix } from "../../utils/post-mapper";
import {
  completeOnboardingSchema,
  followCreatorsSchema,
  saveInterestsSchema,
  updateProfileSchema,
  updateStepSchema
} from "./onboarding.schema";

export const onboardingRouter = Router();

onboardingRouter.use(requireAuth);

onboardingRouter.get("/onboarding/status", async (req, res) => {
  const userId = req.auth!.userId;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      onboardingCompleted: true,
      onboardingStep: true,
      interests: {
        select: { topicId: true }
      }
    }
  });

  if (!user) {
    fail(res, 404, "用户不存在");
    return;
  }

  ok(res, {
    completed: user.onboardingCompleted,
    currentStep: user.onboardingStep,
    interests: user.interests.map((i: { topicId: number }) => i.topicId)
  });
});

onboardingRouter.get("/onboarding/topics", async (_req, res) => {
  const topics = await prisma.topic.findMany({
    orderBy: [{ rank: "asc" }, { heat: "desc" }],
    take: 20
  });

  ok(res, topics);
});

onboardingRouter.post("/onboarding/interests", validateBody(saveInterestsSchema), async (req, res) => {
  const userId = req.auth!.userId;
  const { topicIds } = req.body;

  const existingTopics = await prisma.topic.findMany({
    where: { id: { in: topicIds } },
    select: { id: true }
  });

  if (existingTopics.length !== topicIds.length) {
    fail(res, 400, "部分话题不存在");
    return;
  }

  await prisma.$transaction([
    prisma.userInterest.deleteMany({ where: { userId } }),
    prisma.userInterest.createMany({
      data: topicIds.map((topicId: number) => ({ userId, topicId }))
    }),
    prisma.user.update({
      where: { id: userId },
      data: { onboardingStep: 1 }
    })
  ]);

  ok(res, { saved: true, step: 1 });
});

onboardingRouter.get("/onboarding/recommended-creators", async (req, res) => {
  const userId = req.auth!.userId;

  const userInterests = await prisma.userInterest.findMany({
    where: { userId },
    select: { topicId: true }
  });

  const interestTopicIds = userInterests.map((i: { topicId: number }) => i.topicId);

  let recommendedUsers: Array<{
    id: number;
    nickname: string;
    avatarUrl: string | null;
    bio: string | null;
    followersCount: number;
  }> = [];

  if (interestTopicIds.length > 0) {
    const topicAuthorIds = await prisma.postTopic.findMany({
      where: { topicId: { in: interestTopicIds } },
      select: { post: { select: { authorId: true } } },
      distinct: ["postId"],
      take: 100
    });

    const authorCountMap = new Map<number, number>();
    topicAuthorIds.forEach((item: { post: { authorId: number } }) => {
      const authorId = item.post.authorId;
      if (authorId !== userId) {
        authorCountMap.set(authorId, (authorCountMap.get(authorId) || 0) + 1);
      }
    });

    const sortedAuthorIds = Array.from(authorCountMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id)
      .slice(0, 10);

    if (sortedAuthorIds.length > 0) {
      recommendedUsers = await prisma.user.findMany({
        where: { id: { in: sortedAuthorIds }, NOT: { id: userId } },
        select: {
          id: true,
          nickname: true,
          avatarUrl: true,
          bio: true,
          followersCount: true
        },
        orderBy: { followersCount: "desc" }
      });
    }
  }

  if (recommendedUsers.length < 6) {
    const fallbackUsers = await prisma.user.findMany({
      where: { NOT: { id: userId } },
      select: {
        id: true,
        nickname: true,
        avatarUrl: true,
        bio: true,
        followersCount: true
      },
      orderBy: { followersCount: "desc" },
      take: 12
    });

    const existingIds = new Set(recommendedUsers.map((u) => u.id));
    fallbackUsers.forEach((user) => {
      if (!existingIds.has(user.id) && recommendedUsers.length < 6) {
        recommendedUsers.push(user);
        existingIds.add(user.id);
      }
    });
  }

  const followSet = new Set<number>();
  const follows = await prisma.follow.findMany({
    where: {
      followerId: userId,
      followingId: { in: recommendedUsers.map((u) => u.id) }
    },
    select: { followingId: true }
  });
  follows.forEach((f: { followingId: number }) => followSet.add(f.followingId));

  ok(
    res,
    recommendedUsers.map((user) => ({
      id: user.id,
      nickname: user.nickname,
      avatarUrl: withMediaPrefix(user.avatarUrl),
      bio: user.bio,
      followersCount: user.followersCount,
      isFollowed: followSet.has(user.id)
    }))
  );
});

onboardingRouter.post("/onboarding/follow-creators", validateBody(followCreatorsSchema), async (req, res) => {
  const userId = req.auth!.userId;
  const { userIds = [] } = req.body;

  if (userIds.length > 0) {
    const validUsers = await prisma.user.findMany({
      where: { id: { in: userIds }, NOT: { id: userId } },
      select: { id: true }
    });

    if (validUsers.length > 0) {
      await prisma.$transaction(async (tx: any) => {
        for (const user of validUsers) {
          const existing = await tx.follow.findUnique({
            where: { followerId_followingId: { followerId: userId, followingId: user.id } }
          });

          if (!existing) {
            await tx.follow.create({
              data: { followerId: userId, followingId: user.id }
            });
            await tx.user.update({
              where: { id: userId },
              data: { followingCount: { increment: 1 } }
            });
            await tx.user.update({
              where: { id: user.id },
              data: { followersCount: { increment: 1 } }
            });
          }
        }
      });
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: { onboardingStep: 2 }
  });

  ok(res, { followed: userIds.length, step: 2 });
});

onboardingRouter.post("/onboarding/profile", validateBody(updateProfileSchema), async (req, res) => {
  const userId = req.auth!.userId;
  const { nickname, bio } = req.body;

  if (!nickname && !bio) {
    fail(res, 400, "至少提供昵称或简介");
    return;
  }

  const updateData: { nickname?: string; bio?: string } = {};
  if (nickname) updateData.nickname = nickname;
  if (bio !== undefined) updateData.bio = bio;

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      ...updateData,
      onboardingStep: 3
    }
  });

  ok(res, {
    updated: true,
    step: 3,
    user: {
      id: updatedUser.id,
      nickname: updatedUser.nickname,
      bio: updatedUser.bio,
      avatarUrl: withMediaPrefix(updatedUser.avatarUrl)
    }
  });
});

onboardingRouter.post("/onboarding/step", validateBody(updateStepSchema), async (req, res) => {
  const userId = req.auth!.userId;
  const { step } = req.body;

  await prisma.user.update({
    where: { id: userId },
    data: { onboardingStep: step }
  });

  ok(res, { step });
});

onboardingRouter.post("/onboarding/complete", validateBody(completeOnboardingSchema), async (req, res) => {
  const userId = req.auth!.userId;
  const { skipped } = req.body;

  await prisma.user.update({
    where: { id: userId },
    data: {
      onboardingCompleted: true,
      onboardingStep: 3
    }
  });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      nickname: true,
      avatarUrl: true,
      level: true,
      bio: true,
      followersCount: true,
      followingCount: true,
      createdAt: true
    }
  });

  ok(res, {
    completed: true,
    skipped,
    user: user
      ? {
          ...user,
          avatarUrl: withMediaPrefix(user.avatarUrl)
        }
      : null
  });
});
