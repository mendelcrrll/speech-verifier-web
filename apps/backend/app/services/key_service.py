import json
import os
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse


DEFAULT_KEY_MAP_PATH = Path(__file__).resolve().parents[1] / "data" / "key_map.json"


@dataclass(frozen=True)
class KeyEntry:
    key: str
    user: str
    bucket: str
    s3_prefix: str
    verified_bucket: str
    verified_s3_prefix: str


def load_key_entry(access_key: str) -> KeyEntry:
    key_map_path = Path(os.getenv("SPEECH_VERIFIER_KEY_MAP", DEFAULT_KEY_MAP_PATH))
    if not key_map_path.is_file():
        raise FileNotFoundError(f"Key map not found: {key_map_path}")

    with key_map_path.open("r", encoding="utf-8") as file:
        key_map = json.load(file)

    raw_entry = key_map.get(access_key)
    if not isinstance(raw_entry, dict):
        raise KeyError("Unknown verification key")

    bucket, s3_prefix = _bucket_and_prefix(raw_entry)
    verified_bucket, verified_prefix = _verified_bucket_and_prefix(raw_entry, bucket, s3_prefix)

    return KeyEntry(
        key=access_key,
        user=str(raw_entry.get("user") or "unknown"),
        bucket=bucket,
        s3_prefix=_folder_prefix(s3_prefix),
        verified_bucket=verified_bucket,
        verified_s3_prefix=_folder_prefix(verified_prefix),
    )


def _bucket_and_prefix(entry: dict) -> tuple[str, str]:
    s3_uri = entry.get("s3_uri") or entry.get("s3_path")
    if isinstance(s3_uri, str) and s3_uri.startswith("s3://"):
        return _parse_s3_uri(s3_uri)

    bucket = entry.get("bucket")
    prefix = entry.get("s3_prefix") or entry.get("prefix")
    if isinstance(bucket, str) and isinstance(prefix, str):
        return bucket, prefix

    raise ValueError("Key map entry must include s3_uri or bucket + s3_prefix")


def _verified_bucket_and_prefix(entry: dict, bucket: str, prefix: str) -> tuple[str, str]:
    verified_s3_uri = entry.get("verified_s3_uri") or entry.get("verified_s3_path")
    if isinstance(verified_s3_uri, str) and verified_s3_uri.startswith("s3://"):
        return _parse_s3_uri(verified_s3_uri)

    verified_bucket = entry.get("verified_bucket")
    verified_prefix = entry.get("verified_s3_prefix") or entry.get("verified_prefix")
    if isinstance(verified_bucket, str) and isinstance(verified_prefix, str):
        return verified_bucket, verified_prefix
    if isinstance(verified_prefix, str):
        return bucket, verified_prefix

    return bucket, f"{_folder_prefix(prefix)}verified/"


def _parse_s3_uri(uri: str) -> tuple[str, str]:
    parsed = urlparse(uri)
    if parsed.scheme != "s3" or not parsed.netloc:
        raise ValueError(f"Invalid S3 URI: {uri}")
    return parsed.netloc, parsed.path.lstrip("/")


def _folder_prefix(prefix: str) -> str:
    normalized = prefix.replace("\\", "/").lstrip("/")
    return normalized if normalized.endswith("/") else f"{normalized}/"
