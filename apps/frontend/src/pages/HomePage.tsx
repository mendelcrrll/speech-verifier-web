import { useMemo, useState } from "react";
import { BackendKeyLoader } from "../components/BackendKeyLoader";
import { DatasetImporter } from "../components/DatasetImporter";
import { DatasetSummary } from "../components/DatasetSummary";
import { ImportIcon } from "../components/ImportIcon";
import { SamplePage } from "./SamplePage";
import { createBackendSession, finishBackendSession, saveBackendReview } from "../services/backendApi";
import { parseDatasetFolder } from "../services/datasetParser";
import { exportVerifiedZip } from "../services/datasetExporter";
import { buildReviewRows } from "../services/reviewRows";
import { filesFromDatasetZip } from "../services/zipDatasetImporter";
import type { ParsedDataset, ReviewStatus } from "../types/dataset";
import type { SampleReviewState } from "../types/review";

export function HomePage() {
  const [dataset, setDataset] = useState<ParsedDataset | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isBackendLoading, setIsBackendLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Record<string, SampleReviewState>>({});
  const [backendSessionId, setBackendSessionId] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<"home" | "sample">("home");
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null);
  const reviewRows = useMemo(() => (dataset ? buildReviewRows(dataset, reviews) : []), [dataset, reviews]);
  const reviewedCount = reviewRows.filter((row) => row.status !== "unreviewed").length;
  const isFinishDisabled = dataset ? isExporting || reviewedCount < dataset.speechSamples.length : true;
  const selectedSampleIndex = dataset?.speechSamples.findIndex((sample) => sample.id === selectedSampleId) ?? -1;
  const selectedSample = selectedSampleIndex === -1 ? undefined : dataset?.speechSamples[selectedSampleIndex];
  const selectedReview = selectedSample ? reviews[selectedSample.id] : undefined;

  async function handleImport(files: File[]) {
    setIsParsing(true);
    setError(null);

    try {
      const parsedDataset = await parseDatasetFolder(files);
      setDataset(parsedDataset);
      setReviews(initialReviewState(parsedDataset));
      setBackendSessionId(null);
      setSuccessMessage(null);
      setActivePage("home");
      setSelectedSampleId(null);
    } catch (parseError) {
      setDataset(null);
      setReviews({});
      setBackendSessionId(null);
      setActivePage("home");
      setSelectedSampleId(null);
      setError(parseError instanceof Error ? parseError.message : "Unable to parse this dataset.");
    } finally {
      setIsParsing(false);
    }
  }

  async function handleBackendLoad(key: string) {
    setIsBackendLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const state = await createBackendSession(key);
      setDataset(state.dataset);
      setReviews({
        ...initialReviewState(state.dataset),
        ...state.reviews,
      });
      setBackendSessionId(state.sessionId);
      setActivePage("home");
      setSelectedSampleId(null);
      setSuccessMessage(`Loaded server dataset for ${state.user}.`);
    } catch (loadError) {
      setDataset(null);
      setReviews({});
      setBackendSessionId(null);
      setActivePage("home");
      setSelectedSampleId(null);
      setError(loadError instanceof Error ? loadError.message : "Unable to load this verification key.");
    } finally {
      setIsBackendLoading(false);
    }
  }

  async function handleZipImport(file: File) {
    setIsParsing(true);
    setError(null);

    try {
      const files = await filesFromDatasetZip(file);
      await handleImport(files);
    } catch (zipError) {
      setDataset(null);
      setError(zipError instanceof Error ? zipError.message : "Unable to read this zip file.");
      setIsParsing(false);
    }
  }

  function handleStatusChange(sampleId: string, status: ReviewStatus) {
    setReviews((currentReviews) => ({
      ...currentReviews,
      [sampleId]: {
        ...currentReviews[sampleId],
        status,
      },
    }));
    void persistBackendReview(sampleId, { status });
  }

  function handleTranscriptChange(sampleId: string, editedTranscript: string) {
    setReviews((currentReviews) => ({
      ...currentReviews,
      [sampleId]: {
        ...currentReviews[sampleId],
        editedTranscript,
      },
    }));
    void persistBackendReview(sampleId, { editedTranscript });
  }

  async function persistBackendReview(
    sampleId: string,
    review: Partial<{ editedTranscript: string; status: ReviewStatus }>,
  ) {
    if (!backendSessionId) {
      return;
    }

    try {
      await saveBackendReview(backendSessionId, sampleId, review);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save review to backend.");
    }
  }

  function handleSelectSample(sampleId: string) {
    setSelectedSampleId(sampleId);
    setActivePage("sample");
  }

  function handlePreviousSample() {
    if (!dataset || selectedSampleIndex <= 0) {
      return;
    }

    setSelectedSampleId(dataset.speechSamples[selectedSampleIndex - 1].id);
  }

  function handleNextSample() {
    if (!dataset || selectedSampleIndex === -1 || selectedSampleIndex >= dataset.speechSamples.length - 1) {
      return;
    }

    setSelectedSampleId(dataset.speechSamples[selectedSampleIndex + 1].id);
  }

  async function handleFinish() {
    if (!dataset) {
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setIsExporting(true);

    try {
      if (backendSessionId) {
        const result = await finishBackendSession(backendSessionId);
        setSuccessMessage(`Uploaded ${result.uploadedCount} verified files to ${result.verifiedS3Prefix}.`);
      } else {
        await exportVerifiedZip(dataset, reviews);
      }
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Unable to export verified zip.");
    } finally {
      setIsExporting(false);
    }
  }

  if (activePage === "sample" && selectedSample && selectedReview && dataset) {
    return (
      <SamplePage
        canGoNext={selectedSampleIndex < dataset.speechSamples.length - 1}
        canGoPrevious={selectedSampleIndex > 0}
        onBack={() => setActivePage("home")}
        onNext={handleNextSample}
        onPrevious={handlePreviousSample}
        onStatusChange={handleStatusChange}
        onTranscriptChange={handleTranscriptChange}
        review={selectedReview}
        sample={selectedSample}
        sampleIndex={selectedSampleIndex}
        sampleTotal={dataset.speechSamples.length}
      />
    );
  }

  return (
    <>
      <header className={dataset ? "app-header compact" : "app-header"}>
        <div>
          <h1>Speech Dataset Verifier</h1>
          {!dataset && (
            <>
              <h2>Import a dataset to start validation.</h2>
              <p className="hero-copy">
                Choose a collected dataset folder, or drop a zip containing the same folder structure.
              </p>
            </>
          )}
        </div>

        <div className={dataset ? "header-actions" : "start-actions"}>
          <BackendKeyLoader isLoading={isBackendLoading} onLoad={handleBackendLoad} />
          <DatasetImporter
            className={dataset ? "import-button" : "import-card"}
            onImport={handleImport}
            onZipImport={handleZipImport}
          >
            <ImportIcon />
            <span>{dataset ? "Import" : "Import file or drag and drop"}</span>
          </DatasetImporter>
        </div>
      </header>

      {isParsing && <p className="status-message">Parsing dataset...</p>}
      {isBackendLoading && <p className="status-message">Loading assigned dataset...</p>}
      {isExporting && <p className="status-message">Preparing verified zip...</p>}
      {successMessage && <p className="status-message success-message">{successMessage}</p>}
      {error && <p className="status-message error-message">{error}</p>}
      {dataset && (
        <DatasetSummary
          dataset={dataset}
          isFinishDisabled={isFinishDisabled}
          onFinish={handleFinish}
          onSelectSample={handleSelectSample}
          reviewRows={reviewRows}
          reviewedCount={reviewedCount}
        />
      )}
    </>
  );
}

function initialReviewState(dataset: ParsedDataset): Record<string, SampleReviewState> {
  return Object.fromEntries(
    dataset.speechSamples.map((sample) => [
      sample.id,
      {
        editedTranscript: sample.editedTranscript,
        status: sample.status,
      },
    ]),
  );
}
