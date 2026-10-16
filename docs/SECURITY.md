# Security and privacy notes

## Design

| Area | What the app does |
|---|---|
| Network | No INTERNET permission in the manifest, so Android blocks all network access. No analytics, ads, crash reporting or cloud code. The page has a Content-Security-Policy that allows only its own files. |
| Storage | One JSON document, AES-256-GCM encrypted, in two alternating files in the app's private folder. Each file has an authenticated header with a write counter. A crash mid-write cannot destroy the last good copy. No SQL is used, so there is no SQL injection surface. |
| Keys | A random 256-bit key is made on first run and stored through the Android Keystore (`@aparajita/capacitor-secure-storage`). No keys or passwords are in the source. |
| App lock | Phone biometric or screen lock (`@aparajita/capacitor-biometric-auth`), no PIN of its own. Auto-lock timeout from Settings. Locked state empties the screen content. Turning lock on or off needs the phone's confirmation. |
| Screenshots / recents | While app lock is on, Android's secure-window flag blocks screenshots and the recent-apps preview. |
| Android backup | `allowBackup=false` plus extraction rules excluding everything. |
| Export | CSV and backup files are written to a temporary cache folder, handed to the share sheet, and deleted afterwards (leftovers are cleared at next start). Formula-looking CSV cells are neutralised. |
| Backup | PBKDF2 (SHA-256) + AES-GCM with your passphrase. Restore validates size, structure and every record before replacing anything, and asks for confirmation. |
| Logs | No console logging in the source (checked); Capacitor native logging set to off; web view debugging off; release build is not debuggable. |
| Unreadable data | If saved data cannot be opened, the app writes nothing and offers restore-from-backup or start-empty. It never overwrites silently. |

## Verification actually performed (in the build sandbox)

- `npm test`: 13 unit tests passed (money parsing and rounding, month/year/leap-year logic, monthly totals, distance excluded, price history, CSV safety, encrypted storage round trip, slot fallback, tamper detection, backup round trip, wrong passphrase, malformed backups).
- `npm run audit:project`: all static checks passed (no INTERNET permission in the source manifest, no network APIs or URLs or console logging in source, no browser storage, no eval, no analytics packages, CSP present).
- `npm audit --omit=dev`: 0 known vulnerabilities at build time. Dependencies are exact-pinned in `package-lock.json`.
- Browser engine checks (headless Chromium, native calls replaced by in-memory fakes): launch animation timing, lock and auto-lock, the full Water Bottles walk-through (60 -> 3 x 60 = 180 -> change to 65 -> old record keeps 60), and a screen-by-screen comparison against the approved prototype: 84 steps, 1 intended difference (the removed "Prototype notes" card). Many form steps in that comparison did not find their buttons in either page, so coverage of forms by that comparison is partial.

## Not verified (you should check on the phone)

- The Android project has **not been compiled** and no APK has been built or installed by me. The GitHub build is the first real compile.
- Real fingerprint/face/PIN prompts, the share sheet, the file picker, the Keystore, the secure-window flag, edge-to-edge layout and the native splash have not been tried on a device.
- The "no INTERNET permission" check on the finished APK runs in the GitHub workflow (aapt2); I could not run it.
- No penetration test or independent review.

## Known limits

- Encryption protects against someone copying the files. It cannot protect against a rooted or compromised phone, or malware running as the app.
- The data key is not tied to your fingerprint; app lock is a separate gate. Someone who can unlock your phone and open the app while lock is off sees everything.
- Backups are only as strong as the passphrase. A lost passphrase cannot be recovered.
- A file you save from the share sheet leaves the app's protection; its safety is up to where you put it.
- The default signing key is in the repository (see SIGNING.md).
- The data is a single encrypted document rather than a relational database. It was chosen so the logic is identical to the approved prototype; it is loaded fully into memory, which is fine for household volumes (tens of thousands of records at most).
