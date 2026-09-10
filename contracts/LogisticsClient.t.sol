// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {Test} from "forge-std/Test.sol";
import {LogisticsClient} from "./LogisticsClient.sol";
import {NativeAgreementFactory} from "./NativeAgreementFactory.sol";
import {UserRegistry} from "./UserRegistry.sol";
import {LogisticsContract} from "./LogisticsContract.sol";
import {ContractStatus, MilestoneInput, MilestoneStatus, TransactionType, UserRole} from "./interfaces/Types.sol";

contract LogisticsClientTest is Test {
  UserRegistry registry;
  NativeAgreementFactory factory;
  LogisticsClient client;

  address shipper = address(0xA11CE);
  address carrier = address(0xB0B);
  address keeper = address(0xC0FFEE);
  uint256 totalPayout = 1 ether;

  function setUp() public {
    registry = new UserRegistry();
    factory = new NativeAgreementFactory();
    client = new LogisticsClient(address(registry), address(factory));
    registry.setClient(address(client));
    factory.setClient(address(client));
    vm.deal(shipper, 2 ether);
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

  function test_CreatesNativeAgreementAndRefundsAfterIncompleteDeadline() public {
    vm.prank(shipper);
    client.register("shipper@example.com", "Alice", UserRole.Shipper);

    vm.prank(shipper);
    address agreementAddress = client.createAgreement{value: totalPayout}(carrier, totalPayout, 1 days, _milestones());
    LogisticsContract agreement = LogisticsContract(agreementAddress);

    assertEq(uint256(agreement.status()), uint256(ContractStatus.Activated));
    assertEq(agreement.payoutRemaining(), totalPayout);

    uint256 shipperBefore = shipper.balance;
    vm.warp(block.timestamp + 1 days + 1);

    vm.prank(keeper);
    client.checkDeadlines(agreementAddress);

    assertEq(uint256(agreement.status()), uint256(ContractStatus.Terminated));
    assertEq(uint256(agreement.getMilestone(0).status), uint256(MilestoneStatus.Failed));
    assertEq(agreement.payoutRemaining(), totalPayout);
    assertEq(shipper.balance, shipperBefore + totalPayout);
    assertEq(uint256(agreement.getTransactions()[1].txType), uint256(TransactionType.Refund));
  }
}
