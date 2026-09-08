// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IEscrow} from "./interfaces/IEscrow.sol";
import {IAgreementInfo} from "./interfaces/IAgreementInfo.sol";
import {EscrowStatus} from "./interfaces/Types.sol";

contract Escrow is IEscrow {
  address public agreement;
  IERC20 public immutable token;
  EscrowStatus public status;

  modifier onlyAgreement() {
    require(msg.sender == agreement, "Escrow: caller is not the agreement");
    _;
  }

  constructor(address _agreement, address _token) {
    agreement = _agreement;
    token = IERC20(_token);
  }

  function balance() external view returns (uint256) {
    return token.balanceOf(address(this));
  }

  function lockFund(uint256 amount) external {
    emit FundLocked(msg.sender, amount);
  }

  function releasePayment(uint256 amount) external onlyAgreement {
    require(status == EscrowStatus.Locked, "Escrow: not locked");

    address to = IAgreementInfo(agreement).carrier();
    if (token.balanceOf(address(this)) == amount) {
      status = EscrowStatus.Released;
    }
    require(token.transfer(to, amount), "Escrow: transfer failed");

    emit PaymentReleased(to, amount);
  }

  function refund() external onlyAgreement {
    require(status == EscrowStatus.Locked, "Escrow: not locked");

    address to = IAgreementInfo(agreement).shipper();
    uint256 amount = token.balanceOf(address(this));
    status = EscrowStatus.Refunded;
    require(token.transfer(to, amount), "Escrow: transfer failed");

    emit Refunded(to, amount);
  }
}
