import { StatusBadge } from "./StatusBadge";
import type { ReviewRow } from "../types/review";

type ReviewChecklistProps = {
  onSelectSample: (sampleId: string) => void;
  rows: ReviewRow[];
  selectedSampleId?: string;
};

export function ReviewChecklist({ onSelectSample, rows, selectedSampleId }: ReviewChecklistProps) {
  const visibleRows = rows.slice(0, 50);

  return (
    <section className="checklist-panel">
      <div className="checklist-header">
        <h2>Validation Checklist</h2>
        <p>{rows.length} parsed items</p>
      </div>

      {rows.length === 0 ? (
        <p>No reviewable files found.</p>
      ) : (
        <>
          <div className="checklist">
            <div className="checklist-row checklist-heading">
              <span>File</span>
              <span>Type</span>
              <span>Verified</span>
            </div>

            {visibleRows.map((row) => (
              <button
                className={`checklist-row sample-nav-row${row.id === selectedSampleId ? " selected" : ""}`}
                key={row.id}
                onClick={() => onSelectSample(row.id)}
                type="button"
              >
                <span>
                  <strong>{row.label}</strong>
                  <small>{row.mode} / {row.split} / {row.user}</small>
                </span>
                <span>speech</span>
                <StatusBadge status={row.status} />
              </button>
            ))}
          </div>

          {rows.length > visibleRows.length && (
            <p className="table-note">Showing first {visibleRows.length} of {rows.length} parsed items.</p>
          )}
        </>
      )}
    </section>
  );
}
