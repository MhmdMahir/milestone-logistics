// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {ContractStatus, Milestone, Transaction} from "./Types.sol";

interface ILogisticsContract {
  event ContractCreated(address indexed shipper, address indexed carrier, uint256 totalPayoutValue);
  event ContractActivated();
  event ContractTerminated();
  event MilestoneUpdated(uint256 indexed milestoneIndex);

  function shipper() external view returns (address);

  function carrier() external view returns (address);

  function totalPayoutValue() external view returns (uint256);

  function duration() external view returns (uint256);

  function payoutRemaining() external view returns (uint256);

  function status() external view returns (ContractStatus);

  function milestoneCount() external view returns (uint256);

  function getMilestone(uint256 index) external view returns (Milestone memory);

  function getTransactions() external view returns (Transaction[] memory);

  function activateContract() external;

  function terminateContract() external;

  function updateMilestone(uint256 index, bool checkpointCompleted, uint256 checkpointIndex) external;
}
