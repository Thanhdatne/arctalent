/**
 * Reads ProfileRegistered events from TalentRegistry to build the talent address list.
 *
 * Root cause fix (2026-10-25): Arc Testnet RPC enforces a ~9 990-block cap on eth_getLogs
 * range. The previous implementation requested 50 000 blocks in one call, which always
 * returned "requested range too large". The error was swallowed silently, leaving the
 * talent list permanently empty.
 *
 * Fix: scan from the TalentRegistry deployment block forward in CHUNK-sized windows,
 * collecting every ProfileRegistered event. Also exposes an `error` flag so the UI
 * can distinguish "RPC failed" from "genuinely empty directory".
 */
import { useEffect, useState } from 'react'
import { createPublicClient, http, parseAbiItem } from 'viem'
import { arcTestnet } from 'viem/chains'
import { CONTRACTS } from '@/config'

// Arc Testnet RPC rejects requests spanning ≥ 10 000 blocks.
// Keep the chunk safely under that limit.
const CHUNK = 9_900n

// TalentRegistry was deployed at block 68 834 106 on Arc Testnet.
// Verified from contract-metadata/TalentRegistry.json txHash
// 0xc2d529ebe7271442f48916917da2fde910d34599e04cb5263696ca7a9f12ebe1
const DEPLOY_BLOCK = 68_834_106n

const client = createPublicClient({
  chain: arcTestnet,
  transport: http(arcTestnet.rpcUrls.default.http[0]),
})

const PROFILE_REGISTERED_ABI = parseAbiItem(
  'event ProfileRegistered(address indexed talent)'
)

export interface RegisteredTalentsState {
  talents: `0x${string}`[]
  loading: boolean
  error: boolean
}

export function useRegisteredTalents(): RegisteredTalentsState {
  const [state, setState] = useState<RegisteredTalentsState>({
    talents: [],
    loading: true,
    error: false,
  })

  useEffect(() => {
    let cancelled = false

    const scan = async () => {
      // Contract address not configured — treat as empty, not an error
      if (!CONTRACTS.talentRegistry) {
        if (!cancelled) setState({ talents: [], loading: false, error: false })
        return
      }

      try {
        const head = await client.getBlockNumber()

        // Scan from deploy block to head in CHUNK-sized windows.
        const seen = new Set<string>()
        const addrs: `0x${string}`[] = []

        for (let from = DEPLOY_BLOCK; from <= head; from += CHUNK + 1n) {
          if (cancelled) return
          const to = from + CHUNK > head ? head : from + CHUNK
          const logs = await client.getLogs({
            address: CONTRACTS.talentRegistry,
            event: PROFILE_REGISTERED_ABI,
            fromBlock: from,
            toBlock: to,
          })
          for (const log of logs) {
            const addr = log.args.talent
            if (addr && !seen.has(addr.toLowerCase())) {
              seen.add(addr.toLowerCase())
              addrs.push(addr)
            }
          }
        }

        if (!cancelled) {
          // Reverse so newest (highest block) appears first.
          setState({ talents: addrs.reverse(), loading: false, error: false })
        }
      } catch {
        if (!cancelled) {
          setState({ talents: [], loading: false, error: true })
        }
      }
    }

    void scan()
    return () => { cancelled = true }
  }, [])

  return state
}
