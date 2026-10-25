// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ITalentRegistry, IReferralManager} from "./IArcTalent.sol";

contract JobEscrow is Ownable2Step, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    enum JobStatus {
        Open,
        Funded,
        Submitted,
        Completed,
        Cancelled,
        Refunded,
        Expired
    }

    enum JobType {
        Fixed,
        Bounty,
        ReferralEligible
    }

    struct Job {
        uint256 id;
        address client;
        address talent;
        string title;
        string description;
        string[] skills;
        uint256 budget;
        uint256 deadline;
        JobType jobType;
        bool referralEligible;
        uint256 jobPlatformFeeBps;
        uint256 jobReferralFeeBps;
        JobStatus status;
        string deliverableHash;
        uint8 rating;
        uint256 postedAt;
    }

    struct TalentStats {
        uint256 jobsCompleted;
        uint256 ratingSum;
        uint256 ratingCount;
        uint256 totalUSDCEarned;
    }

    mapping(uint256 => Job) public jobs;
    mapping(uint256 => address[]) public applicants;
    mapping(uint256 => mapping(address => bool)) public hasApplied;
    mapping(address => TalentStats) public talentStats;

    uint256 public nextJobId;
    address public immutable usdcToken;
    address public talentRegistry;
    address public referralManager;
    address public feeRecipient;
    uint256 public platformFeeBps;
    uint256 public referralFeeBps;

    uint256 public constant MAX_FEE_BPS = 1000;
    uint256 public constant MAX_SKILLS = 20;

    event JobPosted(uint256 indexed jobId, address indexed client, uint256 budget);
    event JobApplication(uint256 indexed jobId, address indexed talent);
    event TalentSelected(uint256 indexed jobId, address indexed talent);
    event JobFunded(uint256 indexed jobId, uint256 budget);
    event DeliverableSubmitted(uint256 indexed jobId, string deliverableHash);
    event JobCompleted(uint256 indexed jobId, address indexed talent, uint256 netAmount, uint8 rating);
    event JobCancelled(uint256 indexed jobId, uint256 refundAmount);
    event JobExpired(uint256 indexed jobId, uint256 refundAmount);
    event JobTimedOut(uint256 indexed jobId, address indexed talent);
    event PlatformFeeSet(uint256 bps);
    event ReferralFeeSet(uint256 bps);
    event FeeRecipientSet(address indexed recipient);
    event TalentRegistrySet(address indexed registry);
    event ReferralManagerSet(address indexed manager);
    event ReputationUpdateFailed(uint256 indexed jobId, address indexed talent);
    event ReferralPaid(uint256 indexed jobId, address indexed talent, address indexed referrer, uint256 amount);

    error InvalidBudget();
    error DeadlineInPast();
    error NotClient();
    error NotTalent();
    error InvalidJobStatus(JobStatus current);
    error AlreadyApplied();
    error NotApplicant();
    error InvalidRating();
    error ZeroAddress();
    error FeeTooHigh();
    error ReferralFeeTooHigh();
    error ClientCannotApply();
    error TalentNotSelected();
    error JobNotExpired();
    error InvalidJobId();
    error TooManySkills();
    error TalentTimeout();
    error DeadlineNotReached();

    modifier onlyClient(uint256 jobId) {
        if (msg.sender != jobs[jobId].client) revert NotClient();
        _;
    }

    constructor(
        address _usdcToken,
        address _talentRegistry,
        address _referralManager,
        address _feeRecipient,
        uint256 _platformFeeBps,
        uint256 _referralFeeBps,
        address initialOwner
    ) Ownable(initialOwner) {
        if (
            _usdcToken == address(0) || _talentRegistry == address(0) || _referralManager == address(0)
                || _feeRecipient == address(0)
        ) revert ZeroAddress();
        if (_platformFeeBps > MAX_FEE_BPS) revert FeeTooHigh();
        if (_referralFeeBps > _platformFeeBps) revert ReferralFeeTooHigh();

        usdcToken = _usdcToken;
        talentRegistry = _talentRegistry;
        referralManager = _referralManager;
        feeRecipient = _feeRecipient;
        platformFeeBps = _platformFeeBps;
        referralFeeBps = _referralFeeBps;
    }

    function postJob(
        string calldata title,
        string calldata description,
        string[] calldata skills,
        uint256 budget,
        uint256 deadline,
        JobType jobType,
        bool referralEligible
    ) external whenNotPaused {
        if (budget == 0) revert InvalidBudget();
        if (deadline <= block.timestamp) revert DeadlineInPast();
        if (skills.length > MAX_SKILLS) revert TooManySkills();

        uint256 jobId = nextJobId;
        nextJobId = jobId + 1;

        Job storage job = jobs[jobId];
        job.id = jobId;
        job.client = msg.sender;
        job.title = title;
        job.description = description;

        // Manually push each skill — direct calldata-to-storage copy of
        // nested dynamic arrays is not supported by the Solidity compiler.
        for (uint256 i = 0; i < skills.length; i++) {
            job.skills.push(skills[i]);
        }

        job.budget = budget;
        job.deadline = deadline;
        job.jobType = jobType;
        job.referralEligible = referralEligible;
        job.jobPlatformFeeBps = platformFeeBps;
        job.jobReferralFeeBps = referralFeeBps;
        job.status = JobStatus.Open;
        job.postedAt = block.timestamp;

        emit JobPosted(jobId, msg.sender, budget);
    }

    function applyToJob(uint256 jobId) external whenNotPaused {
        _requireJobExists(jobId);
        Job storage job = jobs[jobId];

        if (job.status != JobStatus.Open) revert InvalidJobStatus(job.status);
        if (msg.sender == job.client) revert ClientCannotApply();
        if (hasApplied[jobId][msg.sender]) revert AlreadyApplied();

        hasApplied[jobId][msg.sender] = true;
        applicants[jobId].push(msg.sender);

        emit JobApplication(jobId, msg.sender);
    }

    function selectTalent(uint256 jobId, address talent) external whenNotPaused onlyClient(jobId) {
        _requireJobExists(jobId);
        Job storage job = jobs[jobId];

        if (job.status != JobStatus.Open) revert InvalidJobStatus(job.status);
        if (!hasApplied[jobId][talent]) revert NotApplicant();

        job.talent = talent;

        emit TalentSelected(jobId, talent);
    }

    function fundJob(uint256 jobId) external nonReentrant whenNotPaused onlyClient(jobId) {
        _requireJobExists(jobId);
        Job storage job = jobs[jobId];

        if (job.status != JobStatus.Open) revert InvalidJobStatus(job.status);
        if (job.talent == address(0)) revert TalentNotSelected();

        job.status = JobStatus.Funded;

        IERC20(usdcToken).safeTransferFrom(msg.sender, address(this), job.budget);

        emit JobFunded(jobId, job.budget);
    }

    function submitDeliverable(uint256 jobId, string calldata deliverableHash) external nonReentrant whenNotPaused {
        _requireJobExists(jobId);
        Job storage job = jobs[jobId];

        if (msg.sender != job.talent) revert NotTalent();
        if (job.status != JobStatus.Funded) revert InvalidJobStatus(job.status);

        job.deliverableHash = deliverableHash;
        job.status = JobStatus.Submitted;

        emit DeliverableSubmitted(jobId, deliverableHash);
    }

    function confirmCompletion(uint256 jobId, uint8 rating) external nonReentrant whenNotPaused onlyClient(jobId) {
        _requireJobExists(jobId);
        Job storage job = jobs[jobId];

        if (job.status != JobStatus.Submitted) revert InvalidJobStatus(job.status);
        if (rating < 1 || rating > 5) revert InvalidRating();

        job.status = JobStatus.Completed;
        job.rating = rating;

        TalentStats storage stats = talentStats[job.talent];
        stats.jobsCompleted += 1;
        stats.ratingSum += rating;
        stats.ratingCount += 1;

        (uint256 platformFee, uint256 maxReferralFee, uint256 talentNet) =
            _computeFee(job.budget, job.jobPlatformFeeBps, job.jobReferralFeeBps);
        stats.totalUSDCEarned += talentNet;

        uint256 referralAmount = 0;
        if (job.referralEligible) {
            address referrer = IReferralManager(referralManager).getReferrer(job.talent);
            if (referrer != address(0)) {
                referralAmount = maxReferralFee;
            }
        }

        uint256 feeToRecipient = platformFee - referralAmount;

        IERC20(usdcToken).safeTransfer(job.talent, talentNet);
        if (feeToRecipient > 0) {
            IERC20(usdcToken).safeTransfer(feeRecipient, feeToRecipient);
        }

        if (referralAmount > 0) {
            // Transfer referral directly from escrow to the referrer.
            // ReferralManager.getReferrer is used for the lookup only; USDC never passes through RM.
            address referrer = IReferralManager(referralManager).getReferrer(job.talent);
            if (referrer != address(0)) {
                IERC20(usdcToken).safeTransfer(referrer, referralAmount);
                emit ReferralPaid(jobId, job.talent, referrer, referralAmount);
            } else {
                // Edge: referrer unset between selection and completion — send to fee recipient
                IERC20(usdcToken).safeTransfer(feeRecipient, referralAmount);
            }
        }

        try ITalentRegistry(talentRegistry).updateReputation(
            job.talent, stats.jobsCompleted, stats.ratingSum, stats.ratingCount, stats.totalUSDCEarned
        ) {}
        catch {
            emit ReputationUpdateFailed(jobId, job.talent);
        }

        emit JobCompleted(jobId, job.talent, talentNet, rating);
    }

    function cancelJob(uint256 jobId) external nonReentrant whenNotPaused onlyClient(jobId) {
        _requireJobExists(jobId);
        Job storage job = jobs[jobId];

        if (job.status == JobStatus.Open) {
            job.status = JobStatus.Cancelled;
            emit JobCancelled(jobId, 0);
            return;
        }

        if (job.status == JobStatus.Funded) {
            job.status = JobStatus.Refunded;
            IERC20(usdcToken).safeTransfer(job.client, job.budget);
            emit JobCancelled(jobId, job.budget);
            return;
        }

        revert InvalidJobStatus(job.status);
    }

    function claimExpiry(uint256 jobId) external nonReentrant whenNotPaused {
        _requireJobExists(jobId);
        Job storage job = jobs[jobId];

        if (job.status != JobStatus.Funded) revert InvalidJobStatus(job.status);
        if (block.timestamp <= job.deadline) revert JobNotExpired();

        job.status = JobStatus.Expired;
        IERC20(usdcToken).safeTransfer(job.client, job.budget);

        emit JobExpired(jobId, job.budget);
    }

    function claimSubmittedTimeout(uint256 jobId) external nonReentrant whenNotPaused {
        _requireJobExists(jobId);
        Job storage job = jobs[jobId];

        if (msg.sender != job.talent) revert NotTalent();
        if (job.status != JobStatus.Submitted) revert TalentTimeout();
        if (block.timestamp <= job.deadline) revert DeadlineNotReached();

        job.status = JobStatus.Completed;
        job.rating = 0;

        TalentStats storage stats = talentStats[job.talent];
        stats.jobsCompleted += 1;

        (uint256 platformFee, uint256 maxReferralFee, uint256 talentNet) =
            _computeFee(job.budget, job.jobPlatformFeeBps, job.jobReferralFeeBps);
        stats.totalUSDCEarned += talentNet;

        uint256 referralAmount = 0;
        if (job.referralEligible) {
            address referrer = IReferralManager(referralManager).getReferrer(job.talent);
            if (referrer != address(0)) {
                referralAmount = maxReferralFee;
            }
        }

        uint256 feeToRecipient = platformFee - referralAmount;

        IERC20(usdcToken).safeTransfer(job.talent, talentNet);
        if (feeToRecipient > 0) {
            IERC20(usdcToken).safeTransfer(feeRecipient, feeToRecipient);
        }

        if (referralAmount > 0) {
            address referrer = IReferralManager(referralManager).getReferrer(job.talent);
            if (referrer != address(0)) {
                IERC20(usdcToken).safeTransfer(referrer, referralAmount);
                emit ReferralPaid(jobId, job.talent, referrer, referralAmount);
            } else {
                IERC20(usdcToken).safeTransfer(feeRecipient, referralAmount);
            }
        }

        try ITalentRegistry(talentRegistry).updateReputation(
            job.talent, stats.jobsCompleted, stats.ratingSum, stats.ratingCount, stats.totalUSDCEarned
        ) {}
        catch {
            emit ReputationUpdateFailed(jobId, job.talent);
        }

        emit JobTimedOut(jobId, job.talent);
        emit JobCompleted(jobId, job.talent, talentNet, 0);
    }

    function setFeeRecipient(address recipient) external onlyOwner {
        if (recipient == address(0)) revert ZeroAddress();
        feeRecipient = recipient;
        emit FeeRecipientSet(recipient);
    }

    function setPlatformFeeBps(uint256 bps) external onlyOwner {
        if (bps > MAX_FEE_BPS) revert FeeTooHigh();
        if (bps < referralFeeBps) revert ReferralFeeTooHigh();
        platformFeeBps = bps;
        emit PlatformFeeSet(bps);
    }

    function setReferralFeeBps(uint256 bps) external onlyOwner {
        if (bps > platformFeeBps) revert ReferralFeeTooHigh();
        referralFeeBps = bps;
        emit ReferralFeeSet(bps);
    }

    function setTalentRegistry(address registry) external onlyOwner {
        if (registry == address(0)) revert ZeroAddress();
        talentRegistry = registry;
        emit TalentRegistrySet(registry);
    }

    function setReferralManager(address manager) external onlyOwner {
        if (manager == address(0)) revert ZeroAddress();
        referralManager = manager;
        emit ReferralManagerSet(manager);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function getJob(uint256 jobId) external view returns (Job memory) {
        _requireJobExists(jobId);
        return jobs[jobId];
    }

    function getApplicants(uint256 jobId) external view returns (address[] memory) {
        _requireJobExists(jobId);
        return applicants[jobId];
    }

    function getJobCount() external view returns (uint256) {
        return nextJobId;
    }

    function computeFee(uint256 budget) external view returns (uint256 platformFee, uint256 referralFee, uint256 talentNet) {
        return _computeFee(budget, platformFeeBps, referralFeeBps);
    }

    function _computeFee(uint256 budget, uint256 pfBps, uint256 rfBps)
        internal
        pure
        returns (uint256 platformFee, uint256 referralFee, uint256 talentNet)
    {
        platformFee = (budget * pfBps) / 10_000;
        referralFee = (budget * rfBps) / 10_000;
        talentNet = budget - platformFee;
    }

    function _requireJobExists(uint256 jobId) internal view {
        if (jobId >= nextJobId) revert InvalidJobId();
    }
}
