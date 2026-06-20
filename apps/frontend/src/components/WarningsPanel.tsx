type WarningsPanelProps = {
  warnings: string[];
};

export function WarningsPanel({ warnings }: WarningsPanelProps) {
  if (warnings.length === 0) {
    return null;
  }

  return (
    <div className="warning-panel">
      <h2>Warnings</h2>
      <ul>
        {warnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
    </div>
  );
}
