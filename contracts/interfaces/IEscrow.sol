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

  // Amount already sits in this escrow (moved there by the caller, e.g.
  // AgreementFactory pulling from the shipper via transferFrom) - this just
  // records/confirms it arrived.
  function lockFund(uint256 amount) external;

  function releasePayment(uint256 amount) external;

  function refund() external;
}
