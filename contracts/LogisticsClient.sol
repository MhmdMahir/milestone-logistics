// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {ILogisticsClient} from "./interfaces/ILogisticsClient.sol";
import {IUserRegistry} from "./interfaces/IUserRegistry.sol";
import {IAgreementFactory} from "./interfaces/IAgreementFactory.sol";
import {ContractStatus, Milestone, MilestoneInput, Transaction, UserProfile, UserRole} from "./interfaces/Types.sol";

contract LogisticsClient is ILogisticsClient {
  //Bounds keep the LogisticsContract constructor's milestone loop inside the block gas limit. Without them an oversized agreement simply fails to deploy.
  uint256 private constant MAX_MILESTONES = 10;
  uint256 private constant MAX_CHECKPOINTS = 10;
  uint256 private constant MAX_DURATION = 90 days; //Agreement duration

  IUserRegistry public userRegistry;
  IAgreementFactory public agreementFactory;

  constructor(address _userRegistry, address _agreementFactory) {
    require(_userRegistry != address(0), "LogisticsClient: registry is the zero address");
    require(_agreementFactory != address(0), "LogisticsClient: factory is the zero address");
    userRegistry = IUserRegistry(_userRegistry);
    agreementFactory = IAgreementFactory(_agreementFactory);
  }

  function login() external view returns (UserProfile memory profile) {}

  function register(string calldata mail, string calldata name, UserRole role) external {}

 /* function createAgreement(
    address carrier,
    uint256 totalPayoutValue,
    uint256 duration,
    MilestoneInput[] calldata milestones
  ) external payable returns (address agreement) {
    agreement =
      agreementFactory.createAgreement{value: msg.value}(msg.sender, carrier, totalPayoutValue, duration, milestones);
  }
*/
  function createAgreement(
    address carrier,
    uint256 totalPayoutValue,
    uint256 duration,
    MilestoneInput[] calldata milestones
  ) external payable returns (address agreement) {
    require(carrier != address(0), "LogisticsClient: carrier is the zero address");
    require(carrier != msg.sender, "LogisticsClient: shipper and carrier must differ");
    require(totalPayoutValue > 0, "LogisticsClient: payout value must be greater than zero");
    require(userRegistry.isRegistered(msg.sender), "LogisticsClient: shipper is not registered");
    require(userRegistry.isRegistered(carrier), "LogisticsClient: carrier is not registered");
    require(
      userRegistry.getUser(msg.sender).role == UserRole.Shipper, "LogisticsClient: caller is not a shipper"
    );
    require(userRegistry.getUser(carrier).role == UserRole.Carrier, "LogisticsClient: carrier is not a carrier");

    _validateSchedule(duration, milestones);

    agreement = agreementFactory.createAgreement{value: msg.value}(
      msg.sender, carrier, totalPayoutValue, duration, milestones
    );
  }

  function _validateSchedule(uint256 duration, MilestoneInput[] calldata milestones) private view {
    require(milestones.length > 0, "LogisticsClient: at least one milestone required");
    require(milestones.length <= MAX_MILESTONES, "LogisticsClient: too many milestones");
    require(duration > 0, "LogisticsClient: duration must be greater than zero");
    require(duration <= MAX_DURATION, "LogisticsClient: duration exceeds the 90 day maximum");

    uint256 previousDeadline = block.timestamp;
    uint256 latestAllowed = block.timestamp + duration;

    for (uint256 i = 0; i < milestones.length; i++) {
      MilestoneInput calldata m = milestones[i];

      require(bytes(m.title).length > 0, "LogisticsClient: milestone title is required");
      require(m.payoutPercent > 0, "LogisticsClient: milestone payout must be greater than zero");
      require(m.deadline > previousDeadline, "LogisticsClient: milestone deadlines must be ascending");
      require(m.deadline <= latestAllowed, "LogisticsClient: milestone deadline exceeds duration");
      require(
        m.checkpointDescriptions.length > 0, "LogisticsClient: milestone requires at least one checkpoint"
      );
      require(
        m.checkpointDescriptions.length <= MAX_CHECKPOINTS, "LogisticsClient: too many checkpoints in milestone"
      );

      for (uint256 j = 0; j < m.checkpointDescriptions.length; j++) {
        require(
          bytes(m.checkpointDescriptions[j]).length > 0, "LogisticsClient: checkpoint description is required"
        );
      }

      previousDeadline = m.deadline;
    }
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
  {}

  function terminateAgreement(address agreement) external {}

  function requestCheckpoint(address agreement, uint256 milestoneIndex, uint256 checkpointIndex) external {}

  function approveCheckpoint(address agreement, uint256 milestoneIndex, uint256 checkpointIndex) external {}

  function checkDeadlines(address agreement) external {}

  function listTransactions(address agreement) external view returns (Transaction[] memory) {}
}
