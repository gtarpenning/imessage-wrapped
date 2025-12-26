# Code Signing Guide

## Prerequisites

1. **Apple Developer Program** ($99/year)
   - Sign up at https://developer.apple.com/programs/
   - Wait for approval (24-48 hours)

2. **Get your certificate**
   - Open Xcode → Settings → Accounts
   - Sign in with Apple ID
   - Manage Certificates → + → Developer ID Application

3. **Get your Team ID**
   ```bash
   # List your certificates and find your Team ID
   security find-identity -v -p codesigning
   ```
   Look for something like: `Developer ID Application: Your Name (ABC123XYZ)`
   The part in parentheses is your Team ID.

4. **Create App-Specific Password**
   - Go to https://appleid.apple.com
   - App-Specific Passwords → Generate
   - Save this password

5. **Store password in keychain** (so you don't type it each time)
   ```bash
   security add-generic-password \
     -a "your@email.com" \
     -w "your-app-specific-password" \
     -s "notarization-password"
   ```

## Configuration

Edit `sign.sh` and update these values:

```bash
SIGNING_IDENTITY="Developer ID Application: YOUR NAME (TEAM_ID)"
APPLE_ID="your@email.com"
TEAM_ID="YOUR_TEAM_ID"
```

## Usage

```bash
# 1. Build the app
./build-release.sh

# 2. Sign and notarize
./sign.sh
```

That's it! The script will:
- ✅ Sign the app bundle
- ✅ Sign the DMG
- ✅ Submit for notarization
- ✅ Wait for Apple approval
- ✅ Staple the notarization ticket

## Verification

After signing, test on a fresh Mac:
```bash
# Should show: accepted
spctl --assess --verbose "iMessage-Wrapped-1.0.2.dmg"
```

## Troubleshooting

**"No identity found"**
- Make sure you've downloaded the certificate in Xcode
- Run: `security find-identity -v -p codesigning`

**"Invalid credentials"**
- Double-check your Apple ID
- Regenerate app-specific password
- Make sure it's stored in keychain correctly

**Notarization rejected**
- Check logs: `xcrun notarytool log SUBMISSION_ID`
- Common issue: missing `--options runtime` flag (already in script)

## Quick Reference

Find your certificates:
```bash
security find-identity -v -p codesigning
```

Test signature:
```bash
codesign --verify --verbose "dist/iMessage Wrapped.app"
spctl --assess --verbose "dist/iMessage Wrapped.app"
```

Check notarization history:
```bash
xcrun notarytool history --apple-id your@email.com
```

