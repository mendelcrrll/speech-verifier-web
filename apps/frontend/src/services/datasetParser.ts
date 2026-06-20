import type {
  DatasetSplit,
  InterferenceSample,
  ParsedDataset,
  RecordingMode,
  SpeechSample,
} from "../types/dataset";

const audioExtensions = new Set(["flac", "m4a", "mp3", "ogg", "wav", "webm"]);
const transcriptExtensions = new Set(["json", "txt"]);
const speechFolders = new Set(["speech", "speeches", "transcript", "transcripts", "voice"]);
const interferenceFolders = new Set(["inteference", "interference", "interferences", "noise", "noises"]);

type FileRecord = {
  file: File;
  path: string;
  parts: string[];
  extension: string;
  stem: string;
};

type TranscriptRecord = FileRecord & {
  text: string;
};

export async function parseDatasetFolder(files: File[]): Promise<ParsedDataset> {
  const warnings: string[] = [];
  const audioFiles: FileRecord[] = [];
  const transcriptFiles: FileRecord[] = [];
  let datasetName = "dataset";

  for (const file of files) {
    const path = normalizePath(file.webkitRelativePath || file.name);
    if (isSystemFile(path)) {
      continue;
    }

    const parts = path.split("/");
    const fileName = parts[parts.length - 1] ?? file.name;
    const extension = getExtension(fileName);
    const stem = stripExtension(fileName);

    if (parts.length > 1 && datasetName === "dataset") {
      datasetName = parts[0] || datasetName;
    }

    if (audioExtensions.has(extension)) {
      audioFiles.push({ file, path, parts, extension, stem });
    } else if (transcriptExtensions.has(extension)) {
      transcriptFiles.push({ file, path, parts, extension, stem });
    }
  }

  const transcriptEntries = await Promise.all(
    transcriptFiles.map(async (record): Promise<[string, TranscriptRecord]> => [
      transcriptKey(record),
      { ...record, text: await readTranscript(record) },
    ]),
  );
  const transcriptsByKey = new Map(transcriptEntries);
  const noiseTypesByKey = new Map(transcriptEntries.map(([key, record]) => [noiseTypeAudioKey(key), record]));
  const speechSamples: SpeechSample[] = [];
  const interferenceSamples: InterferenceSample[] = [];

  for (const record of audioFiles) {
    const metadata = parseMetadata(record.parts, record.stem);
    const transcript = transcriptsByKey.get(transcriptKey(record));
    const id = sampleId(record);

    if (transcript && !isInterferencePath(record.parts)) {
      speechSamples.push({
        id,
        mode: metadata.mode,
        split: metadata.split,
        user: metadata.user,
        stem: metadata.stem,
        sourcePath: record.path,
        audioFile: record.file,
        originalTranscript: transcript.text,
        editedTranscript: transcript.text,
        status: "unreviewed",
      });
    } else {
      if (!transcript && isSpeechPath(record.parts)) {
        warnings.push(`Missing transcript for ${record.path}`);
      }

      interferenceSamples.push({
        id,
        mode: metadata.mode,
        split: metadata.split,
        user: metadata.user,
        stem: metadata.stem,
        sourcePath: record.path,
        audioFile: record.file,
        noiseTypeFile: noiseTypesByKey.get(transcriptKey(record))?.file,
        noiseType: noiseTypesByKey.get(transcriptKey(record))?.text ?? inferNoiseType(record.parts),
      });
    }
  }

  if (audioFiles.length === 0) {
    warnings.push("No supported audio files found.");
  }

  return {
    name: datasetName,
    speechSamples,
    interferenceSamples,
    warnings,
  };
}

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/");
}

function isSystemFile(path: string): boolean {
  const fileName = path.split("/").at(-1) ?? path;
  return path.includes("__MACOSX/") || fileName.startsWith("._") || fileName === ".DS_Store";
}

function getExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex === -1 ? "" : fileName.slice(dotIndex + 1).toLowerCase();
}

function stripExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex === -1 ? fileName : fileName.slice(0, dotIndex);
}

function transcriptKey(record: FileRecord): string {
  return `${record.parts.slice(0, -1).join("/")}/${record.stem}`;
}

function noiseTypeAudioKey(key: string): string {
  return key.endsWith("_noise_type") ? key.slice(0, -"_noise_type".length) : key;
}

async function readTranscript(record: FileRecord): Promise<string> {
  const text = await record.file.text();

  if (record.extension !== "json") {
    return text.trim();
  }

  try {
    const parsed = JSON.parse(text) as unknown;
    if (typeof parsed === "string") {
      return parsed.trim();
    }
    if (isTranscriptObject(parsed)) {
      return String(parsed.text ?? parsed.transcript ?? parsed.sentence).trim();
    }
  } catch {
    return text.trim();
  }

  return text.trim();
}

function isTranscriptObject(value: unknown): value is {
  sentence?: unknown;
  text?: unknown;
  transcript?: unknown;
} {
  return typeof value === "object" && value !== null;
}

function parseMetadata(parts: string[], fallbackStem: string): {
  mode: RecordingMode;
  split: DatasetSplit;
  user: string;
  stem: string;
} {
  const folders = parts.slice(0, -1).map((part) => part.toLowerCase());
  const split = folders.includes("val") || folders.includes("valid") || folders.includes("validation")
    ? "val"
    : "train";
  const mode = folders.includes("binaural") || folders.includes("binuaral")
    ? "binuaral"
    : "single";
  const modeIndex = folders.findIndex((part) => part === "single" || part === "binaural" || part === "binuaral");
  const splitIndex = folders.findIndex((part) => part === "train" || part === "val" || part === "valid" || part === "validation");
  const userIndex = splitIndex !== -1 ? splitIndex + 1 : modeIndex + 1;
  const user = parts[userIndex] && userIndex < parts.length - 1 ? parts[userIndex] : "unknown";

  return {
    mode,
    split,
    user,
    stem: fallbackStem,
  };
}

function sampleId(record: FileRecord): string {
  return record.path.toLowerCase();
}

function isSpeechPath(parts: string[]): boolean {
  return parts.some((part) => speechFolders.has(part.toLowerCase()));
}

function isInterferencePath(parts: string[]): boolean {
  return parts.some((part) => interferenceFolders.has(part.toLowerCase()));
}

function inferNoiseType(parts: string[]): string | undefined {
  const folders = parts.slice(0, -1);
  const interferenceIndex = folders.findIndex((part) => interferenceFolders.has(part.toLowerCase()));
  return interferenceIndex === -1 ? undefined : folders[interferenceIndex + 1];
}
