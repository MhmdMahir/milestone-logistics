// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {Test} from "forge-std/Test.sol";
import {Escrow} from "./Escrow.sol";
import {IEscrow} from "./interfaces/IEscrow.sol";
import {EscrowStatus} from "./interfaces/Types.sol";

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
  MockAgreement agreement;
  address shipperWallet = address(0xA11CE);
  address carrierWallet = address(0xB0B);
  address stranger = address(0xBAD);

  function setUp() public {
    agreement = new MockAgreement(shipperWallet, carrierWallet);
    escrow = new Escrow(address(agreement));
    vm.deal(address(this), 10 ether);
  }

  function test_LockFundIncreasesBalance() public {
    escrow.lockFund{value: 3 ether}();
    assertEq(escrow.balance(), 3 ether);
  }

  function test_RevertWhen_ReleasePaymentCalledByNonAgreement() public {
    escrow.lockFund{value: 1 ether}();

    vm.prank(stranger);
    vm.expectRevert("Escrow: caller is not the agreement");
    escrow.releasePayment(1 ether);
  }

  function test_ReleasePaymentSendsToCarrierAndEmits() public {
    escrow.lockFund{value: 1 ether}();
    uint256 before = carrierWallet.balance;

    vm.prank(address(agreement));
    vm.expectEmit(true, false, false, true, address(escrow));
    emit IEscrow.PaymentReleased(carrierWallet, 0.4 ether);
    escrow.releasePayment(0.4 ether);

    assertEq(carrierWallet.balance, before + 0.4 ether);
    assertEq(escrow.balance(), 0.6 ether);
  }

  function test_ReleasePaymentMarksReleasedWhenBalanceFullyDrained() public {
    escrow.lockFund{value: 1 ether}();

    vm.prank(address(agreement));
    escrow.releasePayment(1 ether);

    assertEq(uint256(escrow.status()), uint256(EscrowStatus.Released));
  }

  function test_RevertWhen_RefundCalledByNonAgreement() public {
    escrow.lockFund{value: 1 ether}();

    vm.prank(stranger);
    vm.expectRevert("Escrow: caller is not the agreement");
    escrow.refund();
  }

  function test_RefundSendsRemainingBalanceToShipperAndMarksRefunded() public {
    escrow.lockFund{value: 2 ether}();
    uint256 before = shipperWallet.balance;

    vm.prank(address(agreement));
    vm.expectEmit(true, false, false, true, address(escrow));
    emit IEscrow.Refunded(shipperWallet, 2 ether);
    escrow.refund();

    assertEq(shipperWallet.balance, before + 2 ether);
    assertEq(escrow.balance(), 0);
    assertEq(uint256(escrow.status()), uint256(EscrowStatus.Refunded));
  }

  function test_RevertWhen_ReleasePaymentAfterRefunded() public {
    escrow.lockFund{value: 1 ether}();

    vm.startPrank(address(agreement));
    escrow.refund();

    vm.expectRevert("Escrow: not locked");
    escrow.releasePayment(0.1 ether);
    vm.stopPrank();
  }

  function test_RevertWhen_LockFundCalledAfterRefunded() public {
    escrow.lockFund{value: 1 ether}();

    vm.prank(address(agreement));
    escrow.refund();

    vm.expectRevert("Escrow: not locked");
    escrow.lockFund{value: 1 ether}();
  }
}
