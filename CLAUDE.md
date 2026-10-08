@AGENTS.md

# Gelbien — project notes

Personal-finance app (Next.js 16 App Router, React 19, Tailwind v4). One deployment: UI + route handlers.

- Data lives in a Google Sheet in the user's own Drive (`drive.file` scope). Layout + row mapping: `src/lib/sheet-schema.ts`; Sheets/Drive calls: `src/server/sheets.ts`.
- Auth is hand-rolled Google OAuth (PKCE) with an encrypted JWE session cookie — `src/server/{session,google,context}.ts`. No Firebase, no DB.
- Every write is a `Mutation` (`src/lib/types.ts`), validated by zod (`src/lib/validation.ts`), applied optimistically by the pure reducer `src/lib/data/reducer.ts` (also the demo-mode write path), then sent to `/api/data`.
- New fields on stored types: data saved by older versions (this browser's cached copy, the demo copy, backups) won't have them. TypeScript makes you give each one a value in `RECORD` (`src/lib/data/upgrade.ts`) and keep the zod schema in step — give it a `.default()` there. `upgrade.test.ts` loads and restores a frozen first-release dataset. Bump the cache `buster` (`providers.tsx`) only when a field is renamed or repurposed. `src/app/error.tsx` reloads with a fresh copy once if a page still crashes.
- Goals/accounts/net worth math is in `src/lib/goals.ts` (unit-tested). Balances come from manual monthly check-ins by design — no bank aggregator or credentials (see README).
- Analytics are pure functions in `src/lib/finance.ts` (unit-tested). Charts in `src/components/charts/*` follow the dataviz rules: categorical palette validated for CVD, fold to top 6 + "everything else", table view for every chart, no dual axes.
- AI is bring-your-own-key, called from the browser (`src/lib/ai/client.ts`): Anthropic (default `claude-opus-5`) or Gemini free tier. Output schemas are deliberately lenient; values are matched to real names in code.
- Money is never rounded for display: `f.amount` (cents only when there are some) or `f.money` (always cents); `f.moneyCompact` abbreviates only with a visible K/M. Big numbers draw their cents smaller (`MoneyText` / `AnimatedNumber smallCents`) and shrink to their box with `fitFont` inside an `@container` instead of rounding or truncating.
- All UI strings go through `t()`; keep `src/lib/i18n/{en,pt,fr}.ts` in sync (pt/fr are typed against en).
- The user guide (`/guide`, readable signed out) is long-form text in `src/lib/i18n/guide/{en,pt,fr}.ts`; the welcome tour (`src/components/welcome-tour.tsx`, text under `tour.*` in the message files) runs once per account, remembered by `settings.tourSeen`. When a page's behaviour or labels change, update its guide section and tour step in all three languages; bump `TOUR_VERSION` only if the tour should be shown again to everyone.
- `cn()` uses tailwind-merge — pass overrides via `className`, don't fight base classes.
- Motion is one shared language: tokens/variants in `src/lib/motion.ts`, CSS utilities in `globals.css` (`animate-pop-in`/`-up` for Radix popovers, `rise-in` for sheet contents, `rise-list` for menu lists). `Sheet` unfolds from the last tap (`tapOrigin`); pages slide in from the direction of the nav (`(app)/template.tsx`). Reuse these for new UI, and keep a plain fallback for reduced motion. Keep it smooth on phones: animate only opacity and transforms (motion: a whole `transform` string, not x/y/scale, so it runs on the compositor; bars grow with `growX`), never filters, backdrop-filters, widths, or clip-paths on large elements.

Checks: `npm run typecheck && npm run lint && npm test && npm run build`.
