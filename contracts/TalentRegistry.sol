// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ITalentRegistry} from "./IArcTalent.sol";

contract TalentRegistry is Ownable2Step, ITalentRegistry {
    struct Profile {
        string name;
        string bio;
        string[] skills;
        string[] portfolioLinks;
        uint256 preferredRate;
        string location;
        bool exists;
        uint256 registeredAt;
    }

    struct ReputationData {
        uint256 jobsCompleted;
        uint256 ratingSum;
        uint256 ratingCount;
        uint256 totalUSDCEarned;
    }

    mapping(address => Profile) public profiles;
    mapping(address => ReputationData) public reputations;
    address public escrowContract;

    uint256 public constant MAX_SKILLS = 20;
    uint256 public constant MAX_PORTFOLIO_LINKS = 10;

    event ProfileRegistered(address indexed talent);
    event ProfileUpdated(address indexed talent);
    event ReputationUpdated(address indexed talent, uint256 score);
    event EscrowContractSet(address indexed escrow);

    error EmptyName();
    error NotEscrow();
    error ZeroAddress();
    error TooManySkills();
    error TooManyPortfolioLinks();

    modifier onlyEscrow() {
        if (msg.sender != escrowContract) revert NotEscrow();
        _;
    }

    constructor(address initialOwner) Ownable(initialOwner) {}

    function registerProfile(
        string calldata name,
        string calldata bio,
        string[] calldata skills,
        string[] calldata portfolioLinks,
        uint256 preferredRate,
        string calldata location
    ) external {
        if (bytes(name).length == 0) revert EmptyName();
        if (skills.length > MAX_SKILLS) revert TooManySkills();
        if (portfolioLinks.length > MAX_PORTFOLIO_LINKS) revert TooManyPortfolioLinks();

        Profile storage profile = profiles[msg.sender];
        bool isNew = !profile.exists;
        uint256 registeredAt = isNew ? block.timestamp : profile.registeredAt;

        profile.name = name;
        profile.bio = bio;

        // Clear and repopulate dynamic arrays — direct calldata-to-storage
        // copy of nested dynamic arrays is not supported by the compiler.
        delete profile.skills;
        for (uint256 i = 0; i < skills.length; i++) {
            profile.skills.push(skills[i]);
        }

        delete profile.portfolioLinks;
        for (uint256 i = 0; i < portfolioLinks.length; i++) {
            profile.portfolioLinks.push(portfolioLinks[i]);
        }

        profile.preferredRate = preferredRate;
        profile.location = location;
        profile.exists = true;
        profile.registeredAt = registeredAt;

        if (isNew) {
            emit ProfileRegistered(msg.sender);
        } else {
            emit ProfileUpdated(msg.sender);
        }
    }

    function updateReputation(
        address talent,
        uint256 jobsCompleted,
        uint256 ratingSum,
        uint256 ratingCount,
        uint256 totalUSDCEarned
    ) external onlyEscrow {
        reputations[talent] = ReputationData({
            jobsCompleted: jobsCompleted,
            ratingSum: ratingSum,
            ratingCount: ratingCount,
            totalUSDCEarned: totalUSDCEarned
        });

        emit ReputationUpdated(talent, _reputationScore(reputations[talent]));
    }

    function setEscrowContract(address escrow) external onlyOwner {
        if (escrow == address(0)) revert ZeroAddress();
        escrowContract = escrow;
        emit EscrowContractSet(escrow);
    }

    function getProfile(address talent) external view returns (Profile memory) {
        return profiles[talent];
    }

    function getReputation(address talent) external view returns (ReputationData memory) {
        return reputations[talent];
    }

    function reputationScore(address talent) external view returns (uint256) {
        return _reputationScore(reputations[talent]);
    }

    function _reputationScore(ReputationData memory data) internal pure returns (uint256) {
        uint256 avgRating = data.ratingCount > 0 ? data.ratingSum / data.ratingCount : 0;
        return (data.jobsCompleted * 10) + (avgRating * 20) + (data.totalUSDCEarned / 100);
    }
}
