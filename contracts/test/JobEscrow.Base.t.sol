// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {JobEscrow} from "../JobEscrow.sol";
import {TalentRegistry} from "../TalentRegistry.sol";
import {ReferralManager} from "../ReferralManager.sol";
import {MockERC20} from "../test-helpers/MockERC20.sol";

/// @dev Shared fixtures for all JobEscrow test suites.
abstract contract JobEscrowBase is Test {
    // ── actors ───────────────────────────────────────────────────────────────
    address internal owner        = makeAddr("owner");
    address internal client       = makeAddr("client");
    address internal talent       = makeAddr("talent");
    address internal referrer     = makeAddr("referrer");
    address internal feeRecipient = makeAddr("feeRecipient");
    address internal stranger     = makeAddr("stranger");

    // ── contracts ────────────────────────────────────────────────────────────
    MockERC20       internal usdc;
    TalentRegistry  internal registry;
    ReferralManager internal rm;
    JobEscrow       internal escrow;

    // ── constants ────────────────────────────────────────────────────────────
    uint256 internal constant PLATFORM_BPS  = 400;   // 4 %
    uint256 internal constant REFERRAL_BPS  = 100;   // 1 %
    uint256 internal constant JOB_BUDGET    = 1000e6; // 1 000 USDC
    uint256 internal constant ONE_DAY       = 1 days;
    uint256 internal constant START_TIME    = 1_700_000_000;

    // ── setUp ─────────────────────────────────────────────────────────────────

    function setUp() public virtual {
        vm.warp(START_TIME);

        usdc     = new MockERC20("Mock USDC", "mUSDC", 6);
        registry = new TalentRegistry(owner);
        rm       = new ReferralManager(owner);

        escrow = new JobEscrow(
            address(usdc),
            address(registry),
            address(rm),
            feeRecipient,
            PLATFORM_BPS,
            REFERRAL_BPS,
            owner
        );

        // Wire up escrow address in registry + referral manager
        vm.prank(owner);
        registry.setEscrowContract(address(escrow));
        vm.prank(owner);
        rm.setEscrowContract(address(escrow));

        // Fund client
        usdc.mint(client, 10_000e6);
        vm.prank(client);
        usdc.approve(address(escrow), type(uint256).max);
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    function _emptySkills() internal pure returns (string[] memory s) {
        s = new string[](0);
    }

    /// Post a job and return its jobId (0-based nextJobId before call).
    function _postJob(
        address _client,
        uint256 budget,
        uint256 deadline,
        bool referralEligible
    ) internal returns (uint256 jobId) {
        jobId = escrow.nextJobId();
        vm.prank(_client);
        escrow.postJob(
            "Test Job",
            "Description",
            _emptySkills(),
            budget,
            deadline,
            JobEscrow.JobType.Fixed,
            referralEligible
        );
    }

    /// Full flow up to Funded state.
    function _fundedJob(bool withReferral) internal returns (uint256 jobId) {
        uint256 deadline = block.timestamp + ONE_DAY;
        jobId = _postJob(client, JOB_BUDGET, deadline, withReferral);

        vm.prank(talent);
        escrow.applyToJob(jobId);

        vm.prank(client);
        escrow.selectTalent(jobId, talent);

        vm.prank(client);
        escrow.fundJob(jobId);
    }

    /// Full flow up to Submitted state.
    function _submittedJob(bool withReferral) internal returns (uint256 jobId) {
        jobId = _fundedJob(withReferral);

        vm.prank(talent);
        escrow.submitDeliverable(jobId, "ipfs://QmHash");
    }

    /// Set up referrer → talent relationship.
    function _activateReferral() internal {
        vm.prank(referrer);
        rm.activateReferralCode();
        bytes8 code = rm.getCode(referrer);
        vm.prank(talent);
        rm.registerReferral(code);
    }
}
