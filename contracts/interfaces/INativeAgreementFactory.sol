// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {MilestoneInput} from "./Types.sol";

interface INativeAgreementFactory {
  event AgreementCreated(address indexed agreement, address indexed shipper, address indexed carrier, uint256 totalPayoutValue);

  function setClient(address _client) external;

  function client() external view returns (address);

  // Native-ETH variant of the agreement factory. The original ERC-20
  // AgreementFactory remains unchanged and uses IAgreementFactory instead.
  function createAgreement(
    address caller,
    address carrier,
    uint256 totalPayoutValue,
    uint256 duration,
    MilestoneInput[] calldata milestones
  ) external payable returns (address agreement);

  function listAgreementsByUser(address user) external view returns (address[] memory);
}