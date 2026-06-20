from pathlib import Path


def download_prefix(bucket: str, prefix: str, destination: Path) -> int:
    import boto3

    destination.mkdir(parents=True, exist_ok=True)
    s3 = boto3.client("s3")
    paginator = s3.get_paginator("list_objects_v2")
    count = 0

    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        for item in page.get("Contents", []):
            key = item["Key"]
            if key.endswith("/"):
                continue

            relative_key = key[len(prefix):].lstrip("/")
            if not relative_key:
                continue

            target = safe_child_path(destination, relative_key)
            target.parent.mkdir(parents=True, exist_ok=True)
            s3.download_file(bucket, key, str(target))
            count += 1

    return count


def upload_folder(source: Path, bucket: str, prefix: str) -> int:
    import boto3

    s3 = boto3.client("s3")
    count = 0

    for path in source.rglob("*"):
        if not path.is_file():
            continue
        relative = path.relative_to(source).as_posix()
        key = f"{prefix.rstrip('/')}/{relative}"
        s3.upload_file(str(path), bucket, key)
        count += 1

    return count


def safe_child_path(root: Path, relative_path: str) -> Path:
    root = root.resolve()
    child = (root / relative_path).resolve()
    if root != child and root not in child.parents:
        raise ValueError(f"Path escapes workspace: {relative_path}")
    return child
