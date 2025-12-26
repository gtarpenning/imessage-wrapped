.PHONY: help clean build upload bump-patch bump-minor bump-major build-upgrade-deploy release-desktop

help:
	@echo "Available commands:"
	@echo ""
	@echo "  Release Commands:"
	@echo "    make build-upgrade-deploy   - Deploy Python CLI to PyPI (patch bump)"
	@echo "    make release-desktop        - Deploy Desktop GUI to GitHub Releases"
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
	@echo "Creating desktop release..."
	@python -c "import re, subprocess; \
	content = open('desktop/build-release.sh').read(); \
	match = re.search(r'VERSION=\"(\d+)\.(\d+)\.(\d+)\"', content); \
	major, minor, patch = match.groups(); \
	new_version = f'{major}.{minor}.{int(patch)+1}'; \
	new_content = re.sub(r'VERSION=\"\d+\.\d+\.\d+\"', f'VERSION=\"{new_version}\"', content); \
	open('desktop/build-release.sh', 'w').write(new_content); \
	setup_content = open('desktop/setup.py').read(); \
	setup_content = re.sub(r\"'CFBundleVersion': '\d+\.\d+\.\d+'\", f\"'CFBundleVersion': '{new_version}'\", setup_content); \
	setup_content = re.sub(r\"'CFBundleShortVersionString': '\d+\.\d+\.\d+'\", f\"'CFBundleShortVersionString': '{new_version}'\", setup_content); \
	open('desktop/setup.py', 'w').write(setup_content); \
	print(f'✓ Bumped version to {new_version}'); \
	subprocess.run(['git', 'add', 'desktop/build-release.sh', 'desktop/setup.py'], check=True); \
	subprocess.run(['git', 'commit', '-m', f'Bump desktop version to {new_version}'], check=True); \
	tag = f'desktop-v{new_version}'; \
	subprocess.run(['git', 'tag', tag], check=True); \
	print(f'✓ Created tag {tag}'); \
	subprocess.run(['git', 'push'], check=True); \
	subprocess.run(['git', 'push', 'origin', tag], check=True); \
	print(f'✓ Pushed tag {tag}'); \
	print(f'\\n🎉 Release {tag} created!'); \
	print(f'GitHub Actions will build and publish the release.'); \
	print(f'View at: https://github.com/gtarpenning/imessage-wrapped/releases')"

