// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {Test} from "forge-std/Test.sol";
import {UserRegistry} from "./UserRegistry.sol";
import {UserProfile, UserRole} from "./interfaces/Types.sol";

contract UserRegistryTest is Test {
  UserRegistry registry;
  address shipperWallet = address(0xA11CE);
  address carrierWallet = address(0xB0B);

  function setUp() public {
    registry = new UserRegistry();
  }

  function test_IsRegisteredFalseBeforeRegistration() public view {
    assertEq(registry.isRegistered(shipperWallet), false);
  }

  function test_RegisterStoresProfileUnderCallerWallet() public {
    vm.prank(shipperWallet);
    registry.register("shipper@example.com", "Alice", UserRole.Shipper);

    assertEq(registry.isRegistered(shipperWallet), true);

    UserProfile memory profile = registry.getUser(shipperWallet);
    assertEq(profile.walletAddress, shipperWallet);
    assertEq(profile.mail, "shipper@example.com");
    assertEq(profile.name, "Alice");
    assertEq(uint256(profile.role), uint256(UserRole.Shipper));
  }

  function test_RevertWhen_RegisteringTwice() public {
    vm.startPrank(shipperWallet);
    registry.register("shipper@example.com", "Alice", UserRole.Shipper);

    vm.expectRevert("UserRegistry: already registered");
    registry.register("shipper@example.com", "Alice", UserRole.Shipper);
    vm.stopPrank();
  }

  function test_LoginReturnsCallersProfile() public {
    vm.startPrank(carrierWallet);
    registry.register("carrier@example.com", "Bob", UserRole.Carrier);

    UserProfile memory profile = registry.login();
    vm.stopPrank();

    assertEq(profile.walletAddress, carrierWallet);
    assertEq(profile.mail, "carrier@example.com");
    assertEq(uint256(profile.role), uint256(UserRole.Carrier));
  }

  function test_RevertWhen_LoginNotRegistered() public {
    vm.prank(shipperWallet);
    vm.expectRevert("UserRegistry: not registered");
    registry.login();
  }
}
