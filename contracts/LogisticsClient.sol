// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {ILogisticsClient} from "./interfaces/ILogisticsClient.sol";
import {IUserRegistry} from "./interfaces/IUserRegistry.sol";
import {IAgreementFactory} from "./interfaces/IAgreementFactory.sol";
import {ContractStatus, Milestone, MilestoneInput, Transaction, UserProfile, UserRole} from "./interfaces/Types.sol";

contract LogisticsClient is ILogisticsClient {
  IUserRegistry public userRegistry;
  IAgreementFactory public agreementFactory;

  constructor(address _userRegistry, address _agreementFactory) {}

  function login() external view returns (UserProfile memory profile) {}

  function register(string calldata mail, string calldata name, UserRole role) external {}

  function createAgreement(
    address carrier,
    uint256 totalPayoutValue,
    uint256 duration,
    MilestoneInput[] calldata milestones
  ) external payable returns (address agreement) {}

  function listMyAgreements() external view returns (address[] memory) {}

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
    )
  {}

  function terminateAgreement(address agreement) external {}

  function requestCheckpoint(address agreement, uint256 milestoneIndex, uint256 checkpointIndex) external {}

  function approveCheckpoint(address agreement, uint256 milestoneIndex, uint256 checkpointIndex) external {}

  function checkDeadlines(address agreement) external {}

  function listTransactions(address agreement) external view returns (Transaction[] memory) {}
}
