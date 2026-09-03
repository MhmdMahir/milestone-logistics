// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {MilestoneInput} from "./Types.sol";

interface IAgreementFactory {
  event AgreementCreated(address indexed agreement, address indexed shipper, address indexed carrier, uint256 totalPayoutValue);

  // One-time wiring: only callable while unset, so the deployer can point
  // this factory at the LogisticsClient it will trust as its caller-forwarder.
  function setClient(address _client) external;

  function client() external view returns (address);

  // `caller` is the real shipper, forwarded by the trusted LogisticsClient -
  // msg.sender here is always the client contract, never the user directly.
  // Deploys a LogisticsContract + its paired Escrow in one transaction and
  // pulls totalPayoutValue in payment tokens from `caller` into that escrow
  // immediately (caller must have approved this factory beforehand), so an
  // agreement can never exist unfunded.
  function createAgreement(
    address caller,
    address carrier,
    uint256 totalPayoutValue,
    uint256 duration,
    MilestoneInput[] calldata milestones
  ) external returns (address agreement);

  function listAgreementsByUser(address user) external view returns (address[] memory);
}
