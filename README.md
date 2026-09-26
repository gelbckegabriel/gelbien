# Gelbien

A personal-finance web app that grew out of a spreadsheet: log expenses in seconds (or snap/paste a receipt and let AI fill it in), set monthly budgets, and get a dashboard that tells you where your money goes and how much you can save.

- **Your data lives in your own Google Drive** — the app creates one Google Sheet per user and uses it as the database.
- **One deployment** — a single Next.js app (UI + API routes). No Firebase, no separate database.
- **Fast** — data is cached in the browser, edits are optimistic, the sheet syncs in the background.
- **Portuguese, English and French** — switch in Profile; the choice syncs across devices.
- **Dark & gold**, mobile-first, animated, installable as an app on your phone (PWA manifest).

## Pages

| Page | What it does |
| --- | --- |
| **Dashboard** | Spent vs. budget ring, per-day allowance, 8 KPIs (saved, daily average, superfluous %, runway…), insights (free rule-based ones + optional AI), spending-pace chart, category donut, budget bars, daily heat-calendar, 12-month income vs. spending, money-flow Sankey, priority split, payment methods, top 10 expenses, savings projection, weekday pattern, and the year-at-a-glance matrix (the old *Resumo Anual*). Every chart has a table view. |
| **Budget** | Net & gross income (effective tax rate), a limit per category with live progress, planned savings, "this month only" vs "every month", suggest-from-history, copy last month, and subscriptions/recurring charges (the old *Assinaturas*). |
| **Expenses** | Grouped by day, search, filters (month/all time, category, priority, payment), sort, CSV export. Tap any row to edit. |
| **Chat** | Ask questions about your money; answers are streamed and grounded in your own data. |
| **Categories** | Rename (renames every expense/budget that uses it), recolor, pick icons, reorder, hide, edit subcategories and payment methods. |
| **Profile** | Language, currency, reserve & savings goal, warning threshold, AI provider + key, Google Sheet link, sync, `.xlsx` import, JSON/CSV backup & restore, cache. |

The **+** button (bottom bar on phones, sidebar/corner on desktop, or press **N**) adds an expense from anywhere. You can also **paste or drop a receipt image/PDF anywhere in the app** to start a new expense from it.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000 and click **Explore the demo** — it runs entirely in your browser with generated sample data, no setup needed.

To use your own data you need a Google OAuth client (below). Then sign in, go to **Profile → Your data → Import spreadsheet (.xlsx)** and pick your existing *Money Sheet* workbook: expenses, categories, budget, income, reserve and subscriptions come across.

## Setting up Google sign-in (≈10 minutes)

1. Go to <https://console.cloud.google.com>, create a project (e.g. "Gelbien").
2. **APIs & Services → Library**: enable **Google Sheets API** and **Google Drive API**.
3. **Google Auth Platform** (a.k.a. OAuth consent screen):
   - *Branding*: app name "Gelbien", your support email.
   - *Audience*: **External**. While the app is in *Testing*, add your Gmail under *Test users*.
   - *Data access*: add the scopes `openid`, `email`, `profile` and `https://www.googleapis.com/auth/drive.file`.
4. **Clients → Create client → Web application**. Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback`
   - `https://YOUR-DOMAIN/api/auth/callback` (once deployed)
5. Copy `.env.example` to `.env.local` and fill in the client ID, client secret and an `AUTH_SECRET` (`openssl rand -base64 32`).

Why `drive.file`? It only grants access to files **this app creates** (or you open with it). It is a *non-sensitive* scope, so Google does not require an app review. Gelbien cannot see anything else in your Drive.

> **Testing vs. production:** Google expires refresh tokens after 7 days for apps left in *Testing*, so you'd have to sign in weekly. When you're happy, click **Publish app** on the Audience page — with only non-sensitive scopes no verification is needed.

## AI (optional, bring your own key)

Insights, chat and receipt scanning run **directly from your browser to the provider**; the key is stored only in your browser's local storage and never reaches Gelbien's server.

| Provider | Cost | Where to get a key |
| --- | --- | --- |
| **Claude** (Anthropic) | Pay-as-you-go on your API account — a receipt or an insights run is typically a cent or two. Opus 5 by default; Sonnet 5 / Haiku 4.5 are cheaper. | <https://console.anthropic.com/settings/keys> |
| **Gemini** (Google) | **Free tier**, no card, rate-limited. ⚠️ On the free tier Google may use prompts (i.e. your spending data) to improve its products. | <https://aistudio.google.com/apikey> |

A Claude Pro/Max or ChatGPT Plus subscription can't be used here: Anthropic prohibits using subscription logins in third-party apps, and "Sign in with ChatGPT" only provides identity, not model access. API keys are the supported path.

Without AI, the dashboard still shows rule-based insights (over-budget categories, spending pace, spikes vs. your 3-month average, trials about to renew…).

## Deploying (Vercel)

1. Push this repo to GitHub and import it at <https://vercel.com/new>.
2. Add environment variables `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET`, and `APP_URL=https://your-app.vercel.app`.
3. Add `https://your-app.vercel.app/api/auth/callback` to the OAuth client's redirect URIs.

Any Node host works (`npm run build && npm start`).

## How it works

```
Browser ──(React Query cache, optimistic updates)──▶ /api/data ──▶ Google Sheets API ──▶ your "Gelbien — <name>" sheet
   │                                                  /api/receipts ──▶ Drive "Gelbien Receipts" folder
   └──(your own key, direct)──▶ Anthropic / Gemini
```

- **Auth** (`src/server/*`, `src/app/api/auth/*`): Google OAuth code flow with PKCE. The session (including the Google refresh token) lives in an **encrypted** (JWE, A256GCM) httpOnly cookie, so no database is needed. Access tokens refresh automatically.
- **Storage** (`src/lib/sheet-schema.ts`, `src/server/sheets.ts`): tabs `Transactions`, `Categories`, `Subcategories`, `Budgets`, `Income`, `Subscriptions`, `Settings`. Values are written RAW (a description starting with `=` stays text). The sheet stays human-readable — you can edit it in Google Sheets and Gelbien picks it up on the next sync.
- **Analytics** (`src/lib/finance.ts`): pure, unit-tested functions reproducing the spreadsheet's formulas (budget status at 85%, runway = reserve ÷ net burn, monthly average over months with spending) plus the new charts.
- **Demo mode** (`src/lib/demo.ts`): deterministic synthetic data; nothing personal is shipped in the code.

### Fixes over the original spreadsheet

- Amounts typed as text with a comma (e.g. `"12,50"`) were silently excluded from every total; the importer parses them.
- *TOTAL NO ANO* showed `#VALUE!`; the year total is computed correctly.
- *Resumo Anual* listed categories (Pets, Imigração) that didn't exist in *Config*; categories now come from one list everywhere.

## Scripts

```bash
npm run dev     # dev server
npm run build   # production build
npm test        # unit tests (vitest)
npm run lint
```
