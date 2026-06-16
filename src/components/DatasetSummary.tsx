import { ReviewChecklist } from "./ReviewChecklist";
import { SummaryCard } from "./SummaryCard";
import { WarningsPanel } from "./WarningsPanel";
import type { ParsedDataset } from "../types/dataset";
import type { ReviewRow } from "../types/review";

type DatasetSummaryProps = {
  dataset: ParsedDataset;
  isFinishDisabled: boolean;
  onFinish: () => void;
  onSelectSample: (sampleId: string) => void;
  reviewRows: ReviewRow[];
  reviewedCount: number;
};

export function DatasetSummary({
  dataset,
  isFinishDisabled,
  onFinish,
  onSelectSample,
  reviewRows,
  reviewedCount,
}: DatasetSummaryProps) {
  const totalCount = dataset.speechSamples.length;
  const completionPercent = totalCount === 0 ? 0 : Math.round((reviewedCount / totalCount) * 100);

  return (
    <section className="dataset-summary">
      <div>
        <p className="eyebrow">Imported Dataset</p>
        <h2>{dataset.name}</h2>
      </div>

      <div className="summary-grid">
        <SummaryCard label="Speech samples" value={dataset.speechSamples.length} />
        <SummaryCard label="Interference samples" value={dataset.interferenceSamples.length} />
        <SummaryCard label="Warnings" value={dataset.warnings.length} />
      </div>

      <section className="finish-panel">
        <div>
          <h2>Ready to finish?</h2>
          <p>{reviewedCount} / {totalCount} speech samples reviewed</p>
          <div
            aria-label={`${completionPercent}% complete`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={completionPercent}
            className="completion-bar"
            role="progressbar"
          >
            <span style={{ width: `${completionPercent}%` }} />
          </div>
        </div>
        <button disabled={isFinishDisabled} onClick={onFinish} type="button">
          Finish
        </button>
      </section>

      <ReviewChecklist onSelectSample={onSelectSample} rows={reviewRows} />
      <WarningsPanel warnings={dataset.warnings} />
    </section>
  );
}
