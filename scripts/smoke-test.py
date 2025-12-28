#!/usr/bin/env python3
"""
Smoke test: Build package, install in clean env, verify it works.
Run before releasing to catch packaging issues.
"""

import subprocess
import sys
import tempfile
from pathlib import Path


def run(cmd, cwd=None, check=True):
    """Run command and return result."""
    result = subprocess.run(
        cmd,
        shell=True,
        cwd=cwd,
        capture_output=True,
        text=True,
    )
    if check and result.returncode != 0:
        print(f"❌ Command failed: {cmd}")
        print(result.stderr)
        sys.exit(1)
    return result


def main():
    print("🧪 Running smoke test...\n")

    repo_root = Path(__file__).parent.parent

    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir = Path(tmpdir)
        dist_dir = tmpdir / "dist"
        venv_dir = tmpdir / "venv"

        print("📦 Building package...")
        run(f"python -m build --outdir {dist_dir}", cwd=repo_root)

        wheel = list(dist_dir.glob("*.whl"))[0]
        print(f"   Built: {wheel.name}\n")

        print("🔍 Checking package contents...")
        result = run(f"python -m zipfile -l {wheel}", check=False)
        resource_files = [
            line.strip()
            for line in result.stdout.splitlines()
            if "stopwords_en.txt" in line or ".json" in line or ".csv" in line
        ]
        if resource_files:
            for line in resource_files:
                parts = line.split()
                if len(parts) >= 4:
                    print(f"   ✓ {parts[0]}")
        else:
            print("   ⚠️  No resource files found")
        print()

        print("🐍 Creating virtual environment...")
        run(f"python -m venv {venv_dir}")

        pip = venv_dir / "bin" / "pip"
        python = venv_dir / "bin" / "python"

        print("📥 Installing package...")
        run(f"{pip} install -q {wheel}")
        print()

        print("✓ Testing resource file access...")
        test_code = """
from importlib import resources
base = resources.files('imessage_wrapped.phrases.resources')
stopwords_file = base / 'stopwords_en.txt'
with resources.as_file(stopwords_file) as path:
    content = path.read_text(encoding='utf-8')
    word_count = len([line for line in content.splitlines() if line.strip()])
    print(f'  Loaded {word_count} stopwords')
"""
        run(f'{python} -c "{test_code}"')

        print("✓ Testing CLI import...")
        run(
            f"{python} -c \"from imessage_wrapped.cli import main; print('  CLI imports successfully')\""
        )

        print("✓ Testing core modules...")
        run(
            f"{python} -c \"from imessage_wrapped.analyzer import StatisticsAnalyzer; print('  Analyzer OK')\""
        )
        run(
            f"{python} -c \"from imessage_wrapped.exporter import Exporter; print('  Exporter OK')\""
        )
        run(
            f"{python} -c \"from imessage_wrapped.db_reader import DatabaseReader; print('  DB Reader OK')\""
        )

        print("\n🎉 All smoke tests passed!")


if __name__ == "__main__":
    main()
