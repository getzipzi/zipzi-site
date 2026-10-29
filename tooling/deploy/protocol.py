"""Bounded static-site transport. No archive member is ever extracted to disk."""
from __future__ import annotations

import hashlib
import io
import json
from pathlib import Path
import re
import tarfile

MAX_ARCHIVE = 8 * 1024 * 1024
MAX_FILE = 4 * 1024 * 1024
MAX_FILES = 128
SHA = re.compile(r"[a-f0-9]{64}\Z")
COMMIT = re.compile(r"[a-f0-9]{40}\Z")
FIXED = frozenset({
    "index.html", "404.html", "robots.txt", "sitemap.xml", "sitemap-index.xml",
    "sitemap-0.xml", "favicon.png", "apple-touch-icon.png", "media/editor-screenshot.jpg",
})
ASSET = re.compile(r"_astro/[A-Za-z0-9_-]+\.[A-Za-z0-9_.-]+\.(?:css|js|webp|png|jpg)\Z")
METADATA = frozenset({"manifest.json", "source.json", "SHA256SUMS", "DEPLOYMENT.txt"})


class Rejected(Exception):
    """A safe category suitable for logs; never include request/credential content."""


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def allowed(path: str) -> bool:
    return isinstance(path, str) and (path in FIXED or bool(ASSET.fullmatch(path))) and ".." not in path


def immutable(path: str) -> bool:
    return bool(ASSET.fullmatch(path))


def json_load(data: bytes):
    def unique(items):
        result = {}
        for key, value in items:
            if key in result:
                raise Rejected("duplicate-json-key")
            result[key] = value
        return result
    try:
        return json.loads(data, object_pairs_hook=unique)
    except (ValueError, UnicodeError) as error:
        raise Rejected("invalid-json") from error


def validate(files: dict[str, bytes], expected_commit: str) -> dict[str, bytes]:
    if not COMMIT.fullmatch(expected_commit):
        raise Rejected("invalid-commit")
    if not METADATA.issubset(files):
        raise Rejected("missing-metadata")
    source = json_load(files["source.json"])
    if not isinstance(source, dict) or set(source) != {"commit", "dirty"} or source["commit"] != expected_commit or source["dirty"] is not False:
        raise Rejected("dirty-or-mismatched-source")
    manifest = json_load(files["manifest.json"])
    if not isinstance(manifest, dict) or set(manifest) != {"files", "totalBytes"}:
        raise Rejected("invalid-manifest")
    entries = manifest["files"]
    if not isinstance(entries, list) or not 1 <= len(entries) <= MAX_FILES:
        raise Rejected("invalid-file-count")
    site, sums = {}, []
    total = 0
    for entry in entries:
        if not isinstance(entry, dict) or set(entry) != {"path", "bytes", "sha256"}:
            raise Rejected("invalid-manifest-entry")
        path, size, sha = entry["path"], entry["bytes"], entry["sha256"]
        if not allowed(path) or path in site:
            raise Rejected("unsafe-or-duplicate-site-path")
        if type(size) is not int or not 0 < size <= MAX_FILE or not isinstance(sha, str) or not SHA.fullmatch(sha):
            raise Rejected("invalid-file-metadata")
        data = files.get("site/" + path)
        if data is None or len(data) != size or digest(data) != sha:
            raise Rejected("artifact-checksum-mismatch")
        total += size
        site[path] = data
        sums.append(f"{sha}  site/{path}\n")
    if not FIXED.issubset(site) or type(manifest["totalBytes"]) is not int or manifest["totalBytes"] != total:
        raise Rejected("incomplete-site-manifest")
    if total > MAX_ARCHIVE or set(files) != METADATA | {"site/" + p for p in site}:
        raise Rejected("unexpected-artifact-files")
    if files["SHA256SUMS"] != "".join(sums).encode():
        raise Rejected("checksum-list-mismatch")
    return site


def read_directory(root: Path, commit: str) -> tuple[bytes, dict[str, bytes]]:
    if root.is_symlink() or not root.is_dir():
        raise Rejected("unsafe-artifact-directory")
    files = {}
    for path in sorted(root.rglob("*")):
        if path.is_symlink():
            raise Rejected("artifact-link")
        if path.is_dir():
            continue
        if not path.is_file() or path.stat().st_size > MAX_FILE:
            raise Rejected("artifact-special-or-large-file")
        name = path.relative_to(root).as_posix()
        files[name] = path.read_bytes()
    site = validate(files, commit)
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode="w", format=tarfile.USTAR_FORMAT) as archive:
        for name, data in sorted(files.items()):
            entry = tarfile.TarInfo(name)
            entry.size = len(data)
            entry.mode = 0o644
            archive.addfile(entry, io.BytesIO(data))
    blob = output.getvalue()
    if len(blob) > MAX_ARCHIVE:
        raise Rejected("archive-too-large")
    return blob, site


def read_archive(blob: bytes, commit: str) -> dict[str, bytes]:
    if len(blob) > MAX_ARCHIVE:
        raise Rejected("archive-too-large")
    files = {}
    try:
        with tarfile.open(fileobj=io.BytesIO(blob), mode="r:") as archive:
            for member in archive:
                name = member.name
                if (not member.isfile() or member.pax_headers or name in files
                        or not (name in METADATA or name.startswith("site/") and allowed(name[5:]))
                        or not 0 < member.size <= MAX_FILE or len(files) >= MAX_FILES + len(METADATA)):
                    raise Rejected("unsafe-archive-member")
                handle = archive.extractfile(member)
                if handle is None:
                    raise Rejected("unreadable-archive-member")
                files[name] = handle.read(MAX_FILE + 1)
    except (tarfile.TarError, EOFError) as error:
        raise Rejected("invalid-archive") from error
    return validate(files, commit)


def read_request(stream) -> tuple[dict, bytes]:
    line = stream.readline(4097)
    if len(line) > 4096 or not line.endswith(b"\n"):
        raise Rejected("invalid-request-header")
    request = json_load(line)
    if not isinstance(request, dict) or request.get("protocol") != 1:
        raise Rejected("invalid-protocol")
    action = request.get("action")
    if action == "deploy":
        if set(request) != {"protocol", "action", "commit", "archive_sha256", "bytes"}:
            raise Rejected("invalid-deploy-request")
        if not isinstance(request["commit"], str) or not COMMIT.fullmatch(request["commit"]):
            raise Rejected("invalid-commit")
        size = request["bytes"]
        if type(size) is not int or not 0 < size <= MAX_ARCHIVE:
            raise Rejected("invalid-archive-size")
        blob = stream.read(size + 1)
        if len(blob) != size or digest(blob) != request["archive_sha256"]:
            raise Rejected("transport-checksum-mismatch")
        return request, blob
    if action == "rollback":
        if (set(request) != {"protocol", "action", "transaction", "expected_commit"}
                or not re.fullmatch(r"[a-f0-9]{32}", str(request["transaction"]))
                or not COMMIT.fullmatch(str(request["expected_commit"]))):
            raise Rejected("invalid-rollback-request")
    elif action == "status":
        if set(request) != {"protocol", "action"}:
            raise Rejected("invalid-status-request")
    else:
        raise Rejected("unknown-action")
    if stream.read(1):
        raise Rejected("unexpected-request-body")
    return request, b""


def encode_request(request: dict, blob: bytes = b"") -> bytes:
    return json.dumps(request, separators=(",", ":")).encode() + b"\n" + blob
