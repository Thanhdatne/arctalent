# ArcTalent — Agent Notes

## Deployed Contracts (Arc Testnet)

| Contract | Address | Explorer |
|---|---|---|
| TalentRegistry | `0x118aa538d20f5cce8459d58cc52bb32ced56ecda` | https://explorer.testnet.arc.io/address/0x118aa538d20f5cce8459d58cc52bb32ced56ecda |
| ReferralManager | `0xbbb322032620d3f2e86ae541df82e51995fa0c18` | https://explorer.testnet.arc.io/address/0xbbb322032620d3f2e86ae541df82e51995fa0c18 |
| JobEscrow | `0xb9fab7e0c16cca5a6e4019f55eb93f18b4a984bc` | https://explorer.testnet.arc.io/address/0xb9fab7e0c16cca5a6e4019f55eb93f18b4a984bc |
| USDC (Arc Testnet) | `0x3600000000000000000000000000000000000000` | — |

**Deploy order**: TalentRegistry → ReferralManager → JobEscrow

**Post-deploy wiring needed**: 
- `TalentRegistry.setEscrowContract(0xb9fab7e0c16cca5a6e4019f55eb93f18b4a984bc)`
- `ReferralManager.setEscrowContract(0xb9fab7e0c16cca5a6e4019f55eb93f18b4a984bc)`
- Both must be called by the deployer wallet `0x5B12Ce46C7194aD57d143bC22847224047b1Ef42`

## Deployer Wallet
- Address: `0x5B12Ce46C7194aD57d143bC22847224047b1Ef42`
- Platform: Circle SCP (Mode 1 deploy)
- Chain: Arc Testnet (chain ID 5042002)

## Design Decisions
- Contracts are non-upgradeable (v1); migration path documented in design doc
- `via_ir = true` added to foundry.toml for stack-depth relief in complex functions
- Referral payout is sent directly from JobEscrow to the referrer (not routed through ReferralManager's USDC balance)
- Talent can call `claimSubmittedTimeout` after deadline if client has not confirmed
- Fee bps are snapshotted per-job at postJob time (prevents retroactive fee changes)
- `claimExpiry` is guarded by `whenNotPaused` (consistent with design doc: pause halts all mutations)

## Test Results
- 125/125 unit tests pass (TalentRegistry: 24, ReferralManager: 21, JobEscrow: 80)
- Includes 256-run fuzz tests and 128,000-call invariant tests (zero reverts)
