// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Interface for TalentRegistry — implemented by TalentRegistry.sol
interface ITalentRegistry {
    function updateReputation(
        address talent,
        uint256 jobsCompleted,
        uint256 ratingSum,
        uint256 ratingCount,
        uint256 totalUSDCEarned
    ) external;
}

/// @notice Interface for ReferralManager — implemented by ReferralManager.sol
interface IReferralManager {
    function distributeReferral(address talent, address usdcToken, uint256 amount) external;
    function getReferrer(address talent) external view returns (address);
}
