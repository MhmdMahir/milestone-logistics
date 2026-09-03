// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {Test} from "forge-std/Test.sol";
import {PaymentToken} from "./PaymentToken.sol";

contract PaymentTokenTest is Test {
  PaymentToken token;
  address alice = address(0xA11CE);
  address bob = address(0xB0B);

  function setUp() public {
    token = new PaymentToken();
  }

  function test_FaucetMintsFixedAmountToCaller() public {
    vm.prank(alice);
    token.faucet();

    assertEq(token.balanceOf(alice), token.FAUCET_AMOUNT());
  }

  function test_FaucetCanBeCalledByAnyAddress() public {
    vm.prank(alice);
    token.faucet();

    vm.prank(bob);
    token.faucet();

    assertEq(token.balanceOf(alice), token.FAUCET_AMOUNT());
    assertEq(token.balanceOf(bob), token.FAUCET_AMOUNT());
  }

  function test_FaucetIsAdditiveAcrossMultipleCalls() public {
    vm.startPrank(alice);
    token.faucet();
    token.faucet();
    vm.stopPrank();

    assertEq(token.balanceOf(alice), token.FAUCET_AMOUNT() * 2);
  }

  function test_NameAndSymbol() public view {
    assertEq(token.name(), "Payment Token");
    assertEq(token.symbol(), "PAY");
  }
}
