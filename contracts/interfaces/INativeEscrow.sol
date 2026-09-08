// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {EscrowStatus} from "./Types.sol";

interface INativeEscrow {
  event FundLocked(address indexed from, uint256 amount);
  event PaymentReleased(address indexed to, uint256 amount);
  event Refunded(address indexed to, uint256 amount);

  function agreement() external view returns (address);

  function balance() external view returns (uint256);

  function status() external view returns (EscrowStatus);

  // Native-ETH funding ABI. The ERC-20 IEscrow.lockFund(uint256) remains
  // unchanged for the original token-based escrow implementation.
  function lockFund() external payable;

  function releasePayment(uint256 amount) external;

  function refund() external;
}