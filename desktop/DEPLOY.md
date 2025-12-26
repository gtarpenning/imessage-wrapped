# Desktop App Deployment

> **Quick Reference:** See [RELEASE-GUIDE.md](../RELEASE-GUIDE.md) in project root for all deployment commands.

## Quick Deploy

```bash
make release-desktop
```

**This command:**
1. Bumps version (1.0.0 → 1.0.1)
2. Builds DMG locally
3. Signs & notarizes (requires Developer ID certificate)
4. Creates GitHub release with signed DMG

**Time:** ~5-10 minutes (notarization takes 2-5 min)

**Download URL:** https://imessage-wrapped.fly.dev/api/download

## Prerequisites

### Required for Signing & Notarization

1. **Apple Developer ID Certificate** ($99/year)
   - Install "Developer ID Application" certificate in Keychain
   - Verify: `security find-identity -v | grep "Developer ID Application"`

2. **App-Specific Password**
   - Create at: https://appleid.apple.com/account/manage
   - Store in Keychain:
     ```bash
     security add-generic-password -a "griffin@tarpenning.com" \
       -s "notarization-password" -w "your-app-specific-password"
     ```

3. **GitHub CLI**
   ```bash
   brew install gh
   gh auth login
   ```

## Step-by-Step

### 1. Full Release (Recommended)

```bash
make release-desktop
```

This automatically:
- Bumps version (1.0.0 → 1.0.1)
- Updates `build-release.sh` and `setup.py`
- Commits version bump
- Builds unsigned DMG
- Signs and notarizes DMG (2-5 min)
- Creates git tag
- Creates GitHub release with signed DMG

### 2. Verify Release

```bash
# Check GitHub release
open https://github.com/gtarpenning/imessage-wrapped/releases

# Test download endpoint
curl -I https://imessage-wrapped.fly.dev/api/download

# Download and test locally
curl -L https://imessage-wrapped.fly.dev/api/download -o test.dmg
open test.dmg
```

## Manual Steps (Advanced)

### Build Only

```bash
cd desktop
./build-release.sh
```

Creates unsigned `iMessage-Wrapped-<version>.dmg` in `desktop/` directory.

### Sign Existing DMG

```bash
cd desktop
./sign-dmg.sh iMessage-Wrapped-1.0.5.dmg
```

Creates `signed-iMessage-Wrapped-1.0.5.dmg` with:
- Code signed app bundle
- Notarized by Apple
- Ready for distribution

### Publish to GitHub

```bash
cd desktop
./publish-release.sh 1.0.5 signed-iMessage-Wrapped-1.0.5.dmg
```

Creates GitHub release with signed DMG.

### Manual Release (No Automation)

```bash
# 1. Update versions
vim desktop/build-release.sh  # Change VERSION
vim desktop/setup.py          # Change CFBundleVersion

# 2. Build
cd desktop
./build-release.sh

# 3. Sign
./sign-dmg.sh iMessage-Wrapped-1.0.5.dmg

# 4. Commit and tag
git add build-release.sh setup.py
git commit -m "Bump desktop version to 1.0.5"
git tag desktop-v1.0.5
git push && git push origin desktop-v1.0.5

# 5. Create release
./publish-release.sh 1.0.5 signed-iMessage-Wrapped-1.0.5.dmg
```

## Versioning

`make release-desktop` automatically updates:
1. `desktop/setup.py` - `CFBundleVersion` and `CFBundleShortVersionString`
2. `desktop/build-release.sh` - `VERSION` variable

Versions follow semantic versioning: `MAJOR.MINOR.PATCH`

## Troubleshooting

### Notarization Fails with "Invalid"

Check notarization logs:
```bash
xcrun notarytool history --apple-id griffin@tarpenning.com
xcrun notarytool log <submission-id> --apple-id griffin@tarpenning.com
```

Common issues:
- **Unsigned binaries:** All `.dylib`, `.so`, and executables must be signed
- **Missing hardened runtime:** Use `--options runtime` when signing
- **Invalid entitlements:** Check app entitlements don't conflict

### Stapling Fails

If notarization succeeds but stapling fails with "Record not found":
- Wait 5-10 minutes for Apple's CDN to propagate
- Retry stapling: `xcrun stapler staple signed-iMessage-Wrapped-1.0.5.dmg`
- If still fails, DMG is still valid (users just need internet to verify)

### Build Fails

```bash
# Clean and retry
cd desktop
rm -rf build dist
./build-release.sh
```

### Signing Certificate Not Found

```bash
# List available certificates
security find-identity -v | grep "Developer ID"

# Update SIGNING_IDENTITY in sign-local.sh if needed
```

### App-Specific Password Issues

```bash
# Re-add password to Keychain
security delete-generic-password -s "notarization-password"
security add-generic-password -a "griffin@tarpenning.com" \
  -s "notarization-password" -w "xxxx-xxxx-xxxx-xxxx"
```

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

## Scripts Reference

| Script | Purpose | Usage |
|--------|---------|-------|
| `build-release.sh` | Build unsigned DMG | `./build-release.sh` |
| `sign-dmg.sh` | Sign & notarize DMG | `./sign-dmg.sh <dmg-file>` |
| `publish-release.sh` | Create GitHub release | `./publish-release.sh <version> <signed-dmg>` |
| `sign-release.sh` | Legacy: Sign from GitHub | Downloads & signs latest release |

## Checklist

- [ ] Developer ID certificate installed
- [ ] App-specific password in Keychain
- [ ] GitHub CLI authenticated
- [ ] `make release-desktop`
- [ ] Verify: https://github.com/gtarpenning/imessage-wrapped/releases
- [ ] Test: `curl -I https://imessage-wrapped.fly.dev/api/download`

## URLs

- **Download**: https://imessage-wrapped.fly.dev/api/download
- **Releases**: https://github.com/gtarpenning/imessage-wrapped/releases
- **Apple Developer**: https://developer.apple.com/account

