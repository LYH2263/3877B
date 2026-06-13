import { apiClient } from "@/api/client";
import type { ApiResponse, CheckInConfig, CheckInResult, CheckInStatus } from "@/types/models";

export async function fetchCheckInStatus(timezoneOffset?: number): Promise<CheckInStatus> {
  const params = timezoneOffset !== undefined ? { params: { timezoneOffset } } : undefined;
  const { data } = await apiClient.get<ApiResponse<CheckInStatus>>("/checkin/status", params);
  return data.data;
}

export async function performCheckIn(timezoneOffset?: number): Promise<CheckInResult> {
  const body = timezoneOffset !== undefined ? { timezoneOffset } : {};
  const { data } = await apiClient.post<ApiResponse<CheckInResult>>("/checkin/checkin", body);
  return data.data;
}

export async function fetchCheckInConfig(): Promise<CheckInConfig> {
  const { data } = await apiClient.get<ApiResponse<CheckInConfig>>("/checkin/config");
  return data.data;
}
