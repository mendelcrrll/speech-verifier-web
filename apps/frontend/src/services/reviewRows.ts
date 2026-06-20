import type { ParsedDataset, SpeechSample } from "../types/dataset";
import type { ReviewRow, SampleReviewState } from "../types/review";

export function buildReviewRows(
  dataset: ParsedDataset,
  reviews: Record<string, SampleReviewState>,
): ReviewRow[] {
  return dataset.speechSamples.map((sample) => speechSampleToReviewRow(sample, reviews[sample.id]));
}

function speechSampleToReviewRow(sample: SpeechSample, review?: SampleReviewState): ReviewRow {
  return {
    id: sample.id,
    label: sample.stem,
    mode: sample.mode,
    split: sample.split,
    status: review?.status ?? sample.status,
    user: sample.user,
  };
}
