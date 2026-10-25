// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {JobEscrowBase} from "./JobEscrow.Base.t.sol";
import {JobEscrow}     from "../JobEscrow.sol";
import {Ownable}       from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable}      from "@openzeppelin/contracts/utils/Pausable.sol";

contract JobEscrowRevertTest is JobEscrowBase {

    // ════════════════════════════════════════════════════════════════════════
    // constructor revert paths
    // ════════════════════════════════════════════════════════════════════════

    function test_Constructor_ZeroUSDC_Reverts() public {
        vm.expectRevert(JobEscrow.ZeroAddress.selector);
        new JobEscrow(address(0), address(registry), address(rm), feeRecipient, 400, 100, owner);
    }

    function test_Constructor_FeeTooHigh_Reverts() public {
        vm.expectRevert(JobEscrow.FeeTooHigh.selector);
        new JobEscrow(address(usdc), address(registry), address(rm), feeRecipient, 1001, 100, owner);
    }

    function test_Constructor_ReferralFeeTooHigh_Reverts() public {
        vm.expectRevert(JobEscrow.ReferralFeeTooHigh.selector);
        new JobEscrow(address(usdc), address(registry), address(rm), feeRecipient, 400, 500, owner);
    }

    // ════════════════════════════════════════════════════════════════════════
    // postJob revert paths
    // ════════════════════════════════════════════════════════════════════════

    function test_PostJob_InvalidBudget_Reverts() public {
        vm.prank(client);
        vm.expectRevert(JobEscrow.InvalidBudget.selector);
        escrow.postJob("T", "D", _emptySkills(), 0, block.timestamp + ONE_DAY, JobEscrow.JobType.Fixed, false);
    }

    function test_PostJob_DeadlineInPast_Reverts() public {
        vm.prank(client);
        vm.expectRevert(JobEscrow.DeadlineInPast.selector);
        escrow.postJob("T", "D", _emptySkills(), JOB_BUDGET, block.timestamp, JobEscrow.JobType.Fixed, false);
    }

    function test_PostJob_TooManySkills_Reverts() public {
        string[] memory tooMany = new string[](21);
        for (uint256 i = 0; i < 21; i++) tooMany[i] = "skill";

        vm.prank(client);
        vm.expectRevert(JobEscrow.TooManySkills.selector);
        escrow.postJob("T", "D", tooMany, JOB_BUDGET, block.timestamp + ONE_DAY, JobEscrow.JobType.Fixed, false);
    }

    function test_PostJob_WhenPaused_Reverts() public {
        vm.prank(owner);
        escrow.pause();

        vm.prank(client);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        escrow.postJob("T", "D", _emptySkills(), JOB_BUDGET, block.timestamp + ONE_DAY, JobEscrow.JobType.Fixed, false);
    }

    // ════════════════════════════════════════════════════════════════════════
    // applyToJob revert paths
    // ════════════════════════════════════════════════════════════════════════

    function test_ApplyToJob_ClientCannotApply_Reverts() public {
        uint256 jobId = _postJob(client, JOB_BUDGET, block.timestamp + ONE_DAY, false);

        vm.prank(client);
        vm.expectRevert(JobEscrow.ClientCannotApply.selector);
        escrow.applyToJob(jobId);
    }

    function test_ApplyToJob_AlreadyApplied_Reverts() public {
        uint256 jobId = _postJob(client, JOB_BUDGET, block.timestamp + ONE_DAY, false);
        vm.prank(talent);
        escrow.applyToJob(jobId);

        vm.prank(talent);
        vm.expectRevert(JobEscrow.AlreadyApplied.selector);
        escrow.applyToJob(jobId);
    }

    function test_ApplyToJob_InvalidStatus_Reverts() public {
        uint256 jobId = _fundedJob(false); // status = Funded (not Open)

        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(JobEscrow.InvalidJobStatus.selector, JobEscrow.JobStatus.Funded)
        );
        escrow.applyToJob(jobId);
    }

    function test_ApplyToJob_InvalidJobId_Reverts() public {
        vm.prank(talent);
        vm.expectRevert(JobEscrow.InvalidJobId.selector);
        escrow.applyToJob(999);
    }

    // ════════════════════════════════════════════════════════════════════════
    // selectTalent revert paths
    // ════════════════════════════════════════════════════════════════════════

    function test_SelectTalent_NotClient_Reverts() public {
        uint256 jobId = _postJob(client, JOB_BUDGET, block.timestamp + ONE_DAY, false);
        vm.prank(talent);
        escrow.applyToJob(jobId);

        vm.prank(stranger);
        vm.expectRevert(JobEscrow.NotClient.selector);
        escrow.selectTalent(jobId, talent);
    }

    function test_SelectTalent_NotApplicant_Reverts() public {
        uint256 jobId = _postJob(client, JOB_BUDGET, block.timestamp + ONE_DAY, false);

        vm.prank(client);
        vm.expectRevert(JobEscrow.NotApplicant.selector);
        escrow.selectTalent(jobId, talent); // talent never applied
    }

    function test_SelectTalent_NotOpen_Reverts() public {
        uint256 jobId = _fundedJob(false);

        vm.prank(client);
        vm.expectRevert(
            abi.encodeWithSelector(JobEscrow.InvalidJobStatus.selector, JobEscrow.JobStatus.Funded)
        );
        escrow.selectTalent(jobId, talent);
    }

    // ════════════════════════════════════════════════════════════════════════
    // fundJob revert paths
    // ════════════════════════════════════════════════════════════════════════

    function test_FundJob_NotClient_Reverts() public {
        uint256 jobId = _postJob(client, JOB_BUDGET, block.timestamp + ONE_DAY, false);
        vm.prank(talent);
        escrow.applyToJob(jobId);
        vm.prank(client);
        escrow.selectTalent(jobId, talent);

        vm.prank(stranger);
        vm.expectRevert(JobEscrow.NotClient.selector);
        escrow.fundJob(jobId);
    }

    function test_FundJob_TalentNotSelected_Reverts() public {
        uint256 jobId = _postJob(client, JOB_BUDGET, block.timestamp + ONE_DAY, false);
        // No talent selected

        vm.prank(client);
        vm.expectRevert(JobEscrow.TalentNotSelected.selector);
        escrow.fundJob(jobId);
    }

    function test_FundJob_NotOpen_Reverts() public {
        uint256 jobId = _fundedJob(false); // already Funded

        vm.prank(client);
        vm.expectRevert(
            abi.encodeWithSelector(JobEscrow.InvalidJobStatus.selector, JobEscrow.JobStatus.Funded)
        );
        escrow.fundJob(jobId);
    }

    // ════════════════════════════════════════════════════════════════════════
    // submitDeliverable revert paths
    // ════════════════════════════════════════════════════════════════════════

    function test_SubmitDeliverable_NotTalent_Reverts() public {
        uint256 jobId = _fundedJob(false);

        vm.prank(stranger);
        vm.expectRevert(JobEscrow.NotTalent.selector);
        escrow.submitDeliverable(jobId, "ipfs://QmXYZ");
    }

    function test_SubmitDeliverable_NotFunded_Reverts() public {
        // Job is Open, not Funded
        uint256 jobId = _postJob(client, JOB_BUDGET, block.timestamp + ONE_DAY, false);
        vm.prank(talent);
        escrow.applyToJob(jobId);
        vm.prank(client);
        escrow.selectTalent(jobId, talent);
        // Do NOT fund

        vm.prank(talent);
        vm.expectRevert(
            abi.encodeWithSelector(JobEscrow.InvalidJobStatus.selector, JobEscrow.JobStatus.Open)
        );
        escrow.submitDeliverable(jobId, "hash");
    }

    // ════════════════════════════════════════════════════════════════════════
    // confirmCompletion revert paths
    // ════════════════════════════════════════════════════════════════════════

    function test_ConfirmCompletion_NotClient_Reverts() public {
        uint256 jobId = _submittedJob(false);

        vm.prank(stranger);
        vm.expectRevert(JobEscrow.NotClient.selector);
        escrow.confirmCompletion(jobId, 5);
    }

    function test_ConfirmCompletion_InvalidRating_Zero_Reverts() public {
        uint256 jobId = _submittedJob(false);

        vm.prank(client);
        vm.expectRevert(JobEscrow.InvalidRating.selector);
        escrow.confirmCompletion(jobId, 0);
    }

    function test_ConfirmCompletion_InvalidRating_Six_Reverts() public {
        uint256 jobId = _submittedJob(false);

        vm.prank(client);
        vm.expectRevert(JobEscrow.InvalidRating.selector);
        escrow.confirmCompletion(jobId, 6);
    }

    function test_ConfirmCompletion_NotSubmitted_Reverts() public {
        uint256 jobId = _fundedJob(false);

        vm.prank(client);
        vm.expectRevert(
            abi.encodeWithSelector(JobEscrow.InvalidJobStatus.selector, JobEscrow.JobStatus.Funded)
        );
        escrow.confirmCompletion(jobId, 5);
    }

    // ════════════════════════════════════════════════════════════════════════
    // cancelJob revert paths
    // ════════════════════════════════════════════════════════════════════════

    function test_CancelJob_NotClient_Reverts() public {
        uint256 jobId = _postJob(client, JOB_BUDGET, block.timestamp + ONE_DAY, false);

        vm.prank(stranger);
        vm.expectRevert(JobEscrow.NotClient.selector);
        escrow.cancelJob(jobId);
    }

    // ════════════════════════════════════════════════════════════════════════
    // Admin / owner functions
    // ════════════════════════════════════════════════════════════════════════

    function test_SetFeeRecipient_Owner_Succeeds() public {
        vm.prank(owner);
        escrow.setFeeRecipient(makeAddr("newFee"));
        assertEq(escrow.feeRecipient(), makeAddr("newFee"));
    }

    function test_SetFeeRecipient_NonOwner_Reverts() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        escrow.setFeeRecipient(makeAddr("newFee"));
    }

    function test_SetFeeRecipient_ZeroAddress_Reverts() public {
        vm.prank(owner);
        vm.expectRevert(JobEscrow.ZeroAddress.selector);
        escrow.setFeeRecipient(address(0));
    }

    function test_SetPlatformFeeBps_Owner_Succeeds() public {
        vm.prank(owner);
        escrow.setPlatformFeeBps(500);
        assertEq(escrow.platformFeeBps(), 500);
    }

    function test_SetPlatformFeeBps_TooHigh_Reverts() public {
        vm.prank(owner);
        vm.expectRevert(JobEscrow.FeeTooHigh.selector);
        escrow.setPlatformFeeBps(1001);
    }

    function test_SetPlatformFeeBps_BelowReferral_Reverts() public {
        // REFERRAL_BPS=100; setting platformFeeBps to 50 would be < referral
        vm.prank(owner);
        vm.expectRevert(JobEscrow.ReferralFeeTooHigh.selector);
        escrow.setPlatformFeeBps(50);
    }

    function test_SetPlatformFeeBps_NonOwner_Reverts() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        escrow.setPlatformFeeBps(200);
    }

    function test_SetReferralFeeBps_Owner_Succeeds() public {
        vm.prank(owner);
        escrow.setReferralFeeBps(50);
        assertEq(escrow.referralFeeBps(), 50);
    }

    function test_SetReferralFeeBps_TooHigh_Reverts() public {
        // referralBps > platformBps (400) must revert
        vm.prank(owner);
        vm.expectRevert(JobEscrow.ReferralFeeTooHigh.selector);
        escrow.setReferralFeeBps(500);
    }

    function test_SetTalentRegistry_Owner_Succeeds() public {
        vm.prank(owner);
        escrow.setTalentRegistry(makeAddr("newReg"));
        assertEq(escrow.talentRegistry(), makeAddr("newReg"));
    }

    function test_SetTalentRegistry_ZeroAddress_Reverts() public {
        vm.prank(owner);
        vm.expectRevert(JobEscrow.ZeroAddress.selector);
        escrow.setTalentRegistry(address(0));
    }

    function test_SetTalentRegistry_NonOwner_Reverts() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        escrow.setTalentRegistry(makeAddr("newReg"));
    }

    function test_SetReferralManager_Owner_Succeeds() public {
        vm.prank(owner);
        escrow.setReferralManager(makeAddr("newRm"));
        assertEq(escrow.referralManager(), makeAddr("newRm"));
    }

    function test_SetReferralManager_ZeroAddress_Reverts() public {
        vm.prank(owner);
        vm.expectRevert(JobEscrow.ZeroAddress.selector);
        escrow.setReferralManager(address(0));
    }

    function test_SetReferralManager_NonOwner_Reverts() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        escrow.setReferralManager(makeAddr("newRm"));
    }

    function test_Pause_Unpause_Owner() public {
        vm.prank(owner);
        escrow.pause();
        assertTrue(escrow.paused());

        vm.prank(owner);
        escrow.unpause();
        assertFalse(escrow.paused());
    }

    function test_Pause_NonOwner_Reverts() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        escrow.pause();
    }
}
