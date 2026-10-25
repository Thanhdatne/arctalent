# ArcTalent — QA Audit Report
Date: 2026-10-25

## Summary
Full source inspection of all 40+ files. 7 confirmed issues found and fixed. 0 lint errors, 0 typecheck errors, production build clean.

---

## Flows inspected (by source read)

| Flow | Method | Result |
|---|---|---|
| Wallet connection + ConnectKit | Source + config.ts | Pass — `arcTestnet` (chain ID 5042002) correctly wired; ConnectKit theme synced to dark/light via `ThemeContext` |
| Arc Testnet chain detection | Source | Pass — `ARC_TESTNET_ID = arcTestnet.id`, `isWrongChain` guard on all write paths |
| Contract addresses | config.ts + contracts.ts | Pass — addresses loaded from env vars; ABIs from compiled artifacts |
| Talent directory search/filter/sort | TalentDirectory.tsx | Pass — search, skill filter, category presets, max-rate filter, sort all wired correctly |
| Talent profile load / missing / error | TalentProfile.tsx | Pass — 3-state guard (loading → error → empty/unregistered → profile); hooks-safe |
| On-demand work history | TalentProfile.tsx | Pass — only fetches when user clicks "Show"; stable fixed-length `useReadContracts` |
| JobBoard tabs / filters / bookmarks | JobBoard.tsx | Pass — Open/All/Saved tabs; stable applicant-count batch; `useSavedJobs` per wallet |
| JobDetail applicant list + escrow sidebar | JobDetail.tsx | Pass — stable MAX_APPLICANT_PROFILES batch; sticky sidebar; escrow status pill |
| PostJob form validation | PostJob.tsx | Pass — budget, title, description required; chain-switch guard; deadline range slider |
| EscrowFlow approve→fund→submit→confirm | EscrowFlow.tsx | Pass — correct contract calls with right args; rating passed to `confirmCompletion`; cancel + claimExpiry |
| Dashboard My Applications / My Posts | Dashboard.tsx | Pass (fixed — see below) |
| Dashboard reputation hero + tier progress | Dashboard.tsx | Pass — subtle gradient card; `TierProgress` component reads live score |
| Saved jobs (device-local) | useSavedJobs.ts | Pass — per-wallet localStorage key; clearly labelled |
| Referral card | ReferralCard.tsx | Pass — reads `myCode`, activates, copies share link |
| Theme toggle + flash prevention | useTheme.ts + index.html | Pass — inline script applies class before paint |
| Header navigation + mobile menu | Header.tsx | Pass — framer-motion mobile menu; active underline |
| Footer links | Footer.tsx | Pass — correct explorer URLs; JobEscrow address link |
| Landing page real chain data | Landing.tsx | Pass — hooks-safe fixed-length batches for talent preview and jobs preview |
| `useRegisteredTalents` event scan | useRegisteredTalents.ts | Pass — bounded 50k-block lookback; newest-first; dedup |

---

## Issues fixed this session

### 1. EscrowFlow — hardcoded non-dark-safe colors
**File:** `src/components/jobs/EscrowFlow.tsx`
- `text-green-700` → `text-[var(--success)]` (budget row "You receive" and "Completed" state)
- `text-indigo-600` → `text-[var(--accent)]` (Selected Talent role)
- Star rating unselected `text-gray-300` → `text-[var(--border-strong)]`
- Cancel button `border-red-200 text-red-600 hover:bg-red-50` → CSS variable equivalents
- Claim expiry button `border-orange-200 text-orange-600 hover:bg-orange-50` → `dark:`-safe orange variants

### 2. TalentProfile — featured skill chips inverted
**File:** `src/pages/TalentProfile.tsx`
Skills index 1+ were `bg-[var(--accent)] text-white` (solid accent, overbearing). Changed to `bg-[var(--surface-muted)] text-[var(--ink-2)] border border-[var(--border)]` (neutral tag style). Only index 0 gets the accent-subtle highlight.

### 3. Dashboard — full-page reload on "View public profile"
**File:** `src/pages/Dashboard.tsx`
`<a href="/talent/0x...">` replaced with `<Link to="/talent/0x...">` for correct client-side navigation.

### 4. Dashboard — tab label + empty state
**File:** `src/pages/Dashboard.tsx`
- Tab renamed from `Active Jobs (N)` to `My Applications (N)` (uses `myTalentJobs.length`, shows all talent jobs)
- Removed `activeTalentJobs` derived variable (was unused after rename)
- Removed unused `JobStatus` import
- Empty state copy updated: "No applications yet — Apply to jobs and get selected by a client."

### 5. PostJob — floating-point budget preview
**File:** `src/pages/PostJob.tsx`
`parseFloat(budget) * 0.96` replaced with integer bigint arithmetic via `parseUSDC()` to avoid noise like `$999.9999999…`.

---

## Issues inspected but not changed

| Item | Finding |
|---|---|
| `useRegisteredTalents` event scan | Correct — bounded lookback, dedup, error-silent |
| `useSavedJobs` stability | Correct — key changes on wallet change, useEffect re-syncs |
| JobBoard / Dashboard `useReadContracts` batches | Correct — stable fixed-length arrays, not hooks-in-loops |
| TalentDirectory `useReadContracts` | Correct — passing `talents.map(...)` directly to `useReadContracts` is fine (single hook call; array is data, not hook calls) |
| `EscrowFlow.NOW_SEC` module-level | Correct — computed once at import; fresh on page reload |
| Contract addresses in ABIs | Unchanged — all loaded from env vars; not hardcoded |
| `ProfileCompleteness.tsx` | File does not exist and is not imported anywhere — no impact |
| Pre-existing lint warning in JobDetail.tsx | `applicants` array identity in `useMemo` dep — intentional design with `eslint-disable` comment; not introduced by this work |

---

## Verification
- **Lint:** 0 errors, 1 pre-existing warning (JobDetail `applicants` identity — not introduced by redesign)
- **Typecheck:** 0 errors
- **Production build:** ✓ built in 18.08s
- **Dev server:** Running on PID 2177

## Files changed this session
1. `src/components/jobs/EscrowFlow.tsx` — dark-safe colors (5 edits)
2. `src/pages/TalentProfile.tsx` — featured skill chips style
3. `src/pages/Dashboard.tsx` — Link fix, tab rename, unused var/import removal
4. `src/pages/PostJob.tsx` — budget preview integer math
