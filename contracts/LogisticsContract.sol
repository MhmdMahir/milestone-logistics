// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {ILogisticsContract} from "./interfaces/ILogisticsContract.sol";
import {IEscrow} from "./interfaces/IEscrow.sol";
import {
  ContractStatus,
  Milestone,
  MilestoneCheckpoint,
  MilestoneInput,
  MilestoneStatus,
  Transaction,
  TransactionType
} from "./interfaces/Types.sol";

contract LogisticsContract is ILogisticsContract {
  uint256 private constant PERCENT_BASE = 100;

  address public factory;
  address public shipper;
  address public carrier;
  address public escrow;
  address public client;
  uint256 public totalPayoutValue;
  uint256 public duration;
  uint256 public payoutRemaining;
  ContractStatus public status;

  Milestone[] private milestones;
  Transaction[] private transactions;

  modifier onlyFactory() {
    require(msg.sender == factory, "LogisticsContract: caller is not the factory");
    _;
  }

  modifier onlyClient() {
    require(msg.sender == client, "LogisticsContract: caller is not the client");
    _;
  }

  constructor(
    address _shipper,
    address _carrier,
    uint256 _totalPayoutValue,
    uint256 _duration,
    MilestoneInput[] memory _milestones,
    address _client
  ) {
    require(_milestones.length > 0, "LogisticsContract: at least one milestone required");

    uint256 percentTotal;
    for (uint256 i = 0; i < _milestones.length; i++) {
      percentTotal += _milestones[i].payoutPercent;

      Milestone storage milestone = milestones.push();
      milestone.deadline = _milestones[i].deadline;
      milestone.payoutPercent = _milestones[i].payoutPercent;
      milestone.title = _milestones[i].title;
      milestone.status = MilestoneStatus.Pending;

      string[] memory checkpointDescriptions = _milestones[i].checkpointDescriptions;
      for (uint256 j = 0; j < checkpointDescriptions.length; j++) {
        milestone.checkpoints.push(
          MilestoneCheckpoint({description: checkpointDescriptions[j], isRequested: false, isCompleted: false})
        );
      }
    }
    require(percentTotal == PERCENT_BASE, "LogisticsContract: payout percentages must sum to 100");

    factory = msg.sender;
    shipper = _shipper;
    carrier = _carrier;
    totalPayoutValue = _totalPayoutValue;
    duration = _duration;
    payoutRemaining = _totalPayoutValue;
    status = ContractStatus.Pending;
    client = _client;
  }

  function milestoneCount() external view returns (uint256) {
    return milestones.length;
  }

  function getMilestone(uint256 index) external view returns (Milestone memory) {
    return milestones[index];
  }

  function getTransactions() external view returns (Transaction[] memory) {
    return transactions;
  }

  function setEscrow(address escrowAddress) external onlyFactory {
    require(escrow == address(0), "LogisticsContract: escrow already set");
    escrow = escrowAddress;
  }

  function activateContract() external onlyFactory {
    require(status == ContractStatus.Pending, "LogisticsContract: not pending");
    require(IEscrow(escrow).balance() == totalPayoutValue, "LogisticsContract: escrow not fully funded");

    status = ContractStatus.Activated;
    milestones[0].status = MilestoneStatus.InProgress;

    transactions.push(
      Transaction({
        sender: shipper,
        receiver: escrow,
        amount: totalPayoutValue,
        txType: TransactionType.AgreementCreation,
        timestamp: block.timestamp
      })
    );

    emit ContractActivated();
  }

  function terminateAgreement(address caller) public onlyClient {
    require(status == ContractStatus.Activated, "LogisticsContract: not activated");
    require(caller == shipper, "LogisticsContract: caller is not the shipper");

    uint256 refundAmount = IEscrow(escrow).balance();
    status = ContractStatus.Terminated;

    transactions.push(
      Transaction({
        sender: escrow,
        receiver: shipper,
        amount: refundAmount,
        txType: TransactionType.Refund,
        timestamp: block.timestamp
      })
    );

    IEscrow(escrow).refund();
    emit ContractTerminated();
  }

  function requestCheckpoint(address caller, uint256 milestoneIndex, uint256 checkpointIndex) external onlyClient {
    require(caller == carrier, "LogisticsContract: caller is not the carrier");
    Milestone storage milestone = _inProgressMilestone(milestoneIndex);
    MilestoneCheckpoint storage checkpoint = milestone.checkpoints[checkpointIndex];
    require(!checkpoint.isCompleted, "LogisticsContract: checkpoint already completed");

    checkpoint.isRequested = true;
    emit CheckpointRequested(milestoneIndex, checkpointIndex);
  }

  function approveCheckpoint(address caller, uint256 milestoneIndex, uint256 checkpointIndex) external onlyClient {
    require(caller == shipper, "LogisticsContract: caller is not the shipper");
    Milestone storage milestone = _inProgressMilestone(milestoneIndex);
    MilestoneCheckpoint storage checkpoint = milestone.checkpoints[checkpointIndex];
    require(checkpoint.isRequested, "LogisticsContract: checkpoint not requested");
    require(!checkpoint.isCompleted, "LogisticsContract: checkpoint already completed");

    checkpoint.isCompleted = true;
    emit CheckpointApproved(milestoneIndex, checkpointIndex);

    bool allCompleted = true;
    for (uint256 i = 0; i < milestone.checkpoints.length; i++) {
      if (!milestone.checkpoints[i].isCompleted) {
        allCompleted = false;
        break;
      }
    }

    if (allCompleted) {
      _completeMilestone(milestoneIndex);
    }
  }

  function checkDeadlines(uint256 currentTime) external onlyClient {
    if (status != ContractStatus.Activated) {
      return;
    }

    for (uint256 i = 0; i < milestones.length; i++) {
      if (milestones[i].status == MilestoneStatus.InProgress) {
        if (currentTime > milestones[i].deadline) {
          milestones[i].status = MilestoneStatus.Failed;
          emit MilestoneStatusUpdated(i);
          terminateAgreement(shipper);
        }
        return;
      }
    }
  }

  function _inProgressMilestone(uint256 milestoneIndex) private view returns (Milestone storage milestone) {
    require(status == ContractStatus.Activated, "LogisticsContract: not activated");
    milestone = milestones[milestoneIndex];
    require(milestone.status == MilestoneStatus.InProgress, "LogisticsContract: milestone not in progress");
  }

  function _completeMilestone(uint256 milestoneIndex) private {
    Milestone storage milestone = milestones[milestoneIndex];
    milestone.status = MilestoneStatus.Completed;

    uint256 payoutShare = (totalPayoutValue * milestone.payoutPercent) / PERCENT_BASE;
    payoutRemaining -= payoutShare;

    transactions.push(
      Transaction({
        sender: escrow,
        receiver: carrier,
        amount: payoutShare,
        txType: TransactionType.Payoff,
        timestamp: block.timestamp
      })
    );

    IEscrow(escrow).releasePayment(payoutShare);
    emit MilestoneStatusUpdated(milestoneIndex);

    uint256 nextIndex = milestoneIndex + 1;
    if (nextIndex < milestones.length) {
      milestones[nextIndex].status = MilestoneStatus.InProgress;
    } else {
      status = ContractStatus.Completed;
      emit ContractCompleted();
    }
  }
}
