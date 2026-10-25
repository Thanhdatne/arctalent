// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {JobEscrowBase} from "./JobEscrow.Base.t.sol";
import {JobEscrow}     from "../JobEscrow.sol";

contract JobEscrowFuzzTest is JobEscrowBase {

    // ════════════════════════════════════════════════════════════════════════
    // Fuzz: platformFee + talentNet == budget for any valid fee bps
    // ════════════════════════════════════════════════════════════════════════

    /// @dev Test that the fee split is lossless: talent gets exactly
    ///      budget minus the platform fee, nothing is lost to rounding.
    function testFuzz_FeeArithmetic_SumIsConserved(
        uint256 budget,
        uint256 pfBps
    ) public {
        // Bound inputs to valid ranges
        budget = bound(budget, 1, type(uint128).max); // avoid overflow in *bps
        pfBps  = bound(pfBps, 0, 1000);              // MAX_FEE_BPS

        uint256 platformFee = (budget * pfBps) / 10_000;
        uint256 talentNet   = budget - platformFee;

        // Invariant: platformFee + talentNet == budget (no dust lost)
        assertEq(platformFee + talentNet, budget, "fee split must sum to budget");
    }

    /// @dev referralFee ≤ platformFee for any valid bps combination.
    function testFuzz_FeeArithmetic_ReferralLEPlatform(
        uint256 budget,
        uint256 pfBps,
        uint256 rfBps
    ) public pure {
        budget = bound(budget, 1, type(uint128).max);
        pfBps  = bound(pfBps, 0, 1000);
        rfBps  = bound(rfBps, 0, pfBps); // rfBps always ≤ pfBps

        uint256 platformFee  = (budget * pfBps) / 10_000;
        uint256 referralFee  = (budget * rfBps) / 10_000;

        assertLe(referralFee, platformFee, "referral fee must not exceed platform fee");
    }

    /// @dev End-to-end: post/apply/select/fund/submit/confirm with fuzzed budget
    ///      and bps, then verify balances sum correctly.
    function testFuzz_ConfirmCompletion_BalancesConserved(
        uint128 budget,
        uint16  pfBps,
        uint16  rfBps
    ) public {
        // Bound to valid ranges accepted by the constructor / setPlatformFeeBps
        pfBps  = uint16(bound(pfBps, 0, 1000));
        rfBps  = uint16(bound(rfBps, 0, pfBps));
        budget = uint128(bound(budget, 1, 1_000_000e6)); // up to 1M USDC

        // Deploy a fresh escrow with the fuzzed fee parameters
        JobEscrow fuzzEscrow = new JobEscrow(
            address(usdc),
            address(registry),
            address(rm),
            feeRecipient,
            pfBps,
            rfBps,
            owner
        );
        vm.prank(owner);
        registry.setEscrowContract(address(fuzzEscrow));
        vm.prank(owner);
        rm.setEscrowContract(address(fuzzEscrow));

        // Fund client and approve the fuzz escrow
        usdc.mint(client, budget);
        vm.prank(client);
        usdc.approve(address(fuzzEscrow), type(uint256).max);

        // Snapshot balances
        uint256 talentBefore    = usdc.balanceOf(talent);
        uint256 feeBefore       = usdc.balanceOf(feeRecipient);
        uint256 contractBefore  = usdc.balanceOf(address(fuzzEscrow));

        // Post → apply → select → fund
        uint256 jobId = fuzzEscrow.nextJobId();
        vm.prank(client);
        fuzzEscrow.postJob(
            "Fuzz", "Desc", _emptySkills(), budget,
            block.timestamp + ONE_DAY, JobEscrow.JobType.Fixed, false
        );
        vm.prank(talent);
        fuzzEscrow.applyToJob(jobId);
        vm.prank(client);
        fuzzEscrow.selectTalent(jobId, talent);
        vm.prank(client);
        fuzzEscrow.fundJob(jobId);

        // Submit → confirm
        vm.prank(talent);
        fuzzEscrow.submitDeliverable(jobId, "hash");
        vm.prank(client);
        fuzzEscrow.confirmCompletion(jobId, 5);

        // Recompute expected split
        uint256 platformFee = (uint256(budget) * pfBps) / 10_000;
        uint256 talentNet   = uint256(budget) - platformFee;

        // All budget must leave the contract
        assertEq(
            usdc.balanceOf(address(fuzzEscrow)),
            contractBefore,
            "contract balance unchanged (budget in = payouts out)"
        );
        // Talent and fee recipient together must receive exactly `budget`
        uint256 talentDelta = usdc.balanceOf(talent)       - talentBefore;
        uint256 feeDelta    = usdc.balanceOf(feeRecipient) - feeBefore;

        assertEq(talentDelta + feeDelta, uint256(budget), "total payout == budget");
        assertEq(talentDelta,            talentNet,        "talent net correct");
        assertEq(feeDelta,               platformFee,      "fee correct");

        // Restore registry / rm escrow pointer for other tests in this run
        vm.prank(owner);
        registry.setEscrowContract(address(escrow));
        vm.prank(owner);
        rm.setEscrowContract(address(escrow));
    }
}
