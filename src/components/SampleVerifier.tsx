import { useCallback, useRef, useState } from "react";
import type { ReviewStatus, SpeechSample } from "../types/dataset";
import type { SampleReviewState } from "../types/review";

type SampleVerifierProps = {
  canGoNext?: boolean;
  canGoPrevious?: boolean;
  onNext?: () => void;
  onPrevious?: () => void;
  onTranscriptChange: (sampleId: string, transcript: string) => void;
  onStatusChange: (sampleId: string, status: ReviewStatus) => void;
  review: SampleReviewState;
  sample: SpeechSample;
  sampleIndex: number;
  sampleTotal: number;
};

export function SampleVerifier({
  canGoNext,
  canGoPrevious,
  onNext,
  onPrevious,
  onStatusChange,
  onTranscriptChange,
  review,
  sample,
  sampleIndex,
  sampleTotal,
}: SampleVerifierProps) {
  const currentAudioUrl = useRef<string | null>(null);
  const attachAudio = useCallback((audioElement: HTMLAudioElement | null) => {
    if (currentAudioUrl.current) {
      URL.revokeObjectURL(currentAudioUrl.current);
      currentAudioUrl.current = null;
    }

    if (audioElement) {
      const nextAudioUrl = URL.createObjectURL(sample.audioFile);
      audioElement.src = nextAudioUrl;
      currentAudioUrl.current = nextAudioUrl;
    }
  }, [sample.audioFile]);

  return (
    <section className="verifier-panel">
      <div className="verifier-header">
        <div>
          <p className="eyebrow">Current Sample</p>
          <h2>{sample.stem}</h2>
          <p>{sample.mode} / {sample.split} / {sample.user}</p>
        </div>
        <p>{sampleIndex + 1} / {sampleTotal}</p>
      </div>

      <div className="audio-panel">
        <audio controls ref={attachAudio}>
          <track kind="captions" />
        </audio>
      </div>

      <fieldset className="verification-toggle">
        <legend id={`quality-${sample.id}`}>Audio Quality</legend>
        <div className="verification-actions" role="group" aria-label="Audio quality decision">
          <button
            aria-pressed={review.status === "valid"}
            className={`quality-button valid${review.status === "valid" ? " selected" : ""}`}
            onClick={() => onStatusChange(sample.id, "valid")}
            type="button"
          >
            Valid
          </button>
          <button
            aria-pressed={review.status === "invalid"}
            className={`quality-button invalid${review.status === "invalid" ? " selected" : ""}`}
            onClick={() => onStatusChange(sample.id, "invalid")}
            type="button"
          >
            Invalid
          </button>
        </div>
        <details className="quality-guidance">
          <summary>What counts as invalid?</summary>
          <ul>
            <li>All zeros</li>
            <li>High background noise</li>
            <li>Weird distortion and artifacts</li>
          </ul>
        </details>
      </fieldset>

      <TranscriptEditor
        key={sample.id}
        onTranscriptChange={onTranscriptChange}
        review={review}
        sample={sample}
      />

      {(onPrevious || onNext) && (
        <div className="sample-navigation">
          {onPrevious && (
            <button disabled={!canGoPrevious} onClick={onPrevious} type="button">
              Previous
            </button>
          )}
          {onNext && (
            <button disabled={!canGoNext} onClick={onNext} type="button">
              Next
            </button>
          )}
        </div>
      )}
    </section>
  );
}

type TranscriptEditorProps = {
  onTranscriptChange: (sampleId: string, transcript: string) => void;
  review: SampleReviewState;
  sample: SpeechSample;
};

function TranscriptEditor({ onTranscriptChange, review, sample }: TranscriptEditorProps) {
  const [isTranscriptVisible, setIsTranscriptVisible] = useState(false);

  return (
    <fieldset className="transcript-card" aria-labelledby={`transcript-${sample.id}`}>
      <legend>Transcript</legend>
      <div className="transcript-prompt">
        <div>
          <h3 id={`transcript-${sample.id}`}>What did the speaker say?</h3>
          <p>Try listening before reading the existing transcript.</p>
        </div>
        <button
          aria-expanded={isTranscriptVisible}
          aria-controls={`transcript-editor-${sample.id}`}
          onClick={() => setIsTranscriptVisible((current) => !current)}
          type="button"
        >
          {isTranscriptVisible ? "Hide transcript" : "Reveal transcript"}
        </button>
      </div>

      {isTranscriptVisible && (
        <label className="transcript-editor" id={`transcript-editor-${sample.id}`}>
          <span>Transcript</span>
          <textarea
            onChange={(event) => onTranscriptChange(sample.id, event.target.value)}
            value={review.editedTranscript}
          />
        </label>
      )}
    </fieldset>
  );
}
