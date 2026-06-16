import JSZip from "jszip";
import type { ParsedDataset } from "../types/dataset";
import type { SampleReviewState } from "../types/review";

export async function exportVerifiedZip(
  dataset: ParsedDataset,
  reviews: Record<string, SampleReviewState>,
): Promise<void> {
  const zip = new JSZip();

  for (const sample of dataset.speechSamples) {
    const review = reviews[sample.id];
    if (review?.status !== "valid") {
      continue;
    }

    const sampleDir = `verified/${sample.mode}/${sample.split}/${sample.user}/${sample.stem}`;
    zip.file(`${sampleDir}/recording.wav`, sample.audioFile);
    zip.file(`${sampleDir}/transcript.txt`, review.editedTranscript);
    zip.file(`${sampleDir}/transcript_original.txt`, sample.originalTranscript);
  }

  for (const sample of dataset.interferenceSamples) {
    const baseDir = `verified/${sample.mode}/inteference/${sample.split}/${sample.user}`;
    zip.file(`${baseDir}/${fileName(sample.sourcePath)}`, sample.audioFile);

    if (sample.noiseTypeFile) {
      zip.file(`${baseDir}/${fileName(sample.noiseTypeFile.webkitRelativePath || sample.noiseTypeFile.name)}`, sample.noiseTypeFile);
    } else if (sample.noiseType) {
      zip.file(`${baseDir}/${sample.stem}_noise_type.txt`, sample.noiseType);
    }
  }

  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(blob, `${dataset.name || "verified"}-verified.zip`);
}

function fileName(path: string): string {
  return path.replaceAll("\\", "/").split("/").at(-1) ?? path;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
