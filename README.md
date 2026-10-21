# Expenses

A private, offline household expense tracker for Android (₹ INR, DD/MM/YYYY). Water bottles with a calendar and price history, travel (distance, fuel, toll), Auto and Cabs rides with editable route presets, groceries, gas cylinders, electricity and water bills, rent, custom categories, monthly reports, CSV export and encrypted backup.

The user interface follows the approved HTML prototype (`design/expenses-prototype-approved.html`), with Auto and Cabs added from its supplied feature reference. The app runs inside an Android WebView (Capacitor 8), with encrypted storage, app lock, file export and the launch animation added around it.

## Get the APK from GitHub (nothing to install on your PC)

1. Create a new **private** repository on GitHub and upload everything in this folder, including the hidden `.github` folder and the `android` folder.
2. Open the **Actions** tab, pick **Build APK**, then **Run workflow**. It also runs on every push to `main`. When it turns green, open the run and download **Expenses-apk** from *Artifacts*.
3. For a Releases page download: `git tag v1.0.0 && git push origin v1.0.0`. The **Release APK** workflow then publishes `Expenses-v1.0.0.apk` and a `.sha256` file under **Releases**.
4. On the phone, open the APK and allow "install unknown apps" for your browser or files app when asked.

Every build is signed with the same key (`android/expenses-stable.jks`), so a new APK installs over the old one and keeps your records. Do not uninstall first. See `docs/SIGNING.md`.

## Run checks on your Windows PC (optional)

Needs Node.js 22+. In VS Code open this folder, then in the terminal:

```
npm ci
npm run build
npm test                 # unit tests: money, months, price history, storage, backup
npm run audit:project    # static privacy/security checks
```

Browser checks need a Chromium (set `CHROME_PATH` to its executable): `npm run test:smoke`, `npm run test:water`, `npm run test:cabs`, `npm run test:rent`, `npm run test:parity`.

To build the APK locally you also need JDK 21 and the Android SDK: `npm run sync`, then `cd android && gradlew assembleRelease`. The APK is in `android/app/build/outputs/apk/release/`.

## Rules

- **Water Bottles**: price asked once, then the calendar opens directly. Several deliveries a day. Each delivery keeps the unit price it was saved with; changing the default price never rewrites saved records.
- **Travel**: Distance, Fuel, Toll. Distance is never counted as spending.
- **Rent**: Manage tenants per receiving-rent house with agreement dates and monthly rent. Log receipts by choosing a tenant from the house’s dropdown; the saved monthly rent is suggested and totals are shown tenant-wise. Paid/received dates are on the main rent log form.
- **Auto and Cabs**: Log Auto-rickshaw or Cab fares against saved routes, or enter a one-off route. Route presets can be renamed, added or removed.
- **Categories** can be deleted from Settings. Choose any existing category; deleting it also deletes its expense records and, for Travel, its journeys.
- **Money** is stored as whole paise; quantities in thousandths. Unit price x quantity is rounded half-up to the paisa.
- **Month a record belongs to**: ordinary purchases by date, bills by billing month. Unpaid bills and rent received are not counted as spending.

## Privacy

No account, ads, analytics, crash reporting or cloud. The app declares no internet permission. Records are AES-256-GCM encrypted with a key kept in the Android Keystore, and excluded from Android backup. Optional app lock uses the phone's own fingerprint/face/screen lock. Full details and limits: `docs/SECURITY.md`.

## Layout

```
src/core     money, dates, rules, csv, backup crypto
src/data     live state, encrypted storage
src/native   Android access, app lock
src/ui       screens, forms, actions, launch animation
src/styles   CSS from the approved prototype, fonts, launch overlay
android/     Capacitor Android project
tests/       unit tests, browser tests
design/      approved prototype, icon pack, animation spec
```

## Differences from the preview

Only what a phone needs: the "Prototype notes" card and demo-data buttons are removed; "Preview the lock screen" is "Lock now" and uses the real phone lock; backup, restore and CSV use files and the Android share sheet instead of pasted text; one sentence on the lock screen explains the screenshot block.
