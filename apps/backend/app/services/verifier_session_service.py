import json
import os
import shutil
from dataclasses import asdict, dataclass
from pathlib import Path
from uuid import uuid4

from app.services.dataset_service import parse_dataset
from app.services.key_service import KeyEntry, load_key_entry
from app.services.s3_service import download_prefix, safe_child_path, upload_folder


DEFAULT_WORKSPACE_ROOT = Path(__file__).resolve().parents[1] / "workspace"
SESSIONS: dict[str, "VerifierSession"] = {}


@dataclass
class VerifierSession:
    session_id: str
    access_key: str
    user: str
    bucket: str
    s3_prefix: str
    verified_bucket: str
    verified_s3_prefix: str
    root: str


def create_session(access_key: str) -> dict:
    entry = load_key_entry(access_key)
    session_id = str(uuid4())
    session_root = _workspace_root() / "active" / session_id
    original_root = session_root / "original"
    working_root = session_root / "working"

    downloaded_count = download_prefix(entry.bucket, entry.s3_prefix, original_root)
    if downloaded_count == 0:
        shutil.rmtree(session_root, ignore_errors=True)
        raise FileNotFoundError("No files found at the configured S3 prefix")

    shutil.copytree(original_root, working_root, dirs_exist_ok=True)
    session = _session_from_entry(session_id, entry, session_root)
    SESSIONS[session_id] = session
    _write_session_file(session)
    _write_json(_reviews_path(session), {})
    _write_status(session, "in_progress")
    return get_session_state(session_id)


def get_session(session_id: str) -> VerifierSession:
    if session_id in SESSIONS:
        return SESSIONS[session_id]

    session_file = _workspace_root() / "active" / session_id / ".verifier" / "session.json"
    if not session_file.is_file():
        raise KeyError("Session not found")

    data = _read_json(session_file)
    session = VerifierSession(**data)
    SESSIONS[session_id] = session
    return session


def get_session_state(session_id: str) -> dict:
    session = get_session(session_id)
    dataset = parse_dataset(_working_root(session), session.session_id)
    reviews = _load_reviews(session)
    _apply_reviews(dataset, reviews)
    return {
        "sessionId": session.session_id,
        "user": session.user,
        "s3Prefix": f"s3://{session.bucket}/{session.s3_prefix}",
        "verifiedS3Prefix": f"s3://{session.verified_bucket}/{session.verified_s3_prefix}",
        "dataset": dataset,
        "reviews": reviews,
    }


def save_review(session_id: str, sample_id: str, status: str | None, edited_transcript: str | None) -> dict:
    session = get_session(session_id)
    dataset = parse_dataset(_working_root(session), session.session_id)
    sample_ids = {sample["id"] for sample in dataset["speechSamples"]}
    if sample_id not in sample_ids:
        raise KeyError("Sample not found")

    reviews = _load_reviews(session)
    current = reviews.get(sample_id, {})
    if status is not None:
        if status not in {"unreviewed", "valid", "invalid"}:
            raise ValueError("Invalid review status")
        current["status"] = status
    if edited_transcript is not None:
        current["editedTranscript"] = edited_transcript
    reviews[sample_id] = current
    _write_json(_reviews_path(session), reviews)
    return get_session_state(session_id)


def finish_session(session_id: str) -> dict:
    session = get_session(session_id)
    dataset = parse_dataset(_working_root(session), session.session_id)
    reviews = _load_reviews(session)
    verified_root = _verified_root(session)
    if verified_root.exists():
        shutil.rmtree(verified_root)
    verified_root.mkdir(parents=True, exist_ok=True)

    for sample in dataset["speechSamples"]:
        review = reviews.get(sample["id"], {})
        if review.get("status") != "valid":
            continue

        sample_dir = verified_root / sample["mode"] / sample["split"] / sample["user"] / sample["stem"]
        sample_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(safe_child_path(_working_root(session), sample["sourcePath"]), sample_dir / "recording.wav")
        (sample_dir / "transcript.txt").write_text(review.get("editedTranscript", sample["editedTranscript"]), encoding="utf-8")
        (sample_dir / "transcript_original.txt").write_text(sample["originalTranscript"], encoding="utf-8")

    for sample in dataset["interferenceSamples"]:
        base_dir = verified_root / sample["mode"] / "inteference" / sample["split"] / sample["user"]
        base_dir.mkdir(parents=True, exist_ok=True)
        source_path = safe_child_path(_working_root(session), sample["sourcePath"])
        shutil.copy2(source_path, base_dir / source_path.name)

        noise_type_path = sample.get("noiseTypePath")
        if noise_type_path:
            noise_path = safe_child_path(_working_root(session), noise_type_path)
            shutil.copy2(noise_path, base_dir / noise_path.name)
        elif sample.get("noiseType"):
            (base_dir / f"{sample['stem']}_noise_type.txt").write_text(sample["noiseType"], encoding="utf-8")

    _write_json(verified_root / "verification_reviews.json", reviews)
    uploaded_count = upload_folder(verified_root, session.verified_bucket, session.verified_s3_prefix)
    _write_status(session, "uploaded")

    return {
        "status": "uploaded",
        "uploadedCount": uploaded_count,
        "verifiedS3Prefix": f"s3://{session.verified_bucket}/{session.verified_s3_prefix}",
    }


def session_file_path(session_id: str, relative_path: str) -> Path:
    session = get_session(session_id)
    path = safe_child_path(_working_root(session), relative_path)
    if not path.is_file():
        raise FileNotFoundError("File not found")
    return path


def _session_from_entry(session_id: str, entry: KeyEntry, root: Path) -> VerifierSession:
    return VerifierSession(
        session_id=session_id,
        access_key=entry.key,
        user=entry.user,
        bucket=entry.bucket,
        s3_prefix=entry.s3_prefix,
        verified_bucket=entry.verified_bucket,
        verified_s3_prefix=entry.verified_s3_prefix,
        root=str(root),
    )


def _workspace_root() -> Path:
    return Path(os.getenv("SPEECH_VERIFIER_WORKSPACE", DEFAULT_WORKSPACE_ROOT))


def _working_root(session: VerifierSession) -> Path:
    return Path(session.root) / "working"


def _verified_root(session: VerifierSession) -> Path:
    return Path(session.root) / "verified"


def _metadata_root(session: VerifierSession) -> Path:
    return Path(session.root) / ".verifier"


def _reviews_path(session: VerifierSession) -> Path:
    return _metadata_root(session) / "reviews.json"


def _write_session_file(session: VerifierSession) -> None:
    metadata_root = _metadata_root(session)
    metadata_root.mkdir(parents=True, exist_ok=True)
    _write_json(metadata_root / "session.json", asdict(session))


def _write_status(session: VerifierSession, status: str) -> None:
    _write_json(_metadata_root(session) / "status.json", {"status": status})


def _load_reviews(session: VerifierSession) -> dict:
    path = _reviews_path(session)
    return _read_json(path) if path.is_file() else {}


def _apply_reviews(dataset: dict, reviews: dict) -> None:
    for sample in dataset["speechSamples"]:
        review = reviews.get(sample["id"])
        if not review:
            continue
        sample["status"] = review.get("status", sample["status"])
        sample["editedTranscript"] = review.get("editedTranscript", sample["editedTranscript"])


def _read_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def _write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_suffix(f"{path.suffix}.tmp")
    with temp_path.open("w", encoding="utf-8") as file:
        json.dump(data, file, indent=2)
        file.write("\n")
    temp_path.replace(path)
