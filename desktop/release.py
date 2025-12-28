#!/usr/bin/env python3
import os
import re
import subprocess
import sys


def check_environment():
    required_vars = ["SIGNING_IDENTITY", "APPLE_ID", "TEAM_ID"]
    missing_vars = [var for var in required_vars if not os.environ.get(var)]

    if missing_vars:
        print("❌ Missing required environment variables:")
        for var in missing_vars:
            print(f"   - {var}")
        print("\nThese are required for code signing and notarization.")
        print("Make sure they are set in your shell environment (e.g., ~/.zshrc)")
        sys.exit(1)

    print("✓ All required environment variables present")


def check_git_clean():
    """Check if git working directory is clean."""
    result = subprocess.run(
        ["git", "status", "--porcelain"],
        capture_output=True,
        text=True,
        check=True,
    )

    if result.stdout.strip():
        print("❌ Git working directory is not clean!")
        print("\nPlease commit or stash your changes before releasing.")
        print("\nCurrent changes:")
        print(result.stdout)
        sys.exit(1)

    print("✓ Git working directory is clean")


def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    check_environment()

    os.chdir("..")
    check_git_clean()
    os.chdir("desktop")

    print("🧹 Cleaning up previous DMG files and mounts...")

    # Unmount any existing iMessage Wrapped volumes
    try:
        result = subprocess.run(["mount"], capture_output=True, text=True)
        if "iMessage Wrapped" in result.stdout:
            subprocess.run(
                ["hdiutil", "detach", "/Volumes/iMessage Wrapped", "-force"],
                stderr=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
            )
    except Exception:
        pass

    # Remove DMG files
    for dmg_file in ["temp.dmg"] + [f for f in os.listdir(".") if f.endswith(".dmg")]:
        if os.path.exists(dmg_file):
            os.remove(dmg_file)
            print(f"  Removed {dmg_file}")

    content = open("build-release.sh").read()
    match = re.search(r'VERSION="(\d+)\.(\d+)\.(\d+)"', content)
    if not match:
        print("❌ Could not find VERSION in build-release.sh")
        sys.exit(1)

    major, minor, patch = match.groups()
    new_version = f"{major}.{minor}.{int(patch) + 1}"

    new_content = re.sub(r'VERSION="\d+\.\d+\.\d+"', f'VERSION="{new_version}"', content)
    open("build-release.sh", "w").write(new_content)

    setup_content = open("setup.py").read()
    setup_content = re.sub(
        r"'CFBundleVersion': '\d+\.\d+\.\d+'", f"'CFBundleVersion': '{new_version}'", setup_content
    )
    setup_content = re.sub(
        r"'CFBundleShortVersionString': '\d+\.\d+\.\d+'",
        f"'CFBundleShortVersionString': '{new_version}'",
        setup_content,
    )
    open("setup.py", "w").write(setup_content)

    print(f"✓ Bumped version to {new_version}")

    print("\n🏗️  Building DMG...")
    result = subprocess.run(
        ["./build-release.sh"], cwd="desktop", shell=True, executable="/bin/zsh"
    )
    if result.returncode != 0:
        sys.exit(1)

    dmg_name = f"iMessage-Wrapped-{new_version}.dmg"

    print("\n🔐 Signing and notarizing...")
    result = subprocess.run(
        f"./sign-dmg.sh {dmg_name}", cwd="desktop", shell=True, executable="/bin/zsh"
    )
    if result.returncode != 0:
        sys.exit(1)

    signed_dmg = dmg_name

    print("\n📤 Publishing to GitHub...")
    result = subprocess.run(
        f"./publish-release.sh {new_version} {signed_dmg}",
        cwd="desktop",
        shell=True,
        executable="/bin/zsh",
    )
    if result.returncode != 0:
        sys.exit(1)

    print("\n🎉 Release complete!")
    print("View at: https://github.com/gtarpenning/imessage-wrapped/releases")
    print("Download: https://imessage-wrapped.fly.dev/api/download")


if __name__ == "__main__":
    main()
