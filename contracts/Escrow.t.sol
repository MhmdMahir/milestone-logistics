// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {Test} from "forge-std/Test.sol";
import {Escrow} from "./Escrow.sol";
import {IEscrow} from "./interfaces/IEscrow.sol";
import {EscrowStatus} from "./interfaces/Types.sol";
import {PaymentToken} from "./PaymentToken.sol";

contract MockAgreement {
  address public shipper;
  address public carrier;

  constructor(address _shipper, address _carrier) {
    shipper = _shipper;
    carrier = _carrier;
  }
}

contract EscrowTest is Test {
  Escrow escrow;
  PaymentToken token;
  MockAgreement agreement;
  address shipperWallet = address(0xA11CE);
  address carrierWallet = address(0xB0B);
  address stranger = address(0xBAD);

  function setUp() public {
    agreement = new MockAgreement(shipperWallet, carrierWallet);
    token = new PaymentToken();
    escrow = new Escrow(address(agreement), address(token));
    token.faucet(); // gives address(this) PaymentToken.FAUCET_AMOUNT (1000e18)
  }

  // Mirrors what AgreementFactory really does: move tokens into escrow,
  // then tell it how much just arrived.
  function _fund(uint256 amount) internal {
    token.transfer(address(escrow), amount);
    escrow.lockFund(amount);
  }

  function test_LockFundIncreasesBalance() public {
    _fund(3 ether);
    assertEq(escrow.balance(), 3 ether);
  }

  function test_RevertWhen_ReleasePaymentCalledByNonAgreement() public {
    _fund(1 ether);

    vm.prank(stranger);
    vm.expectRevert("Escrow: caller is not the agreement");
    escrow.releasePayment(1 ether);
  }

  function test_ReleasePaymentSendsToCarrierAndEmits() public {
    _fund(1 ether);
    uint256 before = token.balanceOf(carrierWallet);

    vm.prank(address(agreement));
    vm.expectEmit(true, false, false, true, address(escrow));
    emit IEscrow.PaymentReleased(carrierWallet, 0.4 ether);
    escrow.releasePayment(0.4 ether);

    assertEq(token.balanceOf(carrierWallet), before + 0.4 ether);
    assertEq(escrow.balance(), 0.6 ether);
  }

  function test_ReleasePaymentMarksReleasedWhenBalanceFullyDrained() public {
    _fund(1 ether);

    vm.prank(address(agreement));
    escrow.releasePayment(1 ether);

    assertEq(uint256(escrow.status()), uint256(EscrowStatus.Released));
  }

  function test_RevertWhen_RefundCalledByNonAgreement() public {
    _fund(1 ether);

    vm.prank(stranger);
    vm.expectRevert("Escrow: caller is not the agreement");
    escrow.refund();
  }

  function test_RefundSendsRemainingBalanceToShipperAndMarksRefunded() public {
    _fund(2 ether);
    uint256 before = token.balanceOf(shipperWallet);

    vm.prank(address(agreement));
    vm.expectEmit(true, false, false, true, address(escrow));
    emit IEscrow.Refunded(shipperWallet, 2 ether);
    escrow.refund();

    assertEq(token.balanceOf(shipperWallet), before + 2 ether);
    assertEq(escrow.balance(), 0);
    assertEq(uint256(escrow.status()), uint256(EscrowStatus.Refunded));
  }

  function test_RevertWhen_ReleasePaymentAfterRefunded() public {
    _fund(1 ether);

    vm.startPrank(address(agreement));
    escrow.refund();

    vm.expectRevert("Escrow: not locked");
    escrow.releasePayment(0.1 ether);
    vm.stopPrank();
  }
}
