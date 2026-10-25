# ArcTalent

The onchain talent marketplace for Web3 builders. Clients post jobs with USDC escrow; talent applies, gets hired, and earns USDC on Arc.

Built with [Arc Studio](https://studio.arc.io)

---

## Tech stack

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS v3
- **Onchain:** wagmi v2 + ConnectKit + viem — Arc Testnet (chain ID 5042002)
- **Contracts:** Solidity 0.8.28 with Foundry — TalentRegistry, ReferralManager, JobEscrow
- **Payments:** USDC (ERC-20, 6 decimals) as escrow token on Arc

## Deployed contracts (Arc Testnet)

| Contract | Address |
|---|---|
| TalentRegistry | `0x118aa538d20f5cce8459d58cc52bb32ced56ecda` |
| ReferralManager | `0xbbb322032620d3f2e86ae541df82e51995fa0c18` |
| JobEscrow | `0xb9fab7e0c16cca5a6e4019f55eb93f18b4a984bc` |

Explorer: https://explorer.testnet.arc.io

## Development

### Prerequisites

- [Bun](https://bun.sh) >= 1.0
- [Foundry](https://book.getfoundry.sh) (for contract work)

### Install

```bash
bun install
```

### Environment variables

| Variable | Purpose |
|---|---|
| `VITE_WALLETCONNECT_PROJECT_ID` | WalletConnect Cloud project ID |
| `VITE_CLIENT_KEY` | Circle Console Client Key (Allowed Domain: `iimrj7yn988om34vce0el.preview.studio.arc.io`) |
| `VITE_CLIENT_URL` | Circle SDK URL — set to `https://modular-sdk.circle.com/v1/rpc/w3s/buidl` |
| `VITE_TALENT_REGISTRY_ADDRESS` | TalentRegistry contract address |
| `VITE_REFERRAL_MANAGER_ADDRESS` | ReferralManager contract address |
| `VITE_JOB_ESCROW_ADDRESS` | JobEscrow contract address |
| `RPC_PROXY_BASE_URL` | (Optional outside Arc Studio) Arc RPC proxy base URL |
| `RPC_PROXY_TOKEN` | (Optional outside Arc Studio) Arc RPC proxy token |
| `RPC_PROXY_CHAINS` | (Optional outside Arc Studio) Comma-separated proxy chain keys |

### Run

```bash
bun run dev
```

### Build

```bash
bun run build
```

### Test (contracts)

```bash
forge test
```

### Lint + typecheck

```bash
bun run check
```

## Features

- **Job Board** — browse open jobs with USDC budgets, filter by skill/type, bookmark jobs
- **Post a Job** — create an onchain job with escrow; preset deadline buttons
- **Talent Directory** — search and filter Web3 professionals by skill, rate, and reputation
- **Talent Profile** — verifiable onchain stats: jobs done, USDC earned, avg rating, work history
- **Dashboard** — manage your profile, view applications (My Applications), manage postings (My Posts), track saved jobs
- **USDC Escrow** — client funds escrow, talent submits work, client confirms and releases 96%
- **Reputation** — score built from completed jobs, ratings, and total USDC earned
- **Referral Program** — 1% of budget to referrer on first job completion
- **Dark / light mode** — flash-free, CSS-token-based theming

## Notes

- Deployed on Arc Testnet — for demonstration only.
- Saved jobs are stored in localStorage (device-local, not onchain).
- Get test USDC from the Arc Studio sidebar ("Get test USDC" button).
