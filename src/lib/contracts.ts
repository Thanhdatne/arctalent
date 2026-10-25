/**
 * ArcTalent contract ABIs and type definitions
 * Built with Arc Studio — https://studio.arc.io
 */
import type { Abi } from 'viem'
import TalentRegistryArtifact from '../../contracts/out/TalentRegistry.sol/TalentRegistry.json'
import ReferralManagerArtifact from '../../contracts/out/ReferralManager.sol/ReferralManager.json'
import JobEscrowArtifact from '../../contracts/out/JobEscrow.sol/JobEscrow.json'

export const TALENT_REGISTRY_ABI = TalentRegistryArtifact.abi as Abi
export const REFERRAL_MANAGER_ABI = ReferralManagerArtifact.abi as Abi
export const JOB_ESCROW_ABI = JobEscrowArtifact.abi as Abi

// Job status enum (mirrors Solidity)
export enum JobStatus {
  Open = 0,
  Funded = 1,
  Submitted = 2,
  Completed = 3,
  Cancelled = 4,
  Refunded = 5,
  Expired = 6,
}

export enum JobType {
  Fixed = 0,
  Bounty = 1,
  ReferralEligible = 2,
}

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  [JobStatus.Open]: 'Open',
  [JobStatus.Funded]: 'Funded',
  [JobStatus.Submitted]: 'Submitted',
  [JobStatus.Completed]: 'Completed',
  [JobStatus.Cancelled]: 'Cancelled',
  [JobStatus.Refunded]: 'Refunded',
  [JobStatus.Expired]: 'Expired',
}

export const JOB_STATUS_COLORS: Record<JobStatus, string> = {
  // Open = semantic success green (available / accepting applications)
  [JobStatus.Open]: 'bg-green-50 text-green-700 dark:bg-green-950/60 dark:text-green-400',
  // Funded = deeper green (money in escrow)
  [JobStatus.Funded]: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400',
  // Submitted = amber (awaiting review)
  [JobStatus.Submitted]: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400',
  // Completed = neutral (done, historical)
  [JobStatus.Completed]: 'bg-[var(--surface-muted)] text-[var(--muted)]',
  // Cancelled = muted red
  [JobStatus.Cancelled]: 'bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400',
  // Refunded = muted orange
  [JobStatus.Refunded]: 'bg-orange-50 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400',
  // Expired = neutral subtle (no action available)
  [JobStatus.Expired]: 'bg-[var(--surface-muted)] text-[var(--subtle)]',
}

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  [JobType.Fixed]: 'Fixed Price',
  [JobType.Bounty]: 'Bounty',
  [JobType.ReferralEligible]: 'Referral Eligible',
}

export interface OnchainJob {
  id: bigint
  client: `0x${string}`
  talent: `0x${string}`
  title: string
  description: string
  skills: string[]
  budget: bigint
  deadline: bigint
  jobType: JobType
  referralEligible: boolean
  status: JobStatus
  deliverableHash: string
  rating: number
  postedAt: bigint
}

export interface OnchainProfile {
  name: string
  bio: string
  skills: string[]
  portfolioLinks: string[]
  preferredRate: bigint
  location: string
  exists: boolean
  registeredAt: bigint
}

export interface OnchainReputation {
  jobsCompleted: bigint
  ratingSum: bigint
  ratingCount: bigint
  totalUSDCEarned: bigint
}
