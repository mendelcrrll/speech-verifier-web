import type { ReviewStatus } from "./dataset";

export type ReviewRow = {
  id: string;
  label: string;
  mode: string;
  split: string;
  status: ReviewStatus;
  user: string;
};

export type SampleReviewState = {
  editedTranscript: string;
  status: ReviewStatus;
};
