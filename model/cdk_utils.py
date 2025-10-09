"""Helpers for reading shared CDK configuration during model training scripts."""

import os
import re
from pathlib import Path
from typing import Dict, Optional


def _load_env() -> Dict[str, str]:
    """Aggregate .env overrides from common locations in the repo."""
    # Collect overrides in priority order: local dir, repo root, then CDK directory.
    env_overrides = {}
    env_file = Path(".env")
    if env_file.exists():
        env_overrides.update(_parse_env_file(env_file))

    repo_root = Path(__file__).resolve().parent.parent
    root_env = repo_root / ".env"
    if root_env.exists():
        env_overrides.update(_parse_env_file(root_env))

    cdk_env = repo_root / "cdk" / ".env"
    if cdk_env.exists():
        env_overrides.update(_parse_env_file(cdk_env))

    return env_overrides


def _parse_env_file(path: Path) -> Dict[str, str]:
    """Parse key/value pairs from a .env file."""
    overrides: Dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, raw_value = stripped.split("=", 1)
        key = key.strip()
        value = raw_value.strip().strip("\"\'")
        if key and value:
            overrides.setdefault(key, value)
    return overrides


_ENV = _load_env()
# Snapshot of environment overrides loaded once at import time.


def get_env(key: str, *, expand: bool = False) -> Optional[str]:
    """Read an environment value, preferring process vars over .env overrides."""
    raw = os.environ.get(key) or _ENV.get(key)
    if raw is None or not raw.strip():
        return None
    raw = raw.strip()
    return _apply_tokens(raw) if expand else raw


def get_stack_suffix() -> Optional[str]:
    """Return a sanitized stack suffix, respecting CDK naming constraints."""
    raw = get_env("STACK_SUFFIX")
    if not raw:
        return None
    suffix = re.sub(r"[^A-Za-z0-9-]", "-", raw)
    suffix = re.sub(r"-{2,}", "-", suffix).strip("-")
    return suffix or None


def get_backend_stack_name() -> str:
    """Construct the backend stack name with an optional suffix."""
    base = get_env("BACKEND_STACK_BASE") or "FraudBackendStack"
    suffix = get_stack_suffix()
    return f"{base}-{suffix}" if suffix else base


def get_artifact_root() -> Path:
    """Location under which trained model artifacts should be materialized."""
    root = get_env("MODEL_ARTIFACT_ROOT", expand=True) or "artifacts"
    return (Path(__file__).resolve().parent / root).resolve()


def _apply_tokens(value: str) -> str:
    """Substitute placeholder tokens like {STACK_NAME} in configuration strings."""
    replacements = {
        "STACK_NAME": get_backend_stack_name(),
        "STACK_SUFFIX": get_stack_suffix() or "",
    }
    resolved = value
    for key, token in replacements.items():
        resolved = resolved.replace(f"{{{key}}}", token)
    return resolved
