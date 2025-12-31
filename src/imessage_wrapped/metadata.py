"""Collect system and SDK metadata for uploads."""

import hashlib
import platform
import random
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


def generate_unlock_code() -> str:
    """
    Generate a random 6-character alphanumeric unlock code.
    This code is used to unlock hydrated contact information.

    Returns:
        A 6-character uppercase alphanumeric string
    """
    # Use uppercase letters and digits for clarity (excluding confusing chars like O/0, I/1)
    chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(random.choice(chars) for _ in range(6))


def generate_user_fingerprint(
    user_name: Optional[str] = None, platform_info: Optional[dict] = None
) -> str:
    """
    Generate a stable fingerprint to identify the same user across uploads.
    Uses machine-specific information to create a consistent hash.

    Args:
        user_name: The user's name (optional)
        platform_info: Dictionary with platform, machine info (optional)

    Returns:
        A stable hash string identifying this user/machine combination
    """
    try:
        # Collect identifying information
        components = []

        # Add platform info
        if platform_info:
            components.append(platform_info.get("platform", ""))
            components.append(platform_info.get("machine", ""))
            components.append(platform_info.get("platform_version", ""))
        else:
            components.append(platform.system())
            components.append(platform.machine())
            components.append(platform.release())

        # Add user name if provided
        if user_name:
            components.append(user_name)

        # Create stable hash from these components
        fingerprint_str = "|".join(str(c) for c in components)
        fingerprint_hash = hashlib.sha256(fingerprint_str.encode()).hexdigest()

        # Return first 16 characters for readability
        return fingerprint_hash[:16]
    except Exception:
        # Fallback to a generic fingerprint
        return "unknown"


def collect_metadata(user_name: Optional[str] = None, with_contacts: bool = False) -> dict:
    """
    Collect system and SDK metadata.
    This should never raise an exception.

    Args:
        user_name: Optional user name to include in fingerprint generation
        with_contacts: If True, generate an unlock code for contact hydration
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

    # Generate user fingerprint for deduplication
    try:
        metadata["user_fingerprint"] = generate_user_fingerprint(user_name, metadata)
    except Exception:
        # Never fail on fingerprint generation
        pass

    # Generate unlock code for contact hydration (only if with_contacts is True)
    if with_contacts:
        try:
            metadata["unlock_code"] = generate_unlock_code()
        except Exception:
            # Never fail on unlock code generation
            pass

    return metadata
