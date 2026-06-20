import { SampleVerifier } from "../components/SampleVerifier";
import type { ReviewStatus, SpeechSample } from "../types/dataset";
import type { SampleReviewState } from "../types/review";

type SamplePageProps = {
  canGoNext: boolean;
  canGoPrevious: boolean;
  onBack: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onStatusChange: (sampleId: string, status: ReviewStatus) => void;
  onTranscriptChange: (sampleId: string, transcript: string) => void;
  review: SampleReviewState;
  sample: SpeechSample;
  sampleIndex: number;
  sampleTotal: number;
};

export function SamplePage({
  canGoNext,
  canGoPrevious,
  onBack,
  onNext,
  onPrevious,
  onStatusChange,
  onTranscriptChange,
  review,
  sample,
  sampleIndex,
  sampleTotal,
}: SamplePageProps) {
  return (
    <section className="sample-page">
      <nav className="sample-top-card" aria-label="Sample navigation">
        <button className="back-button" onClick={onBack} type="button">
          Back
        </button>

        <div className="sample-top-info">
          <strong>{sample.stem}</strong>
          <span>{sampleIndex + 1} / {sampleTotal}</span>
        </div>

        <div className="sample-top-actions">
          <button disabled={!canGoPrevious} onClick={onPrevious} type="button">
            Previous
          </button>
          <button disabled={!canGoNext} onClick={onNext} type="button">
            Next
          </button>
        </div>
      </nav>

      <SampleVerifier
        onStatusChange={onStatusChange}
        onTranscriptChange={onTranscriptChange}
        review={review}
        sample={sample}
        sampleIndex={sampleIndex}
        sampleTotal={sampleTotal}
      />
    </section>
  );
}
