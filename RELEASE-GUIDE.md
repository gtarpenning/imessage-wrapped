# Release Guide

Quick commands to deploy each component of iMessage Wrapped.

## Python CLI → PyPI

**Test first:**
```bash
make test-install
```
Builds package in clean venv, verifies resource files and imports work.

**Deploy:**
```bash
make build-upgrade-deploy
```

Bumps patch version (0.1.7 → 0.1.8), builds, and uploads to PyPI.

**Manual version bump:**
```bash
make bump-minor    # 0.1.7 → 0.2.0
make bump-major    # 0.1.7 → 1.0.0
make build upload
```

**Verify:**
```bash
pip install --upgrade imessage-wrapped
imexport --version
```

---

## Desktop GUI → GitHub Releases

```bash
make release-desktop
```

Bumps version (1.0.0 → 1.0.1), builds DMG locally, signs & notarizes it, then creates GitHub release.

**Process:**
1. Version bump
2. Build DMG
3. Sign & notarize (2-5 min)
4. Create GitHub release with signed DMG

**Download:** https://imessage-wrapped.fly.dev/api/download

---

## Web App → Fly.io

```bash
cd web
fly deploy
```

Deploys Next.js app to https://imessage-wrapped.fly.dev

**Quick deploy from root:**
```bash
cd web && fly deploy && cd ..
```

**Verify:**
```bash
curl https://imessage-wrapped.fly.dev/api/health
```

---

## All Commands

| Component | Command | What it does |
|-----------|---------|--------------|
| Python CLI | `make build-upgrade-deploy` | PyPI release (patch bump) |
| Desktop GUI | `make release-desktop` | Build, sign, and publish to GitHub |
| Web App | `cd web && fly deploy` | Fly.io deployment |

---

## Version Numbers

- **Python CLI**: `pyproject.toml` → version
- **Desktop GUI**: `desktop/build-release.sh` → VERSION & `desktop/setup.py` → CFBundleVersion
- **Web App**: No versioning (continuous deployment)

---

## Troubleshooting

**PyPI upload fails:** Check `~/.pypirc` credentials  
**Desktop build fails:** Check `desktop/build-release.sh` and py2app installation  
**Signing fails:** Verify Developer ID certificate is installed in Keychain  
**Notarization fails:** Check Apple ID app-specific password in Keychain  
**Fly.io deploy fails:** Run `fly auth login` and check `web/fly.toml`

