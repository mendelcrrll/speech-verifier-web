import type { ParsedDataset, ReviewStatus } from "../types/dataset";
import type { SampleReviewState } from "../types/review";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

export type BackendSessionState = {
  sessionId: string;
  user: string;
  s3Prefix: string;
  verifiedS3Prefix: string;
  dataset: ParsedDataset;
  reviews: Record<string, SampleReviewState>;
};

export type FinishBackendSessionResult = {
  status: string;
  uploadedCount: number;
  verifiedS3Prefix: string;
};

export async function createBackendSession(key: string): Promise<BackendSessionState> {
  return request<BackendSessionState>("/api/verifier/sessions", {
    body: JSON.stringify({ key }),
    method: "POST",
  });
}

export async function saveBackendReview(
  sessionId: string,
  sampleId: string,
  review: Partial<{ editedTranscript: string; status: ReviewStatus }>,
): Promise<BackendSessionState> {
  return request<BackendSessionState>(`/api/verifier/sessions/${encodeURIComponent(sessionId)}/reviews`, {
    body: JSON.stringify({
      sample_id: sampleId,
      edited_transcript: review.editedTranscript,
      status: review.status,
    }),
    method: "POST",
  });
}

export async function finishBackendSession(sessionId: string): Promise<FinishBackendSessionResult> {
  return request<FinishBackendSessionResult>(`/api/verifier/sessions/${encodeURIComponent(sessionId)}/finish`, {
    method: "POST",
  });
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new Error(await errorMessage(response));
  }

  return response.json() as Promise<T>;
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const payload = await response.json() as { detail?: unknown };
    if (typeof payload.detail === "string") {
      return payload.detail;
    }
  } catch {
    // Fall back to status text below.
  }
  return response.statusText || "Backend request failed.";
}
