// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ReferralManager} from "../ReferralManager.sol";
import {MockERC20} from "../test-helpers/MockERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract ReferralManagerTest is Test {
    ReferralManager internal rm;
    MockERC20       internal usdc;

    address internal owner   = makeAddr("owner");
    address internal alice   = makeAddr("alice");   // referrer
    address internal bob     = makeAddr("bob");     // talent
    address internal carol   = makeAddr("carol");   // another user
    address internal escrow  = makeAddr("escrow");
    address internal stranger = makeAddr("stranger");

    // ── setUp ───────────────────────────────────────────────────────────────

    function setUp() public {
        rm   = new ReferralManager(owner);
        usdc = new MockERC20("Mock USDC", "mUSDC", 6);

        vm.prank(owner);
        rm.setEscrowContract(escrow);
    }

    // ════════════════════════════════════════════════════════════════════════
    // Deployment & initialization
    // ════════════════════════════════════════════════════════════════════════

    function test_Deploy_OwnerSet() public view {
        assertEq(rm.owner(), owner);
    }

    function test_Deploy_EscrowSet() public view {
        assertEq(rm.escrowContract(), escrow);
    }

    function test_SetEscrow_ZeroAddress_Reverts() public {
        vm.prank(owner);
        vm.expectRevert(ReferralManager.ZeroAddress.selector);
        rm.setEscrowContract(address(0));
    }

    function test_SetEscrow_NonOwner_Reverts() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        rm.setEscrowContract(escrow);
    }

    // ════════════════════════════════════════════════════════════════════════
    // getCode / myCode
    // ════════════════════════════════════════════════════════════════════════

    function test_GetCode_IsDeterministic() public view {
        bytes8 c1 = rm.getCode(alice);
        bytes8 c2 = rm.getCode(alice);
        assertEq(c1, c2);
    }

    function test_GetCode_DifferentAddresses() public view {
        assertNotEq(rm.getCode(alice), rm.getCode(bob));
    }

    function test_MyCode_MatchesGetCode() public {
        vm.prank(alice);
        bytes8 mine = rm.myCode();
        assertEq(mine, rm.getCode(alice));
    }

    // ════════════════════════════════════════════════════════════════════════
    // activateReferralCode
    // ════════════════════════════════════════════════════════════════════════

    function test_ActivateReferralCode_StoresAddress() public {
        vm.prank(alice);
        rm.activateReferralCode();

        bytes8 code = rm.getCode(alice);
        assertEq(rm.resolveCode(code), alice);
    }

    function test_ActivateReferralCode_Idempotent() public {
        vm.prank(alice);
        rm.activateReferralCode();
        vm.prank(alice);
        rm.activateReferralCode(); // must not revert

        assertEq(rm.resolveCode(rm.getCode(alice)), alice);
    }

    function test_ResolveCode_UnactivatedReturnsZero() public view {
        bytes8 code = rm.getCode(alice);
        assertEq(rm.resolveCode(code), address(0));
    }

    // ════════════════════════════════════════════════════════════════════════
    // registerReferral — happy path
    // ════════════════════════════════════════════════════════════════════════

    function test_RegisterReferral_StoresReferrer() public {
        vm.prank(alice);
        rm.activateReferralCode();

        bytes8 aliceCode = rm.getCode(alice);

        vm.prank(bob);
        rm.registerReferral(aliceCode);

        assertEq(rm.getReferrer(bob), alice);
    }

    function test_RegisterReferral_EmitsEvent() public {
        vm.prank(alice);
        rm.activateReferralCode();
        bytes8 aliceCode = rm.getCode(alice);

        vm.prank(bob);
        vm.expectEmit(true, true, false, false, address(rm));
        emit ReferralManager.ReferralRegistered(bob, alice);
        rm.registerReferral(aliceCode);
    }

    // ════════════════════════════════════════════════════════════════════════
    // registerReferral — revert paths
    // ════════════════════════════════════════════════════════════════════════

    function test_RegisterReferral_AlreadyRegistered_Reverts() public {
        vm.prank(alice);
        rm.activateReferralCode();
        bytes8 aliceCode = rm.getCode(alice);

        vm.prank(bob);
        rm.registerReferral(aliceCode);

        // Second registration must revert
        vm.prank(bob);
        vm.expectRevert(ReferralManager.AlreadyRegistered.selector);
        rm.registerReferral(aliceCode);
    }

    function test_RegisterReferral_InvalidReferrer_Reverts() public {
        // alice has NOT activated her code
        bytes8 aliceCode = rm.getCode(alice);

        vm.prank(bob);
        vm.expectRevert(ReferralManager.InvalidReferrer.selector);
        rm.registerReferral(aliceCode);
    }

    function test_RegisterReferral_SelfReferral_Reverts() public {
        vm.prank(alice);
        rm.activateReferralCode();
        bytes8 aliceCode = rm.getCode(alice);

        vm.prank(alice);
        vm.expectRevert(ReferralManager.SelfReferral.selector);
        rm.registerReferral(aliceCode);
    }

    // ════════════════════════════════════════════════════════════════════════
    // getReferrer
    // ════════════════════════════════════════════════════════════════════════

    function test_GetReferrer_NoReferrer_ReturnsZero() public view {
        assertEq(rm.getReferrer(bob), address(0));
    }

    // ════════════════════════════════════════════════════════════════════════
    // distributeReferral — access control
    // ════════════════════════════════════════════════════════════════════════

    function test_DistributeReferral_NonEscrow_Reverts() public {
        vm.prank(stranger);
        vm.expectRevert(ReferralManager.NotEscrow.selector);
        rm.distributeReferral(bob, address(usdc), 100e6);
    }

    function test_DistributeReferral_OwnerIsNotEscrow_Reverts() public {
        vm.prank(owner);
        vm.expectRevert(ReferralManager.NotEscrow.selector);
        rm.distributeReferral(bob, address(usdc), 100e6);
    }

    // ════════════════════════════════════════════════════════════════════════
    // distributeReferral — no-op when no referrer
    // ════════════════════════════════════════════════════════════════════════

    function test_DistributeReferral_NoReferrer_IsNoOp() public {
        // bob has no referrer — USDC balance of escrow caller must not change
        uint256 seedAmount = 1000e6;
        usdc.mint(escrow, seedAmount);

        // Transfer balance to rm so it has tokens to send
        vm.prank(escrow);
        usdc.transfer(address(rm), seedAmount);

        uint256 before = usdc.balanceOf(address(rm));

        vm.prank(escrow);
        rm.distributeReferral(bob, address(usdc), 10e6); // bob has no referrer

        assertEq(usdc.balanceOf(address(rm)), before, "no-op: balance unchanged");
    }

    // ════════════════════════════════════════════════════════════════════════
    // distributeReferral — transfers correct amount to referrer
    // ════════════════════════════════════════════════════════════════════════

    function test_DistributeReferral_TransfersAmountToReferrer() public {
        // Register bob with alice as referrer
        vm.prank(alice);
        rm.activateReferralCode();
        bytes8 aliceCode = rm.getCode(alice);
        vm.prank(bob);
        rm.registerReferral(aliceCode);

        uint256 payAmount = 50e6;
        usdc.mint(address(rm), payAmount);

        uint256 aliceBefore = usdc.balanceOf(alice);

        vm.prank(escrow);
        rm.distributeReferral(bob, address(usdc), payAmount);

        assertEq(usdc.balanceOf(alice), aliceBefore + payAmount);
        assertEq(usdc.balanceOf(address(rm)), 0);
    }

    function test_DistributeReferral_EmitsReferralPaid() public {
        vm.prank(alice);
        rm.activateReferralCode();
        bytes8 aliceCode = rm.getCode(alice);
        vm.prank(bob);
        rm.registerReferral(aliceCode);

        uint256 payAmount = 25e6;
        usdc.mint(address(rm), payAmount);

        vm.prank(escrow);
        vm.expectEmit(true, true, false, true, address(rm));
        emit ReferralManager.ReferralPaid(bob, alice, payAmount);
        rm.distributeReferral(bob, address(usdc), payAmount);
    }
}
