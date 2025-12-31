"""Collect system and SDK metadata for uploads."""

import platform
import sys
from typing import Optional


def get_sdk_version() -> str:
    """Get the Python SDK version."""
    try:
        from importlib.metadata import version

        return version("imessage-wrapped")
    except Exception:
        # Fallback to reading from pyproject.toml if importlib fails
        try:
            import re
            from pathlib import Path

            # Try to find pyproject.toml
            current_file = Path(__file__)
            for parent in [current_file.parent.parent.parent, current_file.parent.parent]:
                pyproject = parent / "pyproject.toml"
                if pyproject.exists():
                    content = pyproject.read_text()
                    match = re.search(r'version\s*=\s*"([^"]+)"', content)
                    if match:
                        return match.group(1)
        except Exception:
            pass
        return "unknown"


def get_dmg_version() -> Optional[str]:
    """
    Get the DMG version if running from a packaged app.
    Returns None if not applicable or cannot be determined.
    """
    try:
        # Check if running from a .app bundle
        if sys.executable and ".app" in sys.executable.lower():
            # Try to read version from app bundle
            from pathlib import Path

            app_path = Path(sys.executable)

            # Look for Info.plist in the app bundle
            for parent in app_path.parents:
                if parent.suffix == ".app":
                    info_plist = parent / "Contents" / "Info.plist"
                    if info_plist.exists():
                        # Simple regex extraction (avoiding plistlib for simplicity)
                        import re

                        content = info_plist.read_text(errors="ignore")
                        match = re.search(
                            r"<key>CFBundleShortVersionString</key>\s*<string>([^<]+)</string>",
                            content,
                        )
                        if match:
                            return match.group(1)
                    break
    except Exception:
        pass
    return None


def collect_metadata() -> dict:
    """
    Collect system and SDK metadata.
    This should never raise an exception.
    """
    metadata = {}

    try:
        metadata["sdk_version"] = get_sdk_version()
    except Exception:
        metadata["sdk_version"] = "unknown"

    try:
        dmg_version = get_dmg_version()
        if dmg_version:
            metadata["dmg_version"] = dmg_version
    except Exception:
        pass

    try:
        metadata["python_version"] = (
            f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
        )
    except Exception:
        pass

    try:
        metadata["platform"] = platform.system()
    except Exception:
        pass

    try:
        metadata["platform_version"] = platform.release()
    except Exception:
        pass

    try:
        metadata["machine"] = platform.machine()
    except Exception:
        pass

    return metadata
