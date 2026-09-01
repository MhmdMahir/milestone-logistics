// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {ILogisticsContract} from "./interfaces/ILogisticsContract.sol";
import {ContractStatus, Milestone, Transaction} from "./interfaces/Types.sol";

contract LogisticsContract is ILogisticsContract {
  address public shipper;
  address public carrier;
  uint256 public totalPayoutValue;
  uint256 public duration;
  uint256 public payoutRemaining;
  ContractStatus public status;

  Milestone[] private milestones;
  Transaction[] private transactions;

  constructor(address _shipper, address _carrier, uint256 _totalPayoutValue, uint256 _duration) {}

  function milestoneCount() external view returns (uint256 count) {}

  function getMilestone(uint256 index) external view returns (Milestone memory milestone) {}

  function getTransactions() external view returns (Transaction[] memory txs) {}

  function activateContract() external {}

  function terminateContract() external {}

  function updateMilestone(uint256 index, bool checkpointCompleted, uint256 checkpointIndex) external {}
}
