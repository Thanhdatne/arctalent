// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test}          from "forge-std/Test.sol";
import {JobEscrow}     from "../JobEscrow.sol";
import {TalentRegistry} from "../TalentRegistry.sol";
import {ReferralManager} from "../ReferralManager.sol";
import {MockERC20}     from "../test-helpers/MockERC20.sol";

/// @dev Stand-alone handler (no shared base) to avoid escrow address confusion.
///      The invariant test deploys everything here, passes a reference to the
///      handler, and Foundry calls its public functions in random order.
contract JobEscrowHandler is Test {
    JobEscrow       public targetEscrow;
    MockERC20       public usdc;

    // Ghost variable: tracks total USDC that should sit in the escrow
    uint256 public ghostEscrowedTotal;

    // Actors
    address internal _client = makeAddr("inv_client");
    address internal _talent = makeAddr("inv_talent");

    // Track the most recently posted job
    uint256 internal _lastJobId      = type(uint256).max;
    bool    internal _lastFunded;
    bool    internal _lastSubmitted;

    constructor(JobEscrow _escrow, MockERC20 _usdc) {
        targetEscrow = _escrow;
        usdc         = _usdc;

        usdc.mint(_client, 100_000_000e6);
        vm.prank(_client);
        usdc.approve(address(targetEscrow), type(uint256).max);
    }

    // ── actions ───────────────────────────────────────────────────────────

    function postJob(uint256 seed) external {
        uint256 budget = bound(seed, 1e6, 10_000e6);
        uint256 jobId  = targetEscrow.nextJobId();

        vm.prank(_client);
        targetEscrow.postJob(
            "Job", "Desc", new string[](0), budget,
            block.timestamp + 1 days, JobEscrow.JobType.Fixed, false
        );
        _lastJobId     = jobId;
        _lastFunded    = false;
        _lastSubmitted = false;
    }

    function fundLastJob() external {
        if (_lastJobId == type(uint256).max) return;
        if (_lastFunded) return;

        JobEscrow.Job memory j = targetEscrow.getJob(_lastJobId);
        if (j.status != JobEscrow.JobStatus.Open) return;

        if (!targetEscrow.hasApplied(_lastJobId, _talent)) {
            vm.prank(_talent);
            targetEscrow.applyToJob(_lastJobId);
        }
        if (j.talent == address(0)) {
            vm.prank(_client);
            targetEscrow.selectTalent(_lastJobId, _talent);
        }
        vm.prank(_client);
        targetEscrow.fundJob(_lastJobId);

        ghostEscrowedTotal += j.budget;
        _lastFunded = true;
    }

    function submitLastJob() external {
        if (_lastJobId == type(uint256).max) return;
        if (!_lastFunded || _lastSubmitted) return;

        JobEscrow.Job memory j = targetEscrow.getJob(_lastJobId);
        if (j.status != JobEscrow.JobStatus.Funded) return;

        vm.prank(_talent);
        targetEscrow.submitDeliverable(_lastJobId, "hash");
        _lastSubmitted = true;
    }

    function confirmLastJob() external {
        if (_lastJobId == type(uint256).max) return;
        if (!_lastSubmitted) return;

        JobEscrow.Job memory j = targetEscrow.getJob(_lastJobId);
        if (j.status != JobEscrow.JobStatus.Submitted) return;

        ghostEscrowedTotal -= j.budget;

        vm.prank(_client);
        targetEscrow.confirmCompletion(_lastJobId, 5);

        _lastFunded    = false;
        _lastSubmitted = false;
        _lastJobId     = type(uint256).max;
    }

    function cancelLastJob() external {
        if (_lastJobId == type(uint256).max) return;

        JobEscrow.Job memory j = targetEscrow.getJob(_lastJobId);

        if (j.status == JobEscrow.JobStatus.Open) {
            vm.prank(_client);
            targetEscrow.cancelJob(_lastJobId);
            _reset();
            return;
        }
        if (j.status == JobEscrow.JobStatus.Funded) {
            ghostEscrowedTotal -= j.budget;
            vm.prank(_client);
            targetEscrow.cancelJob(_lastJobId);
            _reset();
        }
    }

    function expireLastJob() external {
        if (_lastJobId == type(uint256).max) return;
        if (!_lastFunded) return;

        JobEscrow.Job memory j = targetEscrow.getJob(_lastJobId);
        if (j.status != JobEscrow.JobStatus.Funded) return;

        vm.warp(j.deadline + 1);
        ghostEscrowedTotal -= j.budget;
        targetEscrow.claimExpiry(_lastJobId);
        _reset();
    }

    function _reset() internal {
        _lastFunded    = false;
        _lastSubmitted = false;
        _lastJobId     = type(uint256).max;
    }
}

/// @dev Invariant: escrow USDC balance == sum of all Funded + Submitted budgets.
contract JobEscrowInvariantTest is Test {
    JobEscrow        internal escrow;
    MockERC20        internal usdc;
    TalentRegistry   internal registry;
    ReferralManager  internal rm;
    JobEscrowHandler internal handler;

    address internal owner        = makeAddr("owner");
    address internal feeRecipient = makeAddr("feeRecipient");

    function setUp() public {
        usdc     = new MockERC20("Mock USDC", "mUSDC", 6);
        registry = new TalentRegistry(owner);
        rm       = new ReferralManager(owner);

        escrow = new JobEscrow(
            address(usdc),
            address(registry),
            address(rm),
            feeRecipient,
            400,  // 4 % platform
            100,  // 1 % referral
            owner
        );

        vm.prank(owner);
        registry.setEscrowContract(address(escrow));
        vm.prank(owner);
        rm.setEscrowContract(address(escrow));

        handler = new JobEscrowHandler(escrow, usdc);

        targetContract(address(handler));
    }

    /// USDC held in escrow must equal the ghost-tracked escrowed total.
    function invariant_EscrowBalanceMatchesGhost() public view {
        assertEq(
            usdc.balanceOf(address(escrow)),
            handler.ghostEscrowedTotal(),
            "escrow USDC != ghost total"
        );
    }

    /// Escrow balance is always non-negative (sanity).
    function invariant_EscrowBalanceNonNegative() public view {
        assertGe(usdc.balanceOf(address(escrow)), 0);
    }
}
