// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {MilestoneInput} from "./Types.sol";

interface IAgreementFactory {
  event AgreementCreated(address indexed agreement, address indexed shipper, address indexed carrier, uint256 totalPayoutValue);

  // Deploys a LogisticsContract + its paired Escrow in one transaction and
  // locks msg.value (must equal totalPayoutValue) into escrow immediately,
  // so an agreement can never exist unfunded.
  function createAgreement(
    address carrier,
    uint256 totalPayoutValue,
    uint256 duration,
    MilestoneInput[] calldata milestones
  ) external payable returns (address agreement);

  function listAgreements() external view returns (address[] memory);

  function listAgreementsByUser(address user) external view returns (address[] memory);
}
