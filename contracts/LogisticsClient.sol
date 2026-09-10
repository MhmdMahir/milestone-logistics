// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {ILogisticsClient} from "./interfaces/ILogisticsClient.sol";
import {IUserRegistry} from "./interfaces/IUserRegistry.sol";
import {INativeAgreementFactory} from "./interfaces/INativeAgreementFactory.sol";
import {ILogisticsContract} from "./interfaces/ILogisticsContract.sol";
import {ContractStatus, Milestone, MilestoneInput, Transaction, UserProfile, UserRole} from "./interfaces/Types.sol";

// User-facing trusted facade. It forwards the original wallet address to the
// underlying contracts because those contracts trust this facade as client.
// This facade uses the additive native-ETH factory; the original ERC-20
// AgreementFactory and Escrow contracts remain available and unchanged.
contract LogisticsClient is ILogisticsClient {
  IUserRegistry public userRegistry;
  INativeAgreementFactory public agreementFactory;

  constructor(address _userRegistry, address _agreementFactory) {
    userRegistry = IUserRegistry(_userRegistry);
    agreementFactory = INativeAgreementFactory(_agreementFactory);
  }

  function login() external view returns (UserProfile memory profile) {
    return userRegistry.login(msg.sender);
  }

  function register(string calldata mail, string calldata name, UserRole role) external {
    userRegistry.register(msg.sender, mail, name, role);
  }

  function createAgreement(
    address carrier,
    uint256 totalPayoutValue,
    uint256 duration,
    MilestoneInput[] calldata milestones
  ) external payable returns (address agreement) {
    return agreementFactory.createAgreement{value: msg.value}(
      msg.sender,
      carrier,
      totalPayoutValue,
      duration,
      milestones
    );
  }

  function listMyAgreements() external view returns (address[] memory) {
    return agreementFactory.listAgreementsByUser(msg.sender);
  }

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
  {
    ILogisticsContract logistics = ILogisticsContract(agreement);
    shipper = logistics.shipper();
    carrier = logistics.carrier();
    totalPayoutValue = logistics.totalPayoutValue();
    payoutRemaining = logistics.payoutRemaining();
    duration = logistics.duration();
    status = logistics.status();

    uint256 count = logistics.milestoneCount();
    milestones = new Milestone[](count);
    for (uint256 i = 0; i < count; i++) {
      milestones[i] = logistics.getMilestone(i);
    }
  }

  function terminateAgreement(address agreement) external {
    ILogisticsContract(agreement).terminateContract(msg.sender);
  }

  function requestCheckpoint(address agreement, uint256 milestoneIndex, uint256 checkpointIndex) external {
    ILogisticsContract(agreement).requestCheckpoint(msg.sender, milestoneIndex, checkpointIndex);
  }

  function approveCheckpoint(address agreement, uint256 milestoneIndex, uint256 checkpointIndex) external {
    ILogisticsContract(agreement).approveCheckpoint(msg.sender, milestoneIndex, checkpointIndex);
  }

  // Anyone may poke the agreement's keeper-style deadline check. The agreement
  // owns failure detection, transaction recording, and the eventual refund.
  function checkDeadlines(address agreement) external {
    ILogisticsContract(agreement).checkDeadlines();
  }

  function listTransactions(address agreement) external view returns (Transaction[] memory) {
    return ILogisticsContract(agreement).getTransactions();
  }

}
