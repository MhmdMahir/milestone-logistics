// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {Test} from "forge-std/Test.sol";
import {UserRegistry} from "./UserRegistry.sol";
import {UserProfile, UserRole} from "./interfaces/Types.sol";

contract UserRegistryTest is Test {
  UserRegistry registry;
  address client = address(0xC11E47);
  address shipperWallet = address(0xA11CE);
  address carrierWallet = address(0xB0B);

  function setUp() public {
    registry = new UserRegistry();
    registry.setClient(client);
  }

  function test_IsRegisteredFalseBeforeRegistration() public view {
    assertEq(registry.isRegistered(shipperWallet), false);
  }

  function test_RegisterStoresProfileUnderCallerWallet() public {
    vm.prank(client);
    registry.register(shipperWallet, "shipper@example.com", "Alice", UserRole.Shipper);

    assertEq(registry.isRegistered(shipperWallet), true);

    UserProfile memory profile = registry.getUser(shipperWallet);
    assertEq(profile.walletAddress, shipperWallet);
    assertEq(profile.mail, "shipper@example.com");
    assertEq(profile.name, "Alice");
    assertEq(uint256(profile.role), uint256(UserRole.Shipper));
  }

  function test_RevertWhen_RegisteringTwice() public {
    vm.startPrank(client);
    registry.register(shipperWallet, "shipper@example.com", "Alice", UserRole.Shipper);

    vm.expectRevert("UserRegistry: already registered");
    registry.register(shipperWallet, "shipper@example.com", "Alice", UserRole.Shipper);
    vm.stopPrank();
  }

  function test_RevertWhen_RegisterCalledByNonClient() public {
    vm.prank(shipperWallet);
    vm.expectRevert("UserRegistry: caller is not the client");
    registry.register(shipperWallet, "shipper@example.com", "Alice", UserRole.Shipper);
  }

  function test_LoginReturnsCallersProfile() public {
    vm.prank(client);
    registry.register(carrierWallet, "carrier@example.com", "Bob", UserRole.Carrier);

    vm.prank(client);
    UserProfile memory profile = registry.login(carrierWallet);

    assertEq(profile.walletAddress, carrierWallet);
    assertEq(profile.mail, "carrier@example.com");
    assertEq(uint256(profile.role), uint256(UserRole.Carrier));
  }

  function test_RevertWhen_LoginNotRegistered() public {
    vm.prank(client);
    vm.expectRevert("UserRegistry: not registered");
    registry.login(shipperWallet);
  }

  function test_RevertWhen_LoginCalledByNonClient() public {
    vm.prank(shipperWallet);
    vm.expectRevert("UserRegistry: caller is not the client");
    registry.login(shipperWallet);
  }

  function test_RevertWhen_SetClientCalledTwice() public {
    vm.expectRevert("UserRegistry: client already set");
    registry.setClient(address(0xBAD));
  }
}
