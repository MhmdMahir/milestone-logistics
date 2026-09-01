// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {ContractStatus, Milestone, MilestoneInput, Transaction, UserProfile, UserRole} from "./Types.sol";

// On-chain mirror of the frontend LogisticsClient facade (see
// frontend/src/contracts/LogisticsClient.d.ts). Only the view functions and
// checkDeadlines are safe to implement as plain forwarding calls to
// UserRegistry / AgreementFactory / LogisticsContract - the rest
// (login, register, createAgreement, terminateAgreement,
// requestCheckpoint, approveCheckpoint) are msg.sender-gated in those
// contracts. Forwarding them here would make msg.sender == address(this)
// on the other side, silently breaking those checks; they need either a
// meta-transaction / signature scheme or to stay off this contract.
interface ILogisticsClient {
  function login() external view returns (UserProfile memory);

  function register(string calldata mail, string calldata name, UserRole role) external;

  function createAgreement(
    address carrier,
    uint256 totalPayoutValue,
    uint256 duration,
    MilestoneInput[] calldata milestones
  ) external payable returns (address agreement);

  function listAllAgreements() external view returns (address[] memory);

  function listMyAgreements() external view returns (address[] memory);

  function getAgreementDetails(address agreement)
    external
    view
    returns (
      address shipper,
      address carrier,
      uint256 totalPayoutValue,
      uint256 payoutRemaining,
      uint256 duration,
      ContractStatus status,
      Milestone[] memory milestones
    );

  function terminateAgreement(address agreement) external;

  function requestCheckpoint(address agreement, uint256 milestoneIndex, uint256 checkpointIndex) external;

  function approveCheckpoint(address agreement, uint256 milestoneIndex, uint256 checkpointIndex) external;

  function checkDeadlines(address agreement) external;

  function listTransactions(address agreement) external view returns (Transaction[] memory);
}
