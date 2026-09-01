// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {ContractStatus, Milestone, MilestoneInput, Transaction} from "./Types.sol";

interface ILogisticsContract {
  event ContractActivated();
  event ContractTerminated();
  event ContractCompleted();
  event CheckpointRequested(uint256 indexed milestoneIndex, uint256 indexed checkpointIndex);
  event CheckpointApproved(uint256 indexed milestoneIndex, uint256 indexed checkpointIndex);
  event MilestoneStatusUpdated(uint256 indexed milestoneIndex);

  function shipper() external view returns (address);

  function carrier() external view returns (address);

  function escrow() external view returns (address);

  function totalPayoutValue() external view returns (uint256);

  function duration() external view returns (uint256);

  function payoutRemaining() external view returns (uint256);

  function status() external view returns (ContractStatus);

  function milestoneCount() external view returns (uint256);

  function getMilestone(uint256 index) external view returns (Milestone memory);

  function getTransactions() external view returns (Transaction[] memory);

  // Called once by the factory right after both this contract and its
  // paired Escrow are deployed, and again once funds have actually landed
  // in escrow (moves status from Pending -> Activated).
  function setEscrow(address escrowAddress) external;

  function activateContract() external;

  function terminateContract() external;

  // Carrier flags a checkpoint as ready for review.
  function requestCheckpoint(uint256 milestoneIndex, uint256 checkpointIndex) external;

  // Shipper confirms a requested checkpoint. Once every checkpoint in a
  // milestone is approved, the milestone is marked Completed and its
  // payout share is released from escrow to the carrier.
  function approveCheckpoint(uint256 milestoneIndex, uint256 checkpointIndex) external;

  // Keeper-style entrypoint: anyone may call this to evaluate whether any
  // in-progress milestone has passed its deadline without completing. On
  // failure it terminates the agreement and triggers an escrow refund to
  // the shipper. Solidity has no native scheduler, so this must be poked
  // externally (frontend polling, or a keeper bot / Chainlink Automation).
  function checkDeadlines() external;
}
