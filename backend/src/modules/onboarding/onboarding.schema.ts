import { z } from "zod";

export const saveInterestsSchema = z.object({
  topicIds: z.array(z.number().int().positive()).min(1, "至少选择 1 个感兴趣的话题")
});

export const followCreatorsSchema = z.object({
  userIds: z.array(z.number().int().positive()).optional()
});

export const updateProfileSchema = z.object({
  nickname: z.string().min(2, "昵称至少 2 个字符").max(20, "昵称最多 20 个字符").optional(),
  bio: z.string().max(200, "简介最多 200 个字符").optional()
});

export const updateStepSchema = z.object({
  step: z.number().int().min(0).max(3)
});

export const completeOnboardingSchema = z.object({
  skipped: z.boolean().optional().default(false)
});

export type SaveInterestsInput = z.infer<typeof saveInterestsSchema>;
export type FollowCreatorsInput = z.infer<typeof followCreatorsSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateStepInput = z.infer<typeof updateStepSchema>;
export type CompleteOnboardingInput = z.infer<typeof completeOnboardingSchema>;
