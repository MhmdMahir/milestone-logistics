// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {Test} from "forge-std/Test.sol";
import {AgreementFactory} from "./AgreementFactory.sol";
import {IAgreementFactory} from "./interfaces/IAgreementFactory.sol";
import {LogisticsContract} from "./LogisticsContract.sol";
import {Token} from "./Token.sol";
import {ContractStatus, MilestoneInput, MilestoneStatus} from "./interfaces/Types.sol";

contract AgreementFactoryTest is Test {
  AgreementFactory factory;
  Token token;

  address client = address(0xC11E47);
  address shipperWallet = address(0xA11CE);
  address carrierWallet = address(0xB0B);

  uint256 totalPayoutValue = 10 ether;

  function setUp() public {
    token = new Token();
    factory = new AgreementFactory(address(token));
    factory.setClient(client);

    vm.prank(shipperWallet);
    token.faucet();
    vm.prank(shipperWallet);
    token.approve(address(factory), type(uint256).max);
  }

  function _defaultMilestones() internal view returns (MilestoneInput[] memory milestones) {
    milestones = new MilestoneInput[](1);

    string[] memory checkpoints = new string[](1);
    checkpoints[0] = "Delivered";
    milestones[0] = MilestoneInput({deadline: block.timestamp + 1 days, payoutPercent: 100, title: "Only leg", checkpointDescriptions: checkpoints});
  }

  function test_RevertWhen_PaymentAllowanceIsInsufficient() public {
    vm.prank(shipperWallet);
    token.approve(address(factory), 1 ether);

    vm.prank(client);
    vm.expectRevert();
    factory.createAgreement(shipperWallet, carrierWallet, totalPayoutValue, 1 days, _defaultMilestones());
  }

  function test_RevertWhen_CreateAgreementCalledByNonClient() public {
    vm.prank(shipperWallet);
    vm.expectRevert("AgreementFactory: caller is not the client");
    factory.createAgreement(shipperWallet, carrierWallet, totalPayoutValue, 1 days, _defaultMilestones());
  }

  function test_CreateAgreementDeploysActivatedAndFundedAgreement() public {
    vm.prank(client);
    address agreementAddress = factory.createAgreement(
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
    address agreementAddress = factory.createAgreement(
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
    factory.createAgreement(shipperWallet, carrierWallet, totalPayoutValue, 1 days, _defaultMilestones());
  }

  function test_CreateAgreementPullsPaymentFromShipperIntoEscrow() public {
    uint256 shipperBalanceBefore = token.balanceOf(shipperWallet);

    vm.prank(client);
    address agreementAddress = factory.createAgreement(
      shipperWallet, carrierWallet, totalPayoutValue, 1 days, _defaultMilestones()
    );

    LogisticsContract agreement = LogisticsContract(agreementAddress);
    assertEq(token.balanceOf(shipperWallet), shipperBalanceBefore - totalPayoutValue);
    assertEq(token.balanceOf(agreement.escrow()), totalPayoutValue);
  }

  function test_RevertWhen_SetClientCalledTwice() public {
    vm.expectRevert("AgreementFactory: client already set");
    factory.setClient(address(0xBAD));
  }
}
