import { apiClient } from "@/api/client";
import type { ApiResponse, RecommendedUser, TrendingTopic, User } from "@/types/models";

export interface OnboardingStatus {
  completed: boolean;
  currentStep: number;
  interests: number[];
}

export interface OnboardingCreator extends RecommendedUser {
  followersCount: number;
}

export interface SaveInterestsInput {
  topicIds: number[];
}

export interface FollowCreatorsInput {
  userIds?: number[];
}

export interface UpdateProfileInput {
  nickname?: string;
  bio?: string;
}

export interface SaveInterestsResponse {
  saved: boolean;
  step: number;
}

export interface FollowCreatorsResponse {
  followed: number;
  step: number;
}

export interface UpdateProfileResponse {
  updated: boolean;
  step: number;
  user: Pick<User, "id" | "nickname" | "bio" | "avatarUrl">;
}

export interface CompleteOnboardingResponse {
  completed: boolean;
  skipped: boolean;
  user: User;
}

export interface UpdateStepResponse {
  step: number;
}

export async function fetchOnboardingStatus(): Promise<OnboardingStatus> {
  const { data } = await apiClient.get<ApiResponse<OnboardingStatus>>("/onboarding/status");
  return data.data;
}

export async function fetchOnboardingTopics(): Promise<TrendingTopic[]> {
  const { data } = await apiClient.get<ApiResponse<TrendingTopic[]>>("/onboarding/topics");
  return data.data;
}

export async function saveInterests(input: SaveInterestsInput): Promise<SaveInterestsResponse> {
  const { data } = await apiClient.post<ApiResponse<SaveInterestsResponse>>("/onboarding/interests", input);
  return data.data;
}

export async function fetchRecommendedCreators(): Promise<OnboardingCreator[]> {
  const { data } = await apiClient.get<ApiResponse<OnboardingCreator[]>>("/onboarding/recommended-creators");
  return data.data;
}

export async function followCreators(input: FollowCreatorsInput): Promise<FollowCreatorsResponse> {
  const { data } = await apiClient.post<ApiResponse<FollowCreatorsResponse>>("/onboarding/follow-creators", input);
  return data.data;
}

export async function updateOnboardingProfile(input: UpdateProfileInput): Promise<UpdateProfileResponse> {
  const { data } = await apiClient.post<ApiResponse<UpdateProfileResponse>>("/onboarding/profile", input);
  return data.data;
}

export async function updateOnboardingStep(step: number): Promise<UpdateStepResponse> {
  const { data } = await apiClient.post<ApiResponse<UpdateStepResponse>>("/onboarding/step", { step });
  return data.data;
}

export async function completeOnboarding(skipped = false): Promise<CompleteOnboardingResponse> {
  const { data } = await apiClient.post<ApiResponse<CompleteOnboardingResponse>>("/onboarding/complete", { skipped });
  return data.data;
}
