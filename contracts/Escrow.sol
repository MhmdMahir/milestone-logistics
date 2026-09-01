// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {IEscrow} from "./interfaces/IEscrow.sol";
import {EscrowStatus} from "./interfaces/Types.sol";

contract Escrow is IEscrow {
  function balance() external view returns (uint256 amount) {}

  function status() external view returns (EscrowStatus escrowStatus) {}

  function lockFund() external payable {}

  function releasePayment(address payable to, uint256 amount) external {}

  function refund(address payable to) external {}
}
