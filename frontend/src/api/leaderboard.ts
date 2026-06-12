import { apiClient } from "@/api/client";
import type {
  ApiResponse,
  CreatorSortBy,
  CursorPage,
  LeaderboardPeriod,
  RankedCreatorItem,
  RankedPostItem,
  RankedTopicItem
} from "@/types/models";

export async function fetchPostLeaderboard(
  period: LeaderboardPeriod,
  cursor: string | null,
  limit = 20
): Promise<CursorPage<RankedPostItem>> {
  const { data } = await apiClient.get<ApiResponse<CursorPage<RankedPostItem>>>(
    "/leaderboard/posts",
    {
      params: {
        period,
        cursor: cursor ?? undefined,
        limit
      }
    }
  );
  return data.data;
}

export async function fetchTopicLeaderboard(
  period: LeaderboardPeriod,
  cursor: string | null,
  limit = 20
): Promise<CursorPage<RankedTopicItem>> {
  const { data } = await apiClient.get<ApiResponse<CursorPage<RankedTopicItem>>>(
    "/leaderboard/topics",
    {
      params: {
        period,
        cursor: cursor ?? undefined,
        limit
      }
    }
  );
  return data.data;
}

export async function fetchCreatorLeaderboard(
  period: LeaderboardPeriod,
  sortBy: CreatorSortBy,
  cursor: string | null,
  limit = 20
): Promise<CursorPage<RankedCreatorItem>> {
  const { data } = await apiClient.get<ApiResponse<CursorPage<RankedCreatorItem>>>(
    "/leaderboard/creators",
    {
      params: {
        period,
        sortBy,
        cursor: cursor ?? undefined,
        limit
      }
    }
  );
  return data.data;
}
