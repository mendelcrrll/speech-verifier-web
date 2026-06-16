import type { ReviewStatus } from "../types/dataset";

type StatusBadgeProps = {
  status: ReviewStatus;
};

const statusLabels: Record<ReviewStatus, string> = {
  invalid: "Invalid",
  unreviewed: "Not verified",
  valid: "Verified",
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return <span className={`status-badge ${status}`}>{statusLabels[status]}</span>;
}
