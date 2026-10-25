// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {JobEscrowBase} from "./JobEscrow.Base.t.sol";
import {JobEscrow}     from "../JobEscrow.sol";
import {IERC20}        from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract JobEscrowHappyTest is JobEscrowBase {

    // ════════════════════════════════════════════════════════════════════════
    // Deploy / constructor
    // ════════════════════════════════════════════════════════════════════════

    function test_Deploy_FieldsSet() public view {
        assertEq(escrow.usdcToken(),      address(usdc));
        assertEq(escrow.talentRegistry(), address(registry));
        assertEq(escrow.referralManager(), address(rm));
        assertEq(escrow.feeRecipient(),   feeRecipient);
        assertEq(escrow.platformFeeBps(), PLATFORM_BPS);
        assertEq(escrow.referralFeeBps(), REFERRAL_BPS);
        assertEq(escrow.owner(),          owner);
    }

    // ════════════════════════════════════════════════════════════════════════
    // postJob
    // ════════════════════════════════════════════════════════════════════════

    function test_PostJob_IncreasesNextJobId() public {
        assertEq(escrow.nextJobId(), 0);
        _postJob(client, JOB_BUDGET, block.timestamp + ONE_DAY, false);
        assertEq(escrow.nextJobId(), 1);
    }

    function test_PostJob_StoresJobFields() public {
        uint256 deadline = block.timestamp + ONE_DAY;
        uint256 jobId    = _postJob(client, JOB_BUDGET, deadline, true);

        JobEscrow.Job memory j = escrow.getJob(jobId);
        assertEq(j.id,              jobId);
        assertEq(j.client,          client);
        assertEq(j.budget,          JOB_BUDGET);
        assertEq(j.deadline,        deadline);
        assertTrue(j.referralEligible);
        assertEq(uint8(j.status),   uint8(JobEscrow.JobStatus.Open));
        assertEq(j.jobPlatformFeeBps, PLATFORM_BPS);
        assertEq(j.jobReferralFeeBps, REFERRAL_BPS);
    }

    function test_PostJob_EmitsJobPosted() public {
        uint256 jobId = escrow.nextJobId();
        vm.prank(client);
        vm.expectEmit(true, true, false, true, address(escrow));
        emit JobEscrow.JobPosted(jobId, client, JOB_BUDGET);
        escrow.postJob(
            "T", "D", _emptySkills(), JOB_BUDGET,
            block.timestamp + ONE_DAY, JobEscrow.JobType.Fixed, false
        );
    }

    function test_PostJob_SnapshotsFeeBps() public {
        uint256 deadline = block.timestamp + ONE_DAY;
        uint256 jobId    = _postJob(client, JOB_BUDGET, deadline, false);

        // Change global fee AFTER posting
        vm.prank(owner);
        escrow.setPlatformFeeBps(200);

        // Job must still carry the old fee
        JobEscrow.Job memory j = escrow.getJob(jobId);
        assertEq(j.jobPlatformFeeBps, PLATFORM_BPS);
    }

    // ════════════════════════════════════════════════════════════════════════
    // applyToJob
    // ════════════════════════════════════════════════════════════════════════

    function test_ApplyToJob_SetsHasApplied() public {
        uint256 jobId = _postJob(client, JOB_BUDGET, block.timestamp + ONE_DAY, false);
        vm.prank(talent);
        escrow.applyToJob(jobId);

        assertTrue(escrow.hasApplied(jobId, talent));
    }

    function test_ApplyToJob_AddsToApplicants() public {
        uint256 jobId = _postJob(client, JOB_BUDGET, block.timestamp + ONE_DAY, false);
        vm.prank(talent);
        escrow.applyToJob(jobId);

        address[] memory apps = escrow.getApplicants(jobId);
        assertEq(apps.length, 1);
        assertEq(apps[0], talent);
    }

    function test_ApplyToJob_EmitsJobApplication() public {
        uint256 jobId = _postJob(client, JOB_BUDGET, block.timestamp + ONE_DAY, false);

        vm.prank(talent);
        vm.expectEmit(true, true, false, false, address(escrow));
        emit JobEscrow.JobApplication(jobId, talent);
        escrow.applyToJob(jobId);
    }

    // ════════════════════════════════════════════════════════════════════════
    // selectTalent
    // ════════════════════════════════════════════════════════════════════════

    function test_SelectTalent_SetsTalent() public {
        uint256 jobId = _postJob(client, JOB_BUDGET, block.timestamp + ONE_DAY, false);
        vm.prank(talent);
        escrow.applyToJob(jobId);
        vm.prank(client);
        escrow.selectTalent(jobId, talent);

        JobEscrow.Job memory j = escrow.getJob(jobId);
        assertEq(j.talent, talent);
    }

    function test_SelectTalent_EmitsTalentSelected() public {
        uint256 jobId = _postJob(client, JOB_BUDGET, block.timestamp + ONE_DAY, false);
        vm.prank(talent);
        escrow.applyToJob(jobId);

        vm.prank(client);
        vm.expectEmit(true, true, false, false, address(escrow));
        emit JobEscrow.TalentSelected(jobId, talent);
        escrow.selectTalent(jobId, talent);
    }

    // ════════════════════════════════════════════════════════════════════════
    // fundJob
    // ════════════════════════════════════════════════════════════════════════

    function test_FundJob_TransfersTokensAndSetsStatus() public {
        uint256 jobId = _postJob(client, JOB_BUDGET, block.timestamp + ONE_DAY, false);
        vm.prank(talent);
        escrow.applyToJob(jobId);
        vm.prank(client);
        escrow.selectTalent(jobId, talent);

        uint256 clientBefore  = usdc.balanceOf(client);
        uint256 escrowBefore  = usdc.balanceOf(address(escrow));

        vm.prank(client);
        escrow.fundJob(jobId);

        assertEq(usdc.balanceOf(client),         clientBefore  - JOB_BUDGET);
        assertEq(usdc.balanceOf(address(escrow)), escrowBefore + JOB_BUDGET);
        assertEq(uint8(escrow.getJob(jobId).status), uint8(JobEscrow.JobStatus.Funded));
    }

    function test_FundJob_EmitsJobFunded() public {
        uint256 jobId = _postJob(client, JOB_BUDGET, block.timestamp + ONE_DAY, false);
        vm.prank(talent);
        escrow.applyToJob(jobId);
        vm.prank(client);
        escrow.selectTalent(jobId, talent);

        vm.prank(client);
        vm.expectEmit(true, false, false, true, address(escrow));
        emit JobEscrow.JobFunded(jobId, JOB_BUDGET);
        escrow.fundJob(jobId);
    }

    // ════════════════════════════════════════════════════════════════════════
    // submitDeliverable
    // ════════════════════════════════════════════════════════════════════════

    function test_SubmitDeliverable_SetsHashAndStatus() public {
        uint256 jobId = _fundedJob(false);
        vm.prank(talent);
        escrow.submitDeliverable(jobId, "ipfs://QmABC");

        JobEscrow.Job memory j = escrow.getJob(jobId);
        assertEq(j.deliverableHash, "ipfs://QmABC");
        assertEq(uint8(j.status), uint8(JobEscrow.JobStatus.Submitted));
    }

    function test_SubmitDeliverable_EmitsEvent() public {
        uint256 jobId = _fundedJob(false);

        vm.prank(talent);
        vm.expectEmit(true, false, false, true, address(escrow));
        emit JobEscrow.DeliverableSubmitted(jobId, "ipfs://QmXYZ");
        escrow.submitDeliverable(jobId, "ipfs://QmXYZ");
    }

    // ════════════════════════════════════════════════════════════════════════
    // confirmCompletion — no referral (talent 96 %, fee 4 %)
    // ════════════════════════════════════════════════════════════════════════

    function test_ConfirmCompletion_NoReferral_Balances() public {
        uint256 jobId = _submittedJob(false); // referralEligible = false

        uint256 talentBefore    = usdc.balanceOf(talent);
        uint256 feeBefore       = usdc.balanceOf(feeRecipient);
        uint256 escrowBefore    = usdc.balanceOf(address(escrow));

        // platformFee = 1000e6 * 400 / 10000 = 40e6
        // talentNet   = 1000e6 - 40e6 = 960e6
        uint256 platformFee = (JOB_BUDGET * PLATFORM_BPS) / 10_000;
        uint256 talentNet   = JOB_BUDGET - platformFee;

        vm.prank(client);
        escrow.confirmCompletion(jobId, 5);

        assertEq(usdc.balanceOf(talent),          talentBefore + talentNet,  "talent net");
        assertEq(usdc.balanceOf(feeRecipient),    feeBefore    + platformFee, "fee recipient");
        assertEq(usdc.balanceOf(address(escrow)), escrowBefore - JOB_BUDGET,  "escrow drained");
    }

    function test_ConfirmCompletion_NoReferral_JobStatus() public {
        uint256 jobId = _submittedJob(false);
        vm.prank(client);
        escrow.confirmCompletion(jobId, 3);
        assertEq(uint8(escrow.getJob(jobId).status), uint8(JobEscrow.JobStatus.Completed));
    }

    function test_ConfirmCompletion_NoReferral_RatingStored() public {
        uint256 jobId = _submittedJob(false);
        vm.prank(client);
        escrow.confirmCompletion(jobId, 4);
        assertEq(escrow.getJob(jobId).rating, 4);
    }

    function test_ConfirmCompletion_NoReferral_EmitsJobCompleted() public {
        uint256 jobId = _submittedJob(false);
        uint256 talentNet = JOB_BUDGET - (JOB_BUDGET * PLATFORM_BPS) / 10_000;

        vm.prank(client);
        vm.expectEmit(true, true, false, true, address(escrow));
        emit JobEscrow.JobCompleted(jobId, talent, talentNet, 5);
        escrow.confirmCompletion(jobId, 5);
    }

    // ════════════════════════════════════════════════════════════════════════
    // confirmCompletion — with referral
    //
    // The escrow transfers the referral amount directly to the referrer
    // (looked up via IReferralManager.getReferrer) without routing USDC
    // through the ReferralManager contract itself.
    // ════════════════════════════════════════════════════════════════════════

    function test_ConfirmCompletion_WithReferral_Balances() public {
        _activateReferral(); // sets talent → referrer

        uint256 jobId = _submittedJob(true); // referralEligible = true

        uint256 talentBefore   = usdc.balanceOf(talent);
        uint256 feeBefore      = usdc.balanceOf(feeRecipient);
        uint256 referrerBefore = usdc.balanceOf(referrer);

        // platformFee    = 1000e6 * 400 / 10000 = 40e6
        // referralAmount = 1000e6 * 100 / 10000 = 10e6
        // feeToRecipient = 40e6 - 10e6 = 30e6
        // talentNet      = 1000e6 - 40e6 = 960e6
        uint256 platformFee    = (JOB_BUDGET * PLATFORM_BPS) / 10_000; // 40e6
        uint256 referralAmount = (JOB_BUDGET * REFERRAL_BPS) / 10_000; // 10e6
        uint256 talentNet      = JOB_BUDGET - platformFee;              // 960e6
        uint256 feeToRecipient = platformFee - referralAmount;          // 30e6

        vm.prank(client);
        vm.expectEmit(true, true, true, true, address(escrow));
        emit JobEscrow.ReferralPaid(jobId, talent, referrer, referralAmount);
        escrow.confirmCompletion(jobId, 5);

        assertEq(usdc.balanceOf(talent),       talentBefore   + talentNet,      "talent net");
        assertEq(usdc.balanceOf(feeRecipient), feeBefore      + feeToRecipient, "fee recipient");
        assertEq(usdc.balanceOf(referrer),     referrerBefore + referralAmount,  "referrer gets 1%");
    }

    // ════════════════════════════════════════════════════════════════════════
    // claimExpiry
    // ════════════════════════════════════════════════════════════════════════

    function test_ClaimExpiry_AfterDeadline_RefundsClient() public {
        uint256 jobId    = _fundedJob(false);
        uint256 deadline = escrow.getJob(jobId).deadline;

        uint256 clientBefore = usdc.balanceOf(client);

        vm.warp(deadline + 1);
        escrow.claimExpiry(jobId);

        assertEq(usdc.balanceOf(client), clientBefore + JOB_BUDGET);
        assertEq(uint8(escrow.getJob(jobId).status), uint8(JobEscrow.JobStatus.Expired));
    }

    function test_ClaimExpiry_EmitsJobExpired() public {
        uint256 jobId    = _fundedJob(false);
        uint256 deadline = escrow.getJob(jobId).deadline;

        vm.warp(deadline + 1);
        vm.expectEmit(true, false, false, true, address(escrow));
        emit JobEscrow.JobExpired(jobId, JOB_BUDGET);
        escrow.claimExpiry(jobId);
    }

    function test_ClaimExpiry_BeforeDeadline_Reverts() public {
        uint256 jobId    = _fundedJob(false);
        uint256 deadline = escrow.getJob(jobId).deadline;

        vm.warp(deadline); // at deadline (not strictly after)
        vm.expectRevert(JobEscrow.JobNotExpired.selector);
        escrow.claimExpiry(jobId);
    }

    function test_ClaimExpiry_WhenOpen_Reverts() public {
        uint256 jobId = _postJob(client, JOB_BUDGET, block.timestamp + ONE_DAY, false);
        vm.warp(block.timestamp + 2 * ONE_DAY);
        vm.expectRevert(
            abi.encodeWithSelector(JobEscrow.InvalidJobStatus.selector, JobEscrow.JobStatus.Open)
        );
        escrow.claimExpiry(jobId);
    }

    // ════════════════════════════════════════════════════════════════════════
    // cancelJob
    // ════════════════════════════════════════════════════════════════════════

    function test_CancelJob_FromOpen_NoRefund() public {
        uint256 jobId = _postJob(client, JOB_BUDGET, block.timestamp + ONE_DAY, false);
        uint256 clientBal = usdc.balanceOf(client);

        vm.prank(client);
        escrow.cancelJob(jobId);

        assertEq(uint8(escrow.getJob(jobId).status), uint8(JobEscrow.JobStatus.Cancelled));
        assertEq(usdc.balanceOf(client), clientBal, "no refund from Open");
    }

    function test_CancelJob_FromOpen_EmitsJobCancelled() public {
        uint256 jobId = _postJob(client, JOB_BUDGET, block.timestamp + ONE_DAY, false);

        vm.prank(client);
        vm.expectEmit(true, false, false, true, address(escrow));
        emit JobEscrow.JobCancelled(jobId, 0);
        escrow.cancelJob(jobId);
    }

    function test_CancelJob_FromFunded_FullRefund() public {
        uint256 jobId = _fundedJob(false);
        uint256 clientBefore = usdc.balanceOf(client);

        vm.prank(client);
        escrow.cancelJob(jobId);

        assertEq(usdc.balanceOf(client), clientBefore + JOB_BUDGET, "full refund");
        assertEq(uint8(escrow.getJob(jobId).status), uint8(JobEscrow.JobStatus.Refunded));
    }

    function test_CancelJob_FromFunded_EmitsJobCancelled() public {
        uint256 jobId = _fundedJob(false);

        vm.prank(client);
        vm.expectEmit(true, false, false, true, address(escrow));
        emit JobEscrow.JobCancelled(jobId, JOB_BUDGET);
        escrow.cancelJob(jobId);
    }

    function test_CancelJob_FromSubmitted_Reverts() public {
        uint256 jobId = _submittedJob(false);

        vm.prank(client);
        vm.expectRevert(
            abi.encodeWithSelector(JobEscrow.InvalidJobStatus.selector, JobEscrow.JobStatus.Submitted)
        );
        escrow.cancelJob(jobId);
    }

    // ════════════════════════════════════════════════════════════════════════
    // claimSubmittedTimeout
    // ════════════════════════════════════════════════════════════════════════

    function test_ClaimSubmittedTimeout_AfterDeadline_TalentGetsPaid() public {
        uint256 jobId    = _submittedJob(false);
        uint256 deadline = escrow.getJob(jobId).deadline;

        uint256 talentBefore = usdc.balanceOf(talent);
        uint256 feeBefore    = usdc.balanceOf(feeRecipient);

        uint256 platformFee = (JOB_BUDGET * PLATFORM_BPS) / 10_000;
        uint256 talentNet   = JOB_BUDGET - platformFee;

        vm.warp(deadline + 1);
        vm.prank(talent);
        escrow.claimSubmittedTimeout(jobId);

        assertEq(usdc.balanceOf(talent),       talentBefore + talentNet,   "talent net");
        assertEq(usdc.balanceOf(feeRecipient), feeBefore    + platformFee, "fee");
        assertEq(uint8(escrow.getJob(jobId).status), uint8(JobEscrow.JobStatus.Completed));
    }

    function test_ClaimSubmittedTimeout_EmitsEvents() public {
        uint256 jobId    = _submittedJob(false);
        uint256 deadline = escrow.getJob(jobId).deadline;
        uint256 talentNet = JOB_BUDGET - (JOB_BUDGET * PLATFORM_BPS) / 10_000;

        vm.warp(deadline + 1);
        vm.prank(talent);
        vm.expectEmit(true, true, false, false, address(escrow));
        emit JobEscrow.JobTimedOut(jobId, talent);
        vm.expectEmit(true, true, false, true, address(escrow));
        emit JobEscrow.JobCompleted(jobId, talent, talentNet, 0);
        escrow.claimSubmittedTimeout(jobId);
    }

    function test_ClaimSubmittedTimeout_BeforeDeadline_Reverts() public {
        uint256 jobId    = _submittedJob(false);
        uint256 deadline = escrow.getJob(jobId).deadline;

        vm.warp(deadline); // at deadline — not past it
        vm.prank(talent);
        vm.expectRevert(JobEscrow.DeadlineNotReached.selector);
        escrow.claimSubmittedTimeout(jobId);
    }

    function test_ClaimSubmittedTimeout_WrongCaller_Reverts() public {
        uint256 jobId    = _submittedJob(false);
        uint256 deadline = escrow.getJob(jobId).deadline;

        vm.warp(deadline + 1);
        vm.prank(stranger);
        vm.expectRevert(JobEscrow.NotTalent.selector);
        escrow.claimSubmittedTimeout(jobId);
    }

    function test_ClaimSubmittedTimeout_WhenFunded_Reverts() public {
        uint256 jobId    = _fundedJob(false);
        uint256 deadline = escrow.getJob(jobId).deadline;

        vm.warp(deadline + 1);
        vm.prank(talent);
        vm.expectRevert(JobEscrow.TalentTimeout.selector);
        escrow.claimSubmittedTimeout(jobId);
    }

    // ════════════════════════════════════════════════════════════════════════
    // Fee snapshot: changing platformFeeBps after postJob doesn't affect it
    // ════════════════════════════════════════════════════════════════════════

    function test_FeeSnapshot_ChangingGlobalFeeDoesNotAffectOldJob() public {
        uint256 jobId = _submittedJob(false);

        // Change global fee from 400 to 200 bps AFTER job is already posted
        vm.prank(owner);
        escrow.setPlatformFeeBps(200);

        uint256 talentBefore = usdc.balanceOf(talent);
        uint256 feeBefore    = usdc.balanceOf(feeRecipient);

        // Should still use the snapshotted 400 bps
        uint256 platformFee = (JOB_BUDGET * PLATFORM_BPS) / 10_000; // 40e6
        uint256 talentNet   = JOB_BUDGET - platformFee;              // 960e6

        vm.prank(client);
        escrow.confirmCompletion(jobId, 5);

        assertEq(usdc.balanceOf(talent),       talentBefore + talentNet,   "snapshotted fee used");
        assertEq(usdc.balanceOf(feeRecipient), feeBefore    + platformFee, "snapshotted fee used");
    }
}
