.PHONY: help clean build upload bump-patch bump-minor bump-major build-upgrade-deploy release-desktop

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
	@python -c "import re, subprocess, os; \
	os.chdir('desktop'); \
	content = open('build-release.sh').read(); \
	match = re.search(r'VERSION=\"(\d+)\.(\d+)\.(\d+)\"', content); \
	major, minor, patch = match.groups(); \
	new_version = f'{major}.{minor}.{int(patch)+1}'; \
	new_content = re.sub(r'VERSION=\"\d+\.\d+\.\d+\"', f'VERSION=\"{new_version}\"', content); \
	open('build-release.sh', 'w').write(new_content); \
	setup_content = open('setup.py').read(); \
	setup_content = re.sub(r\"'CFBundleVersion': '\d+\.\d+\.\d+'\", f\"'CFBundleVersion': '{new_version}'\", setup_content); \
	setup_content = re.sub(r\"'CFBundleShortVersionString': '\d+\.\d+\.\d+'\", f\"'CFBundleShortVersionString': '{new_version}'\", setup_content); \
	open('setup.py', 'w').write(setup_content); \
	print(f'✓ Bumped version to {new_version}'); \
	os.chdir('..'); \
	subprocess.run(['git', 'add', 'desktop/build-release.sh', 'desktop/setup.py'], check=True); \
	subprocess.run(['git', 'commit', '-m', f'Bump desktop version to {new_version}'], check=True); \
	print(f'\\n🏗️  Building DMG...'); \
	result = subprocess.run(['./build-release.sh'], cwd='desktop', shell=True); \
	if result.returncode != 0: exit(1); \
	dmg_name = f'iMessage-Wrapped-{new_version}.dmg'; \
	print(f'\\n🔐 Signing and notarizing...'); \
	result = subprocess.run(['./sign-dmg.sh', dmg_name], cwd='desktop', shell=True); \
	if result.returncode != 0: exit(1); \
	signed_dmg = f'signed-{dmg_name}'; \
	print(f'\\n📤 Publishing to GitHub...'); \
	result = subprocess.run(['./publish-release.sh', new_version, signed_dmg], cwd='desktop', shell=True); \
	if result.returncode != 0: exit(1); \
	print(f'\\n🎉 Release complete!'); \
	print(f'View at: https://github.com/gtarpenning/imessage-wrapped/releases'); \
	print(f'Download: https://imessage-wrapped.fly.dev/api/download')"

