# Release Guide

Quick commands to deploy each component of iMessage Wrapped.

## Python CLI → PyPI

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

Bumps version (1.0.0 → 1.0.1), creates tag, pushes to GitHub.  
GitHub Actions builds DMG and creates release automatically.

**Monitor:** https://github.com/gtarpenning/imessage-wrapped/actions

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
| Desktop GUI | `make release-desktop` | GitHub release + DMG build |
| Web App | `cd web && fly deploy` | Fly.io deployment |

---

## Version Numbers

- **Python CLI**: `pyproject.toml` → version
- **Desktop GUI**: `desktop/build-release.sh` → VERSION & `desktop/setup.py` → CFBundleVersion
- **Web App**: No versioning (continuous deployment)

---

## Troubleshooting

**PyPI upload fails:** Check `~/.pypirc` credentials  
**GitHub Actions fails:** Check `.github/workflows/build-desktop-app.yml` logs  
**Fly.io deploy fails:** Run `fly auth login` and check `web/fly.toml`

