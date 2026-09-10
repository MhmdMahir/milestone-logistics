// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {INativeEscrow} from "./interfaces/INativeEscrow.sol";
import {IAgreementInfo} from "./interfaces/IAgreementInfo.sol";
import {EscrowStatus} from "./interfaces/Types.sol";

/// Native-ETH escrow path for the refund demo.
/// The existing ERC-20 Escrow.sol is intentionally preserved unchanged.
contract NativeEscrow is INativeEscrow {
  address public agreement;
  EscrowStatus public status;

  modifier onlyAgreement() {
    require(msg.sender == agreement, "NativeEscrow: caller is not the agreement");
    _;
  }

  constructor(address _agreement) {
    agreement = _agreement;
  }

  function balance() external view returns (uint256) {
    return address(this).balance;
  }

  function lockFund() external payable {
    emit FundLocked(msg.sender, msg.value);
  }

  function releasePayment(uint256 amount) external onlyAgreement {
    require(status == EscrowStatus.Locked, "NativeEscrow: not locked");

    address to = IAgreementInfo(agreement).carrier();
    if (address(this).balance == amount) {
      status = EscrowStatus.Released;
    }
    (bool success,) = payable(to).call{value: amount}("");
    require(success, "NativeEscrow: transfer failed");

    emit PaymentReleased(to, amount);
  }

  function refund() external onlyAgreement {
    require(status == EscrowStatus.Locked, "NativeEscrow: not locked");

    address to = IAgreementInfo(agreement).shipper();
    uint256 amount = address(this).balance;
    status = EscrowStatus.Refunded;
    (bool success,) = payable(to).call{value: amount}("");
    require(success, "NativeEscrow: transfer failed");

    emit Refunded(to, amount);
  }
}