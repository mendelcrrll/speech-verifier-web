import json
from dataclasses import dataclass
from pathlib import Path
from typing import Literal


ReviewStatus = Literal["unreviewed", "valid", "invalid"]
audio_extensions = {"flac", "m4a", "mp3", "ogg", "wav", "webm"}
transcript_extensions = {"json", "txt"}
speech_folders = {"speech", "speeches", "transcript", "transcripts", "voice"}
interference_folders = {"inteference", "interference", "interferences", "noise", "noises"}


@dataclass(frozen=True)
class FileRecord:
    path: Path
    relative_path: str
    parts: list[str]
    extension: str
    stem: str


def parse_dataset(root: Path, session_id: str) -> dict:
    warnings: list[str] = []
    audio_files: list[FileRecord] = []
    transcript_files: list[FileRecord] = []
    dataset_name = root.name or "dataset"

    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        relative_path = path.relative_to(root).as_posix()
        if _is_system_file(relative_path):
            continue

        parts = relative_path.split("/")
        extension = _extension(parts[-1])
        stem = _strip_extension(parts[-1])

        if extension in audio_extensions:
            audio_files.append(FileRecord(path, relative_path, parts, extension, stem))
        elif extension in transcript_extensions:
            transcript_files.append(FileRecord(path, relative_path, parts, extension, stem))

    transcripts_by_key = {
        _transcript_key(record): {**record.__dict__, "text": _read_transcript(record)}
        for record in transcript_files
    }
    noise_types_by_key = {
        _noise_type_audio_key(key): record
        for key, record in transcripts_by_key.items()
    }
    speech_samples = []
    interference_samples = []

    for record in audio_files:
        metadata = _parse_metadata(record.parts, record.stem)
        transcript = transcripts_by_key.get(_transcript_key(record))
        sample_id = _sample_id(record)

        if transcript and not _is_interference_path(record.parts):
            speech_samples.append({
                "id": sample_id,
                "mode": metadata["mode"],
                "split": metadata["split"],
                "user": metadata["user"],
                "stem": metadata["stem"],
                "sourcePath": record.relative_path,
                "audioUrl": f"/api/verifier/sessions/{session_id}/files/{record.relative_path}",
                "originalTranscript": transcript["text"],
                "editedTranscript": transcript["text"],
                "status": "unreviewed",
            })
        else:
            if not transcript and _is_speech_path(record.parts):
                warnings.append(f"Missing transcript for {record.relative_path}")

            noise_type = noise_types_by_key.get(_transcript_key(record))
            interference_samples.append({
                "id": sample_id,
                "mode": metadata["mode"],
                "split": metadata["split"],
                "user": metadata["user"],
                "stem": metadata["stem"],
                "sourcePath": record.relative_path,
                "audioUrl": f"/api/verifier/sessions/{session_id}/files/{record.relative_path}",
                "noiseTypePath": noise_type["relative_path"] if noise_type else None,
                "noiseType": noise_type["text"] if noise_type else _infer_noise_type(record.parts),
            })

    if not audio_files:
        warnings.append("No supported audio files found.")

    return {
        "name": dataset_name,
        "speechSamples": speech_samples,
        "interferenceSamples": interference_samples,
        "warnings": warnings,
    }


def _is_system_file(path: str) -> bool:
    file_name = path.split("/")[-1]
    return "__MACOSX/" in path or file_name.startswith("._") or file_name == ".DS_Store"


def _extension(file_name: str) -> str:
    return file_name.rsplit(".", 1)[1].lower() if "." in file_name else ""


def _strip_extension(file_name: str) -> str:
    return file_name.rsplit(".", 1)[0] if "." in file_name else file_name


def _transcript_key(record: FileRecord) -> str:
    parent = "/".join(record.parts[:-1])
    return f"{parent}/{record.stem}"


def _noise_type_audio_key(key: str) -> str:
    return key[:-len("_noise_type")] if key.endswith("_noise_type") else key


def _read_transcript(record: FileRecord) -> str:
    text = record.path.read_text(encoding="utf-8").strip()
    if record.extension != "json":
        return text

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        return text

    if isinstance(parsed, str):
        return parsed.strip()
    if isinstance(parsed, dict):
        return str(parsed.get("text") or parsed.get("transcript") or parsed.get("sentence") or text).strip()
    return text


def _parse_metadata(parts: list[str], fallback_stem: str) -> dict:
    folders = [part.lower() for part in parts[:-1]]
    split = "val" if any(part in {"val", "valid", "validation"} for part in folders) else "train"
    mode = "binuaral" if any(part in {"binaural", "binuaral"} for part in folders) else "single"
    mode_index = _first_index(folders, {"single", "binaural", "binuaral"})
    split_index = _first_index(folders, {"train", "val", "valid", "validation"})
    user_index = split_index + 1 if split_index != -1 else mode_index + 1
    user = parts[user_index] if 0 <= user_index < len(parts) - 1 else "unknown"
    return {"mode": mode, "split": split, "user": user, "stem": fallback_stem}


def _first_index(values: list[str], candidates: set[str]) -> int:
    for index, value in enumerate(values):
        if value in candidates:
            return index
    return -1


def _sample_id(record: FileRecord) -> str:
    return record.relative_path.lower()


def _is_speech_path(parts: list[str]) -> bool:
    return any(part.lower() in speech_folders for part in parts)


def _is_interference_path(parts: list[str]) -> bool:
    return any(part.lower() in interference_folders for part in parts)


def _infer_noise_type(parts: list[str]) -> str | None:
    folders = parts[:-1]
    for index, folder in enumerate(folders):
        if folder.lower() in interference_folders and index + 1 < len(folders):
            return folders[index + 1]
    return None
