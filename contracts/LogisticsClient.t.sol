// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {Test} from "forge-std/Test.sol";
import {LogisticsClient} from "./LogisticsClient.sol";
import {UserRegistry} from "./UserRegistry.sol";
import {UserProfile, UserRole} from "./interfaces/Types.sol";

contract LogisticsClientTest is Test {
    UserRegistry registry;
    LogisticsClient logisticsClient;

    address user1 = address(0xA11CE);
    address user2 = address(0xB0B);

    function setUp() public {
        registry = new UserRegistry();

        // AgreementFactory is not needed for Login/Register tests,
        // so address(0) is sufficient here.
        logisticsClient = new LogisticsClient(
            address(registry),
            address(0)
        );

        // Tell UserRegistry that LogisticsClient is the trusted client.
        registry.setClient(address(logisticsClient));
    }

    function test_RegisterThroughLogisticsClient() public {
        vm.prank(user1);

        logisticsClient.register(
            "alice@example.com",
            "Alice",
            UserRole.Shipper
        );

        UserProfile memory profile = registry.getUser(user1);

        assertEq(profile.walletAddress, user1);
        assertEq(profile.mail, "alice@example.com");
        assertEq(profile.name, "Alice");
        assertEq(uint256(profile.role), uint256(UserRole.Shipper));
    }

    function test_LoginThroughLogisticsClient() public {
        vm.prank(user1);

        logisticsClient.register(
            "alice@example.com",
            "Alice",
            UserRole.Shipper
        );

        vm.prank(user1);

        UserProfile memory profile = logisticsClient.login();

        assertEq(profile.walletAddress, user1);
        assertEq(profile.mail, "alice@example.com");
        assertEq(profile.name, "Alice");
        assertEq(uint256(profile.role), uint256(UserRole.Shipper));
    }

    function test_LoginThroughLogisticsClientRevertsWhenNotRegistered() public {
        vm.prank(user1);

        vm.expectRevert("UserRegistry: not registered");

        logisticsClient.login();
    }

    function test_RegisterThroughLogisticsClientRejectsDuplicateName() public {
        vm.startPrank(user1);

        logisticsClient.register(
            "alice@example.com",
            "Alice",
            UserRole.Shipper
        );

        vm.stopPrank();

        vm.prank(user2);

        vm.expectRevert("UserRegistry: name already exists");

        logisticsClient.register(
            "bob@example.com",
            "Alice",
            UserRole.Carrier
        );
    }
}