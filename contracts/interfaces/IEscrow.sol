// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {EscrowStatus} from "./Types.sol";

interface IEscrow {
  event FundLocked(address indexed from, uint256 amount);
  event PaymentReleased(address indexed to, uint256 amount);
  event Refunded(address indexed to, uint256 amount);

  // The LogisticsContract this escrow is bound to. Only that address may
  // trigger releasePayment/refund — payees are resolved from its state,
  // never taken as caller-supplied input.
  function agreement() external view returns (address);

  function balance() external view returns (uint256);

  function status() external view returns (EscrowStatus);

  function lockFund() external payable;

  function releasePayment(uint256 amount) external;

  function refund() external;
}
