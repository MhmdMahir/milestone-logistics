// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {Test} from "forge-std/Test.sol";
import {AgreementFactory} from "./AgreementFactory.sol";
import {IAgreementFactory} from "./interfaces/IAgreementFactory.sol";
import {LogisticsContract} from "./LogisticsContract.sol";
import {ContractStatus, MilestoneInput, MilestoneStatus} from "./interfaces/Types.sol";

contract AgreementFactoryTest is Test {
  AgreementFactory factory;

  address client = address(0xC11E47);
  address shipperWallet = address(0xA11CE);
  address carrierWallet = address(0xB0B);

  uint256 totalPayoutValue = 10 ether;

  function setUp() public {
    factory = new AgreementFactory();
    factory.setClient(client);
    vm.deal(client, 20 ether);
  }

  function _defaultMilestones() internal view returns (MilestoneInput[] memory milestones) {
    milestones = new MilestoneInput[](1);

    string[] memory checkpoints = new string[](1);
    checkpoints[0] = "Delivered";
    milestones[0] = MilestoneInput({deadline: block.timestamp + 1 days, payoutPercent: 100, title: "Only leg", checkpointDescriptions: checkpoints});
  }

  function test_RevertWhen_PaymentDoesNotMatchTotalPayoutValue() public {
    vm.prank(client);
    vm.expectRevert("AgreementFactory: incorrect payment");
    factory.createAgreement{value: 1 ether}(shipperWallet, carrierWallet, totalPayoutValue, 1 days, _defaultMilestones());
  }

  function test_RevertWhen_CreateAgreementCalledByNonClient() public {
    vm.deal(shipperWallet, 20 ether);
    vm.prank(shipperWallet);
    vm.expectRevert("AgreementFactory: caller is not the client");
    factory.createAgreement{value: totalPayoutValue}(shipperWallet, carrierWallet, totalPayoutValue, 1 days, _defaultMilestones());
  }

  function test_CreateAgreementDeploysActivatedAndFundedAgreement() public {
    vm.prank(client);
    address agreementAddress = factory.createAgreement{value: totalPayoutValue}(
      shipperWallet, carrierWallet, totalPayoutValue, 1 days, _defaultMilestones()
    );

    LogisticsContract agreement = LogisticsContract(agreementAddress);
    assertEq(agreement.shipper(), shipperWallet);
    assertEq(agreement.carrier(), carrierWallet);
    assertEq(agreement.client(), client);
    assertEq(uint256(agreement.status()), uint256(ContractStatus.Activated));
    assertEq(uint256(agreement.getMilestone(0).status), uint256(MilestoneStatus.InProgress));
  }

  function test_CreateAgreementRecordsItForBothParties() public {
    vm.prank(client);
    address agreementAddress = factory.createAgreement{value: totalPayoutValue}(
      shipperWallet, carrierWallet, totalPayoutValue, 1 days, _defaultMilestones()
    );

    address[] memory shipperAgreements = factory.listAgreementsByUser(shipperWallet);
    address[] memory carrierAgreements = factory.listAgreementsByUser(carrierWallet);

    assertEq(shipperAgreements.length, 1);
    assertEq(shipperAgreements[0], agreementAddress);
    assertEq(carrierAgreements.length, 1);
    assertEq(carrierAgreements[0], agreementAddress);
  }

  function test_CreateAgreementEmitsAgreementCreatedEvent() public {
    vm.prank(client);
    vm.expectEmit(false, true, true, true, address(factory));
    emit IAgreementFactory.AgreementCreated(address(0), shipperWallet, carrierWallet, totalPayoutValue);
    factory.createAgreement{value: totalPayoutValue}(shipperWallet, carrierWallet, totalPayoutValue, 1 days, _defaultMilestones());
  }

  function test_RevertWhen_SetClientCalledTwice() public {
    vm.expectRevert("AgreementFactory: client already set");
    factory.setClient(address(0xBAD));
  }
}
