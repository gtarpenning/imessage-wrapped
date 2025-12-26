.PHONY: help clean build upload bump-patch bump-minor bump-major build-upgrade-deploy

help:
	@echo "Available commands:"
	@echo "  make build-upgrade-deploy   - Bump patch version, build, and deploy to PyPI"
	@echo "  make bump-patch             - Bump patch version (0.1.0 -> 0.1.1)"
	@echo "  make bump-minor             - Bump minor version (0.1.0 -> 0.2.0)"
	@echo "  make bump-major             - Bump major version (0.1.0 -> 1.0.0)"
	@echo "  make clean                  - Remove build artifacts"
	@echo "  make build                  - Build package for PyPI"
	@echo "  make upload                 - Upload to PyPI"

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

