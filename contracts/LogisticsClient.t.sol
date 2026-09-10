// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {Test} from "forge-std/Test.sol";
import {LogisticsClient} from "./LogisticsClient.sol";
import {AgreementFactory} from "./AgreementFactory.sol";
import {Token} from "./Token.sol";
import {UserRegistry} from "./UserRegistry.sol";
import {LogisticsContract} from "./LogisticsContract.sol";
import {ContractStatus, MilestoneInput, MilestoneStatus, TransactionType, UserProfile, UserRole} from "./interfaces/Types.sol";

contract LogisticsClientTest is Test {
  UserRegistry registry;
  AgreementFactory factory;
  Token token;
  LogisticsClient client;

  address shipper = address(0xA11CE);
  address carrier = address(0xB0B);
  address keeper = address(0xC0FFEE);
  address user2 = address(0xB0B2);
  uint256 totalPayout = 1 ether;

  function setUp() public {
    registry = new UserRegistry();
    token = new Token();
    factory = new AgreementFactory(address(token));
    client = new LogisticsClient(address(registry), address(factory));
    registry.setClient(address(client));
    factory.setClient(address(client));

    vm.prank(shipper);
    token.faucet();
  }

  function _milestones() internal view returns (MilestoneInput[] memory milestones) {
    milestones = new MilestoneInput[](1);
    string[] memory checkpoints = new string[](2);
    checkpoints[0] = "Pickup confirmed";
    checkpoints[1] = "Delivered";
    milestones[0] = MilestoneInput({
      deadline: block.timestamp + 1 days,
      payoutPercent: 100,
      title: "Delivery",
      checkpointDescriptions: checkpoints
    });
  }

  function test_ForwardsRegistrationAndLogin() public {
    vm.prank(shipper);
    client.register("shipper@example.com", "Alice", UserRole.Shipper);

    vm.prank(shipper);
    assertEq(client.login().walletAddress, shipper);
  }

  function test_CreatesAgreementAndRefundsAfterIncompleteDeadline() public {
    vm.prank(shipper);
    client.register("shipper@example.com", "Alice", UserRole.Shipper);

    vm.prank(carrier);
    client.register("carrier@example.com", "Bob", UserRole.Carrier);

    vm.prank(shipper);
    token.approve(address(factory), totalPayout);

    vm.prank(shipper);
    address agreementAddress = client.createAgreement(carrier, totalPayout, 1 days, _milestones());
    LogisticsContract agreement = LogisticsContract(agreementAddress);

    assertEq(uint256(agreement.status()), uint256(ContractStatus.Activated));
    assertEq(agreement.payoutRemaining(), totalPayout);

    uint256 shipperBefore = token.balanceOf(shipper);
    vm.warp(block.timestamp + 1 days + 1);

    vm.prank(keeper);
    client.checkDeadlines(agreementAddress, block.timestamp);

    assertEq(uint256(agreement.status()), uint256(ContractStatus.Terminated));
    assertEq(uint256(agreement.getMilestone(0).status), uint256(MilestoneStatus.Failed));
    assertEq(agreement.payoutRemaining(), totalPayout);
    assertEq(token.balanceOf(shipper), shipperBefore + totalPayout);
    assertEq(uint256(agreement.getTransactions()[1].txType), uint256(TransactionType.Refund));
  }

  function test_RegisterThroughLogisticsClient() public {
    vm.prank(shipper);

    client.register("alice@example.com", "Alice", UserRole.Shipper);

    UserProfile memory profile = registry.getUser(shipper);

    assertEq(profile.walletAddress, shipper);
    assertEq(profile.mail, "alice@example.com");
    assertEq(profile.name, "Alice");
    assertEq(uint256(profile.role), uint256(UserRole.Shipper));
  }

  function test_LoginThroughLogisticsClient() public {
    vm.prank(shipper);

    client.register("alice@example.com", "Alice", UserRole.Shipper);

    vm.prank(shipper);

    UserProfile memory profile = client.login();

    assertEq(profile.walletAddress, shipper);
    assertEq(profile.mail, "alice@example.com");
    assertEq(profile.name, "Alice");
    assertEq(uint256(profile.role), uint256(UserRole.Shipper));
  }

  function test_LoginThroughLogisticsClientRevertsWhenNotRegistered() public {
    vm.prank(shipper);

    vm.expectRevert("UserRegistry: not registered");

    client.login();
  }

  function test_RegisterThroughLogisticsClientRejectsDuplicateName() public {
    vm.startPrank(shipper);

    client.register("alice@example.com", "Alice", UserRole.Shipper);

    vm.stopPrank();

    vm.prank(user2);

    vm.expectRevert("UserRegistry: name already exists");

    client.register("bob@example.com", "Alice", UserRole.Carrier);
  }
}
