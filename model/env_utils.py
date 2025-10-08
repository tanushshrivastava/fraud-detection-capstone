import os
import re
from pathlib import Path
from typing import Dict, Optional

_ENV_CACHE: Dict[str, str] = {}
_ENV_LOADED = False


def _load_env_file() -> None:
    global _ENV_LOADED
    if _ENV_LOADED:
        return

    candidates = []
    override = os.environ.get("ENV_FILE_PATH")
    if override:
        candidates.append(Path(override).expanduser())

    cwd = Path.cwd()
    try:
        current_file = Path(__file__).resolve()
    except NameError:
        # __file__ is not defined, fallback to cwd
        current_file = cwd / "env_utils.py"
    repo_root = current_file.parent.parent.resolve()
    candidates.extend(
        [
            cwd / ".env",
            repo_root / ".env",
            repo_root / "cdk" / ".env",
        ]
    )

    for candidate in candidates:
        if not candidate.exists():
            continue
        for line in candidate.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or "=" not in stripped:
                continue
            key, raw_value = stripped.split("=", 1)
            key = key.strip()
            value = raw_value.strip().strip("\"'")
            if key and value and key not in _ENV_CACHE:
                _ENV_CACHE[key] = value
        break
    _ENV_LOADED = True


def get_env(key: str, *, expand: bool = False) -> Optional[str]:
    value = os.environ.get(key)
    if value is not None and value.strip():
        return _apply_tokens(value.strip()) if expand else value.strip()
    _load_env_file()
    cached = _ENV_CACHE.get(key)
    if cached is not None and cached.strip():
        return _apply_tokens(cached.strip()) if expand else cached.strip()
    return None


def _sanitize_suffix(value: str) -> str:
    sanitized = re.sub(r"[^A-Za-z0-9-]", "-", value)
    sanitized = re.sub(r"-{2,}", "-", sanitized)
    return sanitized.strip("-")


def get_stack_suffix() -> Optional[str]:
    raw = get_env("STACK_SUFFIX")
    if not raw:
        return None
    suffix = _sanitize_suffix(raw)
    return suffix or None


def get_backend_stack_name() -> str:
    suffix = get_stack_suffix()
    base = get_env("BACKEND_STACK_BASE") or "FraudBackendStack"
    if suffix:
        root = get_env("MODEL_ARTIFACT_ROOT", expand=True) or "artifacts"
    try:
        current_file = Path(__file__).resolve()
    except NameError:
        current_file = Path.cwd() / "env_utils.py"
    return (current_file.parent / root).resolve()


def get_artifact_root() -> Path:
    root = get_env("MODEL_ARTIFACT_ROOT", expand=True) or "artifacts"
    return (Path(__file__).resolve().parent / root).resolve()


def get_default_artifact_path() -> Path:
    return get_artifact_root() / get_backend_stack_name() / "model.tar.gz"


def get_resource_name_base() -> str:
    stack_name = get_backend_stack_name()
    sanitized = stack_name.lower()
    sanitized = re.sub(r"[^a-z0-9-]", "-", sanitized)
    sanitized = re.sub(r"-{2,}", "-", sanitized).strip("-")
    return sanitized or "fraudbackend"


def sagemaker_resource_name(suffix: str, max_length: int = 63) -> str:
    base = get_resource_name_base()
    candidate = f"{base}-{suffix}".rstrip("-")
    if len(candidate) > max_length:
        candidate = candidate[:max_length].rstrip("-")
    if not candidate:
        candidate = suffix[:max_length].rstrip("-")
    if not candidate:
        candidate = "resource"
    if not candidate[0].isalnum():
        candidate = f"a{candidate}"
        if len(candidate) > max_length:
            candidate = candidate[:max_length].rstrip("-")
    return candidate


def _apply_tokens(value: str) -> str:
    resolved = value
    for key, token_value in _token_map().items():
        placeholder = f"{{{key}}}"
        resolved = resolved.replace(placeholder, token_value)
    return resolved


def _token_map() -> Dict[str, str]:
    suffix = get_stack_suffix() or ""
    return {
        "STACK_NAME": get_backend_stack_name(),
        "STACK_SUFFIX": suffix,
        "RESOURCE_BASE": get_resource_name_base(),
    }
