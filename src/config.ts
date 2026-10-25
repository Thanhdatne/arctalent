/**
 * wagmi + ConnectKit configuration for ArcTalent
 * Built with Arc Studio — https://studio.arc.io
 */

import { http, createConfig } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { arcTestnet } from 'viem/chains'
import { getDefaultConfig } from 'connectkit'
import { registerChain } from './tracing'

// Pre-register chain RPC URLs so trace events show correct chain names immediately
registerChain(arcTestnet.id, arcTestnet.rpcUrls.default.http[0])

export const config = createConfig(
  getDefaultConfig({
    chains: [arcTestnet, mainnet],
    transports: {
      [arcTestnet.id]: http(arcTestnet.rpcUrls.default.http[0]),
      [mainnet.id]: http(), // ENS resolution uses mainnet
    },
    walletConnectProjectId: (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined) ?? '',
    appName: 'ArcTalent',
    appDescription: 'Web3 Talent Network — hire, escrow, and pay talent with USDC on Arc',
    appUrl: 'https://studio.arc.io',
  })
)

export const ARC_TESTNET_ID = arcTestnet.id

// USDC is native on Arc — same address on testnet and mainnet
export const USDC_ADDRESS = '0x3600000000000000000000000000000000000000' as const

export const CONTRACTS = {
  talentRegistry: (import.meta.env.VITE_TALENT_REGISTRY_ADDRESS ?? '') as `0x${string}`,
  referralManager: (import.meta.env.VITE_REFERRAL_MANAGER_ADDRESS ?? '') as `0x${string}`,
  jobEscrow: (import.meta.env.VITE_JOB_ESCROW_ADDRESS ?? '') as `0x${string}`,
} as const
