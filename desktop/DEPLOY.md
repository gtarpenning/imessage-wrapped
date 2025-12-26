# Desktop App Deployment

> **Quick Reference:** See [RELEASE-GUIDE.md](../RELEASE-GUIDE.md) in project root for all deployment commands.

## Quick Deploy

```bash
make release-desktop
```

Automatically: bumps version, commits, tags, pushes. GitHub Actions builds and publishes DMG.

**Download URL:** https://imessage-wrapped.fly.dev/api/download

## Step-by-Step

### 1. Create Release

```bash
make release-desktop
```

This automatically:
- Bumps version (1.0.0 → 1.0.1)
- Updates `build-release.sh` and `setup.py`
- Commits and creates git tag
- Pushes to GitHub
- Triggers GitHub Actions

### 2. Monitor Build

GitHub Actions: https://github.com/gtarpenning/imessage-wrapped/actions

Builds app, creates DMG, publishes release.

### 3. Verify

```bash
curl -I https://imessage-wrapped.fly.dev/api/download
```

### 4. Test Locally (Optional)

```bash
cd desktop
./build-release.sh
open iMessage-Wrapped-*.dmg
```

## Manual Deployment

### Option 1: Automated (Recommended)

```bash
make release-desktop
```

### Option 2: Manual Tag

```bash
# 1. Update versions manually
vim desktop/build-release.sh  # Change VERSION
vim desktop/setup.py          # Change CFBundleVersion

# 2. Commit and tag
git add desktop/build-release.sh desktop/setup.py
git commit -m "Bump desktop version to 1.0.1"
git tag desktop-v1.0.1
git push && git push origin desktop-v1.0.1

# 3. GitHub Actions will build and create release
```

### Option 3: Local Build + Manual Upload

```bash
cd desktop
./build-release.sh

# Upload DMG manually to:
# https://github.com/gtarpenning/imessage-wrapped/releases/new
```

## Versioning

`make release-desktop` automatically updates:
1. `desktop/setup.py` - `CFBundleVersion` and `CFBundleShortVersionString`
2. `desktop/build-release.sh` - `VERSION` variable

Versions follow semantic versioning: `MAJOR.MINOR.PATCH`

## Code Signing (Optional)

For distribution without Gatekeeper warnings:

```bash
# Sign app
codesign --deep --force --sign "Developer ID Application: Your Name" \
  "dist/iMessage Wrapped.app"

# Sign DMG
codesign --sign "Developer ID Application: Your Name" \
  "iMessage-Wrapped-1.0.0.dmg"

# Notarize
xcrun notarytool submit iMessage-Wrapped-1.0.0.dmg \
  --apple-id "your@email.com" \
  --password "app-specific-password" \
  --team-id "TEAM_ID" \
  --wait

# Staple
xcrun stapler staple iMessage-Wrapped-1.0.0.dmg
```

Requires Apple Developer Program ($99/year).

## Storage

### Current: GitHub Releases (Free)

- DMG hosted on GitHub's CDN
- Unlimited bandwidth
- Global distribution
- Automatic versioning
- Zero maintenance

Benefits:
- ✅ Free for public repos
- ✅ Fast global CDN
- ✅ No storage limits
- ✅ Built-in version history
- ✅ Direct download links

The web app at `/api/download` automatically redirects to the latest GitHub release.

## Monitoring

### Download Stats

Check Fly.io logs:

```bash
cd web
fly logs
```

### Update Analytics

Add to `web/app/api/download/route.js`:

```javascript
console.log('Download:', {
  file: dmgFile,
  timestamp: new Date().toISOString(),
  userAgent: request.headers.get('user-agent'),
});
```

## Rollback

### GitHub Releases

If a release has issues:

1. Go to: https://github.com/gtarpenning/imessage-wrapped/releases
2. Click on the problematic release
3. Click "Delete release"
4. The `/api/download` endpoint will automatically serve the previous release

Or create a new release with a fix:

```bash
make release-desktop  # Creates new version
```

## Bandwidth

### GitHub Releases

- ✅ Unlimited bandwidth for public repos
- ✅ No costs
- ✅ Global CDN automatically

Supports unlimited downloads with no bandwidth charges.

## Checklist

- [ ] `make release-desktop`
- [ ] Monitor: https://github.com/gtarpenning/imessage-wrapped/actions
- [ ] Verify: https://github.com/gtarpenning/imessage-wrapped/releases
- [ ] Test: `curl -I https://imessage-wrapped.fly.dev/api/download`

## URLs

- **Download**: https://imessage-wrapped.fly.dev/api/download
- **Releases**: https://github.com/gtarpenning/imessage-wrapped/releases
- **Actions**: https://github.com/gtarpenning/imessage-wrapped/actions

