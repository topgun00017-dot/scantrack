# ScanTrack — receipt scanner & expense tracker

React Native + Expo (SDK 58) app modelled on SparkReceipt's core features:

| Feature | Where in the app |
|---|---|
| **Scan receipts** — AI captures every line, tax and total | 📷 centre tab. Camera or gallery (batch up to 10). Review screen shows extracted merchant, date, total, SST, payment and line items, plus a duplicate warning |
| **Track expenses** — auto-categorised, tax-ready | 📊 Expenses tab. Period filter, total/tax, 6-month trend, spend by category, "items to tidy" alert |
| **Assistant** — find, tag, categorise, reconcile | ✨ Assistant tab. Chat with Claude using tools that search, bulk-update categories/tags, summarise spend and check for issues |
| **Organize receipts** — search, tag, export from one archive | 🗂️ Receipts tab. Full-text search, category/tag/review filters, long-press to multi-select → tag, re-categorise, export, delete |
| **Create expense reports** | More → Expense reports. Pick period/category/tag, include/exclude receipts, generate a PDF (optionally with receipt images), mark submitted |
| **Export data** — CSV, PDF, Excel, ZIP | More → Export data (or from a selection on the Receipts tab) |
| **Prepare for accounting** | More → Prepare for accounting. Readiness %, checklist, tap-to-fix open items, then one ZIP for your accountant (summary PDF + CSV + Excel + all photos + open-items list) |

## Run it

```bash
npm install
npx expo start
```

Scan the QR code with **Expo Go** (Android) or the iPhone Camera app. Your phone and computer must be on the same Wi-Fi (or run `npx expo start --tunnel`).

## Build an installable APK

### Option A — GitHub (no Android tools needed)
1. Create a new repository on github.com (private is fine).
2. Upload this whole folder (drag the files in, including the hidden `.github` folder) and commit to `main`.
3. Open the **Actions** tab → *Build Android APK*. It starts by itself (or click **Run workflow**). Takes ~15–20 min.
4. When it's green, open the run → **Artifacts** → download `ScanTrack-apk` (a zip containing `app-release.apk`).

### Option B — Expo EAS (free Expo account)
```bash
npm install
npx eas-cli login
npx eas-cli build -p android --profile preview
```
When it finishes, EAS prints a link and QR code to download the APK.

### Install on the phone
Copy the `.apk` to the phone (or open the link on it), tap it, and allow **Install unknown apps** for your browser/file manager when Android asks. Play Protect may warn that the app is from an unknown developer — choose *Install anyway*.

## Turn on AI

Open **More → Settings** and paste a Claude API key (console.anthropic.com). Model defaults to `claude-sonnet-5-5`.

Without a key the app still works: photos are saved and you type the details, and the assistant runs an offline mode (spend totals, search, reconcile).

> ⚠️ The key is stored on the phone, which is fine for testing. Before publishing, move the calls in `src/ai.js` behind your own server so the key isn't inside the app.

## Sample data

The first launch loads 13 sample receipts (including a deliberate duplicate and one needing review) so every screen has something to show. Remove them in Settings → *Remove sample receipts*.

## Project layout

```
App.js                     tab bar + simple stack navigation
src/store.js               receipts, reports, settings (AsyncStorage) + image storage
src/ai.js                  Claude calls: receipt extraction (vision) and assistant tool loop
src/exporters.js           CSV / Excel (SheetJS) / PDF (expo-print) / ZIP (JSZip) + accountant package
src/categories.js          categories + keyword auto-categorisation (Malaysian merchants included)
src/utils.js               filtering, summaries, date ranges, duplicate & issue detection
src/components.js          shared UI
src/screens/*              one file per screen
```

## Notes

- Currency defaults to MYR (change in Settings). Tax field is labelled SST.
- Data lives on the device only; there's no account or cloud sync yet.
- If `npm install` warns about versions, run `npx expo install --fix`.
