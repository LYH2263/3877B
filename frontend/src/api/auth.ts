import { apiClient } from "@/api/client";
import type { ApiResponse, AuthPayload, OnboardingInfo } from "@/types/models";

export interface RegisterInput {
  email: string;
  password: string;
  nickname: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthWithOnboardingPayload extends AuthPayload {
  onboarding?: OnboardingInfo;
}

export async function register(payload: RegisterInput): Promise<AuthWithOnboardingPayload> {
  const { data } = await apiClient.post<ApiResponse<AuthWithOnboardingPayload>>("/auth/register", payload);
  return data.data;
}

export async function login(payload: LoginInput): Promise<AuthWithOnboardingPayload> {
  const { data } = await apiClient.post<ApiResponse<AuthWithOnboardingPayload>>("/auth/login", payload);
  return data.data;
}

export async function getMe(): Promise<AuthWithOnboardingPayload> {
  const { data } = await apiClient.get<ApiResponse<AuthWithOnboardingPayload>>("/auth/me");
  return data.data;
}

export async function logout(): Promise<void> {
  await apiClient.post("/auth/logout");
}
