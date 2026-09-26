@AGENTS.md

# Gelbien — project notes

Personal-finance app (Next.js 16 App Router, React 19, Tailwind v4). One deployment: UI + route handlers.

- Data lives in a Google Sheet in the user's own Drive (`drive.file` scope). Layout + row mapping: `src/lib/sheet-schema.ts`; Sheets/Drive calls: `src/server/sheets.ts`.
- Auth is hand-rolled Google OAuth (PKCE) with an encrypted JWE session cookie — `src/server/{session,google,context}.ts`. No Firebase, no DB.
- Every write is a `Mutation` (`src/lib/types.ts`), validated by zod (`src/lib/validation.ts`), applied optimistically by the pure reducer `src/lib/data/reducer.ts` (also the demo-mode write path), then sent to `/api/data`.
- Analytics are pure functions in `src/lib/finance.ts` (unit-tested). Charts in `src/components/charts/*` follow the dataviz rules: categorical palette validated for CVD, fold to top 6 + "everything else", table view for every chart, no dual axes.
- AI is bring-your-own-key, called from the browser (`src/lib/ai/client.ts`): Anthropic (default `claude-opus-5`) or Gemini free tier. Output schemas are deliberately lenient; values are matched to real names in code.
- All UI strings go through `t()`; keep `src/lib/i18n/{en,pt,fr}.ts` in sync (pt/fr are typed against en).
- `cn()` uses tailwind-merge — pass overrides via `className`, don't fight base classes.

Checks: `npm run typecheck && npm run lint && npm test && npm run build`.
