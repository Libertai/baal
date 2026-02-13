/**
 * Activity feed API functions.
 */

import { apiFetch, API_BASE_URL } from "./client";
import type { ActivityListResponse } from "./types";

export async function getMyActivity(
  limit = 50,
  offset = 0,
): Promise<ActivityListResponse> {
  return apiFetch<ActivityListResponse>(
    `/activity/me?limit=${limit}&offset=${offset}`,
  );
}

export async function getPublicActivity(
  limit = 50,
  offset = 0,
): Promise<ActivityListResponse> {
  return apiFetch<ActivityListResponse>(
    `/activity/public?limit=${limit}&offset=${offset}`,
    { noAuth: true },
  );
}

/** URL for the public SSE activity stream. */
export const ACTIVITY_STREAM_URL = `${API_BASE_URL}/activity/stream`;
