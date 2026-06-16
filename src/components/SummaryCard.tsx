type SummaryCardProps = {
  label: string;
  value: number;
};

export function SummaryCard({ label, value }: SummaryCardProps) {
  return (
    <article className="summary-card">
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  );
}
