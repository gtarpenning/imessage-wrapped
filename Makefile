.PHONY: help clean build upload bump-patch bump-minor bump-major build-upgrade-deploy release-desktop lint format typecheck check

help:
	@echo "Available commands:"
	@echo ""
	@echo "  Release Commands:"
	@echo "    make build-upgrade-deploy   - Deploy Python CLI to PyPI (patch bump)"
	@echo "    make release-desktop        - Build, sign, and release Desktop GUI"
	@echo ""
	@echo "  Version Bumping:"
	@echo "    make bump-patch             - Bump patch version (0.1.0 -> 0.1.1)"
	@echo "    make bump-minor             - Bump minor version (0.1.0 -> 0.2.0)"
	@echo "    make bump-major             - Bump major version (0.1.0 -> 1.0.0)"
	@echo ""
	@echo "  Development:"
	@echo "    make clean                  - Remove build artifacts"
	@echo "    make build                  - Build package for PyPI"
	@echo "    make upload                 - Upload to PyPI"
	@echo ""
	@echo "  Code Quality:"
	@echo "    make lint                   - Run ruff linter"
	@echo "    make format                 - Format code with ruff"
	@echo "    make typecheck              - Run ty type checker"
	@echo "    make check                  - Run all checks (lint + typecheck)"
	@echo ""
	@echo "See RELEASE-GUIDE.md for deployment instructions"

clean:
	@echo "Cleaning build artifacts..."
	rm -rf dist/ build/ src/*.egg-info

bump-patch:
	@echo "Bumping patch version..."
	@python -c "import re; \
	content = open('pyproject.toml').read(); \
	match = re.search(r'version = \"(\d+)\.(\d+)\.(\d+)\"', content); \
	major, minor, patch = match.groups(); \
	new_version = f'{major}.{minor}.{int(patch)+1}'; \
	new_content = re.sub(r'version = \"\d+\.\d+\.\d+\"', f'version = \"{new_version}\"', content); \
	open('pyproject.toml', 'w').write(new_content); \
	print(f'Version bumped to {new_version}')"

bump-minor:
	@echo "Bumping minor version..."
	@python -c "import re; \
	content = open('pyproject.toml').read(); \
	match = re.search(r'version = \"(\d+)\.(\d+)\.(\d+)\"', content); \
	major, minor, patch = match.groups(); \
	new_version = f'{major}.{int(minor)+1}.0'; \
	new_content = re.sub(r'version = \"\d+\.\d+\.\d+\"', f'version = \"{new_version}\"', content); \
	open('pyproject.toml', 'w').write(new_content); \
	print(f'Version bumped to {new_version}')"

bump-major:
	@echo "Bumping major version..."
	@python -c "import re; \
	content = open('pyproject.toml').read(); \
	match = re.search(r'version = \"(\d+)\.(\d+)\.(\d+)\"', content); \
	major, minor, patch = match.groups(); \
	new_version = f'{int(major)+1}.0.0'; \
	new_content = re.sub(r'version = \"\d+\.\d+\.\d+\"', f'version = \"{new_version}\"', content); \
	open('pyproject.toml', 'w').write(new_content); \
	print(f'Version bumped to {new_version}')"

build: clean
	@echo "Building package..."
	python -m build

upload:
	@echo "Uploading to PyPI..."
	python -m twine upload dist/*

build-upgrade-deploy: bump-patch build upload
	@echo "✓ Package upgraded and deployed successfully!"

release-desktop:
	@echo "Building and releasing desktop app..."
	@python desktop/release.py

lint:
	@echo "Running ruff linter..."
	ruff check src/ --fix --unsafe-fixes

format:
	@echo "Formatting code with ruff..."
	ruff format src/

typecheck:
	@echo "Running ty type checker..."
	ty check src/

check: lint typecheck
	@echo "✓ All checks passed!"

