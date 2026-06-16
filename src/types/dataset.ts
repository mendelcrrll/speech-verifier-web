/*
* Defines the shapes of different dataset types
*/
export type ReviewStatus = "unreviewed" | "valid" | "invalid";
export type RecordingMode = "single" | "binuaral";
export type DatasetSplit = "train" | "val";

export type SpeechSample = {
  id: string;
  mode: RecordingMode;
  split: DatasetSplit;
  user: string;
  stem: string;
  sourcePath: string;
  audioFile: File;
  originalTranscript: string;
  editedTranscript: string;
  status: ReviewStatus;
};

export type InterferenceSample = {
  id: string;
  mode: RecordingMode;
  split: DatasetSplit;
  user: string;
  stem: string;
  sourcePath: string;
  audioFile: File;
  noiseTypeFile?: File;
  noiseType?: string;
};

export type ParsedDataset = {
  name: string;
  speechSamples: SpeechSample[];
  interferenceSamples: InterferenceSample[];
  warnings: string[];
};
