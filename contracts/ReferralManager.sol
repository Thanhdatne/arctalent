// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IReferralManager} from "./IArcTalent.sol";

contract ReferralManager is Ownable2Step, IReferralManager {
    using SafeERC20 for IERC20;

    mapping(address => address) public referrers;
    mapping(bytes8 => address) public codeToAddr;
    address public escrowContract;

    event ReferralRegistered(address indexed talent, address indexed referrer);
    event ReferralPaid(address indexed talent, address indexed referrer, uint256 amount);
    event EscrowContractSet(address indexed escrow);

    error NotEscrow();
    error AlreadyRegistered();
    error InvalidReferrer();
    error SelfReferral();
    error ZeroAddress();

    modifier onlyEscrow() {
        if (msg.sender != escrowContract) revert NotEscrow();
        _;
    }

    constructor(address initialOwner) Ownable(initialOwner) {}

    function getCode(address account) public pure returns (bytes8) {
        return bytes8(keccak256(abi.encodePacked(account)));
    }

    function myCode() external view returns (bytes8) {
        return getCode(msg.sender);
    }

    function resolveCode(bytes8 code) external view returns (address) {
        return codeToAddr[code];
    }

    /// @notice Referrers must call this once to publish their code before others can use it.
    function activateReferralCode() external {
        bytes8 code = getCode(msg.sender);
        // Idempotent — safe to call multiple times
        if (codeToAddr[code] == address(0)) {
            codeToAddr[code] = msg.sender;
        }
    }

    function registerReferral(bytes8 referrerCode) external {
        if (referrers[msg.sender] != address(0)) revert AlreadyRegistered();

        address referrer = codeToAddr[referrerCode];
        if (referrer == address(0)) revert InvalidReferrer();
        if (msg.sender == referrer) revert SelfReferral();

        referrers[msg.sender] = referrer;

        emit ReferralRegistered(msg.sender, referrer);
    }

    function distributeReferral(address talent, address usdcToken, uint256 amount) external onlyEscrow {
        address referrer = referrers[talent];
        if (referrer == address(0)) {
            return;
        }

        IERC20(usdcToken).safeTransfer(referrer, amount);
        emit ReferralPaid(talent, referrer, amount);
    }

    function getReferrer(address talent) external view returns (address) {
        return referrers[talent];
    }

    function setEscrowContract(address escrow) external onlyOwner {
        if (escrow == address(0)) revert ZeroAddress();
        escrowContract = escrow;
        emit EscrowContractSet(escrow);
    }
}
