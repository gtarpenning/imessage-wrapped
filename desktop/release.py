#!/usr/bin/env python3
import os
import re
import subprocess
import sys


def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

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

    os.chdir("..")
    subprocess.run(["git", "add", "desktop/build-release.sh", "desktop/setup.py"], check=True)
    subprocess.run(["git", "commit", "-m", f"Bump desktop version to {new_version}"], check=True)

    print("\n🏗️  Building DMG...")
    result = subprocess.run(["./build-release.sh"], cwd="desktop")
    if result.returncode != 0:
        sys.exit(1)

    dmg_name = f"iMessage-Wrapped-{new_version}.dmg"

    print("\n🔐 Signing and notarizing...")
    result = subprocess.run(["./sign-dmg.sh", dmg_name], cwd="desktop")
    if result.returncode != 0:
        sys.exit(1)

    signed_dmg = dmg_name

    print("\n📤 Publishing to GitHub...")
    result = subprocess.run(["./publish-release.sh", new_version, signed_dmg], cwd="desktop")
    if result.returncode != 0:
        sys.exit(1)

    print("\n🎉 Release complete!")
    print("View at: https://github.com/gtarpenning/imessage-wrapped/releases")
    print("Download: https://imessage-wrapped.fly.dev/api/download")


if __name__ == "__main__":
    main()
