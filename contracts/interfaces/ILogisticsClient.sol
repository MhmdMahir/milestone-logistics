// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {ContractStatus, Milestone, MilestoneInput, Transaction, UserProfile, UserRole} from "./Types.sol";

// Single on-chain entrypoint aggregating UserRegistry / AgreementFactory /
// LogisticsContract. The mutating calls here (login, register,
// createAgreement, terminateAgreement, requestCheckpoint, approveCheckpoint)
// forward on this contract's msg.sender as an explicit argument to those
// sub-contracts, which trust it because they in turn require msg.sender ==
// this contract's address (see the onlyClient modifiers on UserRegistry,
// AgreementFactory and LogisticsContract). That trusted-forwarder wiring is
// what keeps role checks like onlyShipper/onlyCarrier correct even though
// every call is routed through a single aggregator.
interface ILogisticsClient {
  function login() external view returns (UserProfile memory);

  function register(string calldata mail, string calldata name, UserRole role) external;

  // Caller must have approved AgreementFactory for totalPayoutValue first
  // (ERC-20 funding, not native ETH).
  function createAgreement(
    address carrier,
    uint256 totalPayoutValue,
    uint256 duration,
    MilestoneInput[] calldata milestones
  ) external returns (address agreement);

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

  // currentTime: see ILogisticsContract.checkDeadlines — caller-supplied for
  // demo purposes only, forwarded as-is.
  function checkDeadlines(address agreement, uint256 currentTime) external;

  function listTransactions(address agreement) external view returns (Transaction[] memory);
}
