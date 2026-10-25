# ArcTalent — Implementation Plan

## Summary

ArcTalent is a Web3 talent network and job board on Arc Testnet where clients post jobs with USDC budgets, hire talent, and lock payment in escrow — with onchain reputation scoring and a referral system baked in. All payments and fees use USDC natively on Arc (where USDC is the gas token). Ready to flip to Arc Mainnet by changing one env variable.

---

## Architecture

- **Blockchain:** Arc Testnet (chain ID 5042002) / Arc Mainnet (5042) ready
- **USDC:** `0x3600000000000000000000000000000000000000` — same address on both networks
- **EVM/Toolchain:** Solidity 0.8.28, Cancun EVM, Foundry, OpenZeppelin 5.6.1
- **Contract review preset:** Max (full review + unit tests — required for fund-custody contracts)
- **Wallet:** ConnectKit (external wallets) + Circle Modular Wallets passkey (no extension needed) — user picks at login

### Smart Contracts (3 — split for clean separation and independent upgradeability)

| Contract | Responsibility |
|---|---|
| `TalentRegistry.sol` | Profile storage, onchain reputation formula, update gate |
| `JobEscrow.sol` | Job board, escrow state machine, USDC custody, fee routing |
| `ReferralManager.sol` | Referral registration, payout on job completion |

**Escrow state machine:** `Open → Funded → Submitted → Completed | Refunded | Expired`

**Reputation formula:** `(jobsCompleted × 10) + (avgRating × 20) + (totalUSDCEarned / 100)`

**Fees:** 4% platform fee to `feeRecipient` (owner-controlled); 1% of job budget to referrer (from platform fee slice) when referral is registered.

### Frontend

- React + Vite + Tailwind CSS, Arc Light aesthetic
- Three main areas: public Job Board, public Talent Directory, authenticated Client + Talent Dashboards
- wagmi + ConnectKit for external wallets; Circle Modular Wallets for passkey login
- Referral links via `buildShareLink` (share-safe for iframe preview)

---

## Design Decisions (from planning answers)

- **Wallet type:** Both — ConnectKit (external) + Circle Modular Wallets passkey; user chooses at login
- **Contract scope:** Three separate contracts (TalentRegistry, JobEscrow, ReferralManager)
- **Review depth:** Max — full review including unit tests
- **Design doc:** Yes — produced first, reviewed before contracts are written

---

## Files to Create / Modify

### Smart Contracts
1. `contracts/ArcTalent-design.md` — design doc (produced first, reviewed before contracts are written)
2. `contracts/TalentRegistry.sol` — profile storage and onchain reputation scoring
3. `contracts/JobEscrow.sol` — job board + escrow state machine + USDC custody
4. `contracts/ReferralManager.sol` — referral registration and payout routing
5. `contracts/test/TalentRegistry.t.sol` — unit tests: profile CRUD, reputation formula, access control
6. `contracts/test/JobEscrow.t.sol` — unit tests: full state machine, escrow arithmetic, fee math, expiry, fuzz budget/rating
7. `contracts/test/ReferralManager.t.sol` — unit tests: referral registration, payout math, guard conditions

### Config & Wiring
8. `.env` — add `VITE_WALLETCONNECT_PROJECT_ID`, `VITE_CLIENT_KEY`, `VITE_CLIENT_URL`, contract addresses post-deploy
9. `src/config.ts` — wagmi config with Arc Testnet, ConnectKit + Modular Wallets setup, contract addresses
10. `src/lib/contracts.ts` — ABIs and typed contract read/write hooks for all three contracts
11. `src/lib/share.ts` — `getShareBase` / `buildShareLink` for referral link generation
12. `src/lib/utils.ts` — `formatAddress`, error parser, USDC formatting helpers

### Pages
13. `src/App.tsx` — router shell: header, bottom nav, route outlets
14. `src/pages/JobBoard.tsx` — public job listing with skill-tag filters, search, job cards
15. `src/pages/TalentDirectory.tsx` — public talent grid with skill filters and reputation badges
16. `src/pages/JobDetail.tsx` — job detail + apply (talent) / select talent + fund escrow (client)
17. `src/pages/TalentProfile.tsx` — public profile: bio, skills, reputation score, past jobs, ratings
18. `src/pages/ClientDashboard.tsx` — my jobs, escrow status, applicant management, post-job flow
19. `src/pages/TalentDashboard.tsx` — my applications, active escrows, earnings, reputation score, referral link
20. `src/pages/PostJob.tsx` — multi-step form: title/description → skills/budget/deadline → review + submit

### Components
21. `src/components/layout/Header.tsx` — logo, nav, wallet connection button
22. `src/components/layout/WalletModeSelector.tsx` — ConnectKit vs passkey choice on first visit
23. `src/components/wallet/PasskeyWallet.tsx` — Circle Modular Wallets integration (register/login, Gas Station)
24. `src/components/jobs/JobCard.tsx` — job listing card with status badge, budget, skills, deadline
25. `src/components/jobs/EscrowFlow.tsx` — step-by-step escrow UI with tx status and ArcScan links
26. `src/components/jobs/ApplicantList.tsx` — applicant cards with mini-profile, select-talent CTA
27. `src/components/talent/TalentCard.tsx` — talent grid card with avatar, skills, reputation score
28. `src/components/talent/ReputationBadge.tsx` — visual reputation score display with breakdown tooltip
29. `src/components/talent/SkillTag.tsx` — filterable skill chip component
30. `src/components/referral/ReferralCard.tsx` — referral link display with copy button and earnings tracker

### Docs
31. `README.md` — deployment steps, env var guide, contract addresses, testnet faucet instructions

---

## Build Sequence

1. **Design doc** — Write `contracts/ArcTalent-design.md` for all three contracts. User reviews before proceeding.
2. **Write contracts** — Author TalentRegistry → ReferralManager → JobEscrow (dependency order).
3. **Security review (max)** — Structural + functional review on all three contracts; preview fixes; auto-fix up to 3 rounds.
4. **Static analysis** — Slither across all three; fix actionable findings.
5. **Unit tests** — Foundry tests: happy path, reverts, events, fuzz arithmetic, invariants.
6. **Pre-deploy fork verification** — Full end-to-end on Arc Testnet fork: post → fund → submit → confirm → verify balances, fee, reputation, referral.
7. **Deploy to Arc Testnet** — Deploy in order: TalentRegistry, ReferralManager, JobEscrow (passes registry + referral manager addresses).
8. **Wallet + provider setup** — wagmi Arc Testnet config; ConnectKit + Circle Modular Wallets wiring; Console checklist emitted to chat.
9. **Core UI scaffold** — App.tsx router, Header, WalletModeSelector, Arc Light tokens, navigation shell.
10. **Job Board + Talent Directory** — Public pages reading live chain state (JobBoard, TalentDirectory, JobCard, TalentCard, SkillTag, ReputationBadge).
11. **Job Detail + Apply flow** — JobDetail.tsx with apply button, applicant list, PostJob.tsx multi-step form.
12. **Escrow flow UI** — EscrowFlow.tsx with four-state progress, tx status surfaces, ArcScan links.
13. **Client + Talent Dashboards** — Live escrow data, earnings, reputation score.
14. **Referral system UI** — ReferralCard with share link, earnings tracker, referral registration on talent signup.
15. **Talent Profile page** — Full profile, reputation breakdown, completed jobs, ratings.
16. **Polish + error handling** — Chain-wrong banners, loading skeletons, empty states, mobile responsiveness pass.
17. **README** — Deployment steps, env var guide, faucet instructions, contract addresses, mainnet upgrade checklist.

---

## Done When

- [ ] All three contracts deploy successfully to Arc Testnet
- [ ] Unit tests pass (happy path, reverts, fuzz, invariants)
- [ ] Pre-deploy fork verification passes end-to-end
- [ ] Talent can connect (external wallet or passkey), create a profile, appear in Talent Directory
- [ ] Client can post a job with a USDC budget and it appears on the Job Board
- [ ] Talent can apply; client can select talent and fund the escrow in USDC
- [ ] Talent can submit a deliverable; client can confirm and USDC releases to talent minus 4% fee
- [ ] Reputation score updates onchain after job completion and is visible on the talent's profile
- [ ] Referral payout is distributed on completion when a referrer is registered
- [ ] Expired jobs can be refunded after deadline
- [ ] All transactions show ArcScan links in the UI
- [ ] App is fully responsive on mobile
- [ ] README includes complete deployment steps and env var reference

---

## Pre-Build Checklist (required before build starts)

- [ ] **WalletConnect Project ID** — free from https://cloud.walletconnect.com; add to `.env` as `VITE_WALLETCONNECT_PROJECT_ID`
- [ ] **Circle Console Client Key** — from Console → Keys → Client Keys; set Allowed Domain AND Passkey Domain Name to: `iimrj7yn988om34vce0el.preview.studio.arc.io`
- [ ] Add `VITE_CLIENT_KEY=<your-key>` to `.env` (Client URL is already set)
