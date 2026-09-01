// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {EscrowStatus} from "./Types.sol";

interface IEscrow {
  event PaymentReleased(address indexed to, uint256 amount);
  event FundLocked(address indexed from, uint256 amount);
  event Refunded(address indexed to, uint256 amount);

  function balance() external view returns (uint256);

  function status() external view returns (EscrowStatus);

  function lockFund() external payable;

  function releasePayment(address payable to, uint256 amount) external;

  function refund(address payable to) external;
}
