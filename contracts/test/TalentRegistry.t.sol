// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {TalentRegistry} from "../TalentRegistry.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract TalentRegistryTest is Test {
    TalentRegistry internal registry;

    address internal owner   = makeAddr("owner");
    address internal alice   = makeAddr("alice");
    address internal bob     = makeAddr("bob");
    address internal escrow  = makeAddr("escrow");
    address internal stranger = makeAddr("stranger");

    // ── helpers ─────────────────────────────────────────────────────────────

    function _skills(uint256 n) internal pure returns (string[] memory arr) {
        arr = new string[](n);
        for (uint256 i = 0; i < n; i++) arr[i] = "solidity";
    }

    function _links(uint256 n) internal pure returns (string[] memory arr) {
        arr = new string[](n);
        for (uint256 i = 0; i < n; i++) arr[i] = "https://example.com";
    }

    function _register(address who) internal {
        vm.prank(who);
        registry.registerProfile("Alice Dev", "bio", _skills(2), _links(1), 100e6, "Remote");
    }

    // ── setUp ───────────────────────────────────────────────────────────────

    function setUp() public {
        registry = new TalentRegistry(owner);
        vm.prank(owner);
        registry.setEscrowContract(escrow);
    }

    // ════════════════════════════════════════════════════════════════════════
    // Deployment & initialization
    // ════════════════════════════════════════════════════════════════════════

    function test_Deploy_OwnerSet() public view {
        assertEq(registry.owner(), owner);
    }

    function test_Deploy_EscrowSet() public view {
        assertEq(registry.escrowContract(), escrow);
    }

    function test_SetEscrow_ZeroAddressReverts() public {
        vm.prank(owner);
        vm.expectRevert(TalentRegistry.ZeroAddress.selector);
        registry.setEscrowContract(address(0));
    }

    function test_SetEscrow_NonOwnerReverts() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        registry.setEscrowContract(escrow);
    }

    // ════════════════════════════════════════════════════════════════════════
    // registerProfile — happy path (new profile)
    // ════════════════════════════════════════════════════════════════════════

    function test_RegisterProfile_StoresFields() public {
        string[] memory skills = _skills(3);
        string[] memory links  = _links(2);

        vm.prank(alice);
        registry.registerProfile("Alice Dev", "A Solidity dev", skills, links, 150e6, "Berlin");

        TalentRegistry.Profile memory p = registry.getProfile(alice);
        assertEq(p.name, "Alice Dev");
        assertEq(p.bio, "A Solidity dev");
        assertEq(p.preferredRate, 150e6);
        assertEq(p.location, "Berlin");
        assertTrue(p.exists);
        assertEq(p.skills.length, 3);
        assertEq(p.portfolioLinks.length, 2);
    }

    function test_RegisterProfile_EmitsProfileRegistered() public {
        vm.prank(alice);
        vm.expectEmit(true, false, false, false, address(registry));
        emit TalentRegistry.ProfileRegistered(alice);
        registry.registerProfile("Alice", "bio", _skills(1), _links(0), 0, "");
    }

    function test_RegisterProfile_SetsRegisteredAt() public {
        vm.warp(1_000_000);
        _register(alice);
        TalentRegistry.Profile memory p = registry.getProfile(alice);
        assertEq(p.registeredAt, 1_000_000);
    }

    // ════════════════════════════════════════════════════════════════════════
    // registerProfile — update (existing profile)
    // ════════════════════════════════════════════════════════════════════════

    function test_UpdateProfile_PreservesRegisteredAt() public {
        vm.warp(1_000_000);
        _register(alice);

        vm.warp(2_000_000);
        vm.prank(alice);
        registry.registerProfile("Alice V2", "new bio", _skills(1), _links(0), 200e6, "NYC");

        TalentRegistry.Profile memory p = registry.getProfile(alice);
        assertEq(p.registeredAt, 1_000_000, "registeredAt must not change on update");
        assertEq(p.name, "Alice V2");
    }

    function test_UpdateProfile_EmitsProfileUpdated() public {
        _register(alice);

        vm.prank(alice);
        vm.expectEmit(true, false, false, false, address(registry));
        emit TalentRegistry.ProfileUpdated(alice);
        registry.registerProfile("Alice V2", "bio2", _skills(1), _links(0), 0, "");
    }

    function test_UpdateProfile_ReplacesSkillsAndLinks() public {
        _register(alice); // 2 skills, 1 link

        vm.prank(alice);
        registry.registerProfile("Alice", "bio", _skills(5), _links(3), 100e6, "");

        TalentRegistry.Profile memory p = registry.getProfile(alice);
        assertEq(p.skills.length, 5);
        assertEq(p.portfolioLinks.length, 3);
    }

    // ════════════════════════════════════════════════════════════════════════
    // registerProfile — revert paths
    // ════════════════════════════════════════════════════════════════════════

    function test_RegisterProfile_EmptyName_Reverts() public {
        vm.prank(alice);
        vm.expectRevert(TalentRegistry.EmptyName.selector);
        registry.registerProfile("", "bio", _skills(0), _links(0), 0, "");
    }

    function test_RegisterProfile_TooManySkills_Reverts() public {
        vm.prank(alice);
        vm.expectRevert(TalentRegistry.TooManySkills.selector);
        registry.registerProfile("Alice", "bio", _skills(21), _links(0), 0, "");
    }

    function test_RegisterProfile_ExactlyMaxSkills_Passes() public {
        vm.prank(alice);
        registry.registerProfile("Alice", "bio", _skills(20), _links(0), 0, "");
        assertEq(registry.getProfile(alice).skills.length, 20);
    }

    function test_RegisterProfile_TooManyPortfolioLinks_Reverts() public {
        vm.prank(alice);
        vm.expectRevert(TalentRegistry.TooManyPortfolioLinks.selector);
        registry.registerProfile("Alice", "bio", _skills(0), _links(11), 0, "");
    }

    function test_RegisterProfile_ExactlyMaxLinks_Passes() public {
        vm.prank(alice);
        registry.registerProfile("Alice", "bio", _skills(0), _links(10), 0, "");
        assertEq(registry.getProfile(alice).portfolioLinks.length, 10);
    }

    // ════════════════════════════════════════════════════════════════════════
    // updateReputation — access control
    // ════════════════════════════════════════════════════════════════════════

    function test_UpdateReputation_OnlyEscrow_Reverts() public {
        vm.prank(stranger);
        vm.expectRevert(TalentRegistry.NotEscrow.selector);
        registry.updateReputation(alice, 1, 4, 1, 100e6);
    }

    function test_UpdateReputation_OwnerIsNotEscrow_Reverts() public {
        vm.prank(owner);
        vm.expectRevert(TalentRegistry.NotEscrow.selector);
        registry.updateReputation(alice, 1, 4, 1, 100e6);
    }

    function test_UpdateReputation_EscrowSucceeds() public {
        vm.prank(escrow);
        registry.updateReputation(alice, 5, 20, 4, 500e6);

        (uint256 jobs, uint256 ratingSum, uint256 ratingCount, uint256 earned) = registry.reputations(alice);
        assertEq(jobs,       5);
        assertEq(ratingSum,  20);
        assertEq(ratingCount, 4);
        assertEq(earned,     500e6);
    }

    function test_UpdateReputation_EmitsEvent() public {
        // score = 2*10 + (8/2)*20 + (200e6/100) = 20 + 80 + 2_000_000 = 2_000_100
        uint256 expectedScore = (2 * 10) + ((8 / 2) * 20) + (200e6 / 100);

        vm.prank(escrow);
        vm.expectEmit(true, false, false, true, address(registry));
        emit TalentRegistry.ReputationUpdated(alice, expectedScore);
        registry.updateReputation(alice, 2, 8, 2, 200e6);
    }

    // ════════════════════════════════════════════════════════════════════════
    // reputationScore formula
    // ════════════════════════════════════════════════════════════════════════

    function test_ReputationScore_Formula_ZeroData() public view {
        assertEq(registry.reputationScore(alice), 0);
    }

    function test_ReputationScore_Formula_NoRatings() public {
        // ratingCount == 0 → avgRating = 0
        vm.prank(escrow);
        registry.updateReputation(alice, 3, 0, 0, 300e6);
        // score = 3*10 + 0*20 + 300e6/100 = 30 + 0 + 3_000_000
        assertEq(registry.reputationScore(alice), 30 + 3_000_000);
    }

    function test_ReputationScore_Formula_WithRatings() public {
        vm.prank(escrow);
        registry.updateReputation(alice, 5, 15, 3, 1000e6);
        // avgRating = 15/3 = 5
        // score = 5*10 + 5*20 + 1000e6/100 = 50 + 100 + 10_000_000
        assertEq(registry.reputationScore(alice), 50 + 100 + 10_000_000);
    }

    function test_ReputationScore_Formula_IntegerDivisionRounding() public {
        // ratingSum=7, ratingCount=2 → avgRating=3 (truncated)
        vm.prank(escrow);
        registry.updateReputation(alice, 1, 7, 2, 0);
        // score = 1*10 + 3*20 + 0 = 10 + 60 = 70
        assertEq(registry.reputationScore(alice), 70);
    }

    // ════════════════════════════════════════════════════════════════════════
    // Fuzz: reputationScore formula
    // ════════════════════════════════════════════════════════════════════════

    function testFuzz_ReputationScore_Formula(
        uint64 jobsCompleted,
        uint64 ratingSum,
        uint64 ratingCount,
        uint128 totalUSDCEarned
    ) public {
        // Avoid ratingSum overflow when divided — keep ratingCount ≥ 1 when ratingSum > 0
        uint256 safeCount = ratingCount;

        vm.prank(escrow);
        registry.updateReputation(alice, jobsCompleted, ratingSum, safeCount, totalUSDCEarned);

        uint256 avgRating = safeCount > 0 ? uint256(ratingSum) / safeCount : 0;
        uint256 expected  = uint256(jobsCompleted) * 10
                          + avgRating * 20
                          + uint256(totalUSDCEarned) / 100;

        assertEq(registry.reputationScore(alice), expected);
    }
}
