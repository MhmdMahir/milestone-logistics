// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {Test} from "forge-std/Test.sol";
import {LogisticsContract} from "./LogisticsContract.sol";
import {Escrow} from "./Escrow.sol";
import {PaymentToken} from "./PaymentToken.sol";
import {ContractStatus, Milestone, MilestoneInput, MilestoneStatus, EscrowStatus} from "./interfaces/Types.sol";

contract LogisticsContractTest is Test {
  LogisticsContract logistics;
  Escrow escrow;
  PaymentToken token;

  address factory = address(0xFACADE);
  address client = address(0xC11E47);
  address shipperWallet = address(0xA11CE);
  address carrierWallet = address(0xB0B);
  address stranger = address(0xBAD);

  uint256 totalPayoutValue = 10 ether;
  uint256 start;
  uint256 milestone0Deadline;
  uint256 milestone1Deadline;

  function setUp() public {
    start = block.timestamp;
    milestone0Deadline = start + 1 days;
    milestone1Deadline = start + 2 days;

    token = new PaymentToken();
    vm.prank(shipperWallet);
    token.faucet();

    vm.prank(factory);
    logistics = new LogisticsContract(shipperWallet, carrierWallet, totalPayoutValue, 2 days, _defaultMilestones(), client);

    escrow = new Escrow(address(logistics), address(token));

    vm.prank(factory);
    logistics.setEscrow(address(escrow));
  }

  function _defaultMilestones() internal view returns (MilestoneInput[] memory milestones) {
    milestones = new MilestoneInput[](2);

    string[] memory checkpoints0 = new string[](2);
    checkpoints0[0] = "Pickup confirmed";
    checkpoints0[1] = "In transit";
    milestones[0] = MilestoneInput({deadline: milestone0Deadline, payoutPercent: 40, title: "Leg 1", checkpointDescriptions: checkpoints0});

    string[] memory checkpoints1 = new string[](1);
    checkpoints1[0] = "Delivered";
    milestones[1] = MilestoneInput({deadline: milestone1Deadline, payoutPercent: 60, title: "Leg 2", checkpointDescriptions: checkpoints1});
  }

  function _fundAndActivate() internal {
    vm.prank(shipperWallet);
    token.transfer(address(escrow), totalPayoutValue);

    vm.prank(shipperWallet);
    escrow.lockFund(totalPayoutValue);

    vm.prank(factory);
    logistics.activateContract();
  }

  function test_RevertWhen_PayoutPercentagesDoNotSumTo100() public {
    MilestoneInput[] memory milestones = _defaultMilestones();
    milestones[1].payoutPercent = 50;

    vm.prank(factory);
    vm.expectRevert("LogisticsContract: payout percentages must sum to 100");
    new LogisticsContract(shipperWallet, carrierWallet, totalPayoutValue, 2 days, milestones, client);
  }

  function test_RevertWhen_SetEscrowCalledByNonFactory() public {
    Escrow otherEscrow = new Escrow(address(logistics), address(token));

    vm.prank(stranger);
    vm.expectRevert("LogisticsContract: caller is not the factory");
    logistics.setEscrow(address(otherEscrow));
  }

  function test_RevertWhen_ActivateContractCalledBeforeFullyFunded() public {
    vm.prank(shipperWallet);
    token.transfer(address(escrow), 1 ether);

    vm.prank(shipperWallet);
    escrow.lockFund(1 ether);

    vm.prank(factory);
    vm.expectRevert("LogisticsContract: escrow not fully funded");
    logistics.activateContract();
  }

  function test_ActivateContractStartsFirstMilestone() public {
    _fundAndActivate();

    assertEq(uint256(logistics.status()), uint256(ContractStatus.Activated));
    Milestone memory m0 = logistics.getMilestone(0);
    assertEq(uint256(m0.status), uint256(MilestoneStatus.InProgress));
  }

  function test_RevertWhen_RequestCheckpointCalledByNonClient() public {
    _fundAndActivate();

    vm.prank(carrierWallet);
    vm.expectRevert("LogisticsContract: caller is not the client");
    logistics.requestCheckpoint(carrierWallet, 0, 0);
  }

  function test_RevertWhen_RequestCheckpointCalledByNonCarrier() public {
    _fundAndActivate();

    vm.prank(client);
    vm.expectRevert("LogisticsContract: caller is not the carrier");
    logistics.requestCheckpoint(stranger, 0, 0);
  }

  function test_RevertWhen_ApproveCheckpointCalledByNonShipper() public {
    _fundAndActivate();

    vm.prank(client);
    logistics.requestCheckpoint(carrierWallet, 0, 0);

    vm.prank(client);
    vm.expectRevert("LogisticsContract: caller is not the shipper");
    logistics.approveCheckpoint(stranger, 0, 0);
  }

  function test_RevertWhen_ApproveCheckpointNotYetRequested() public {
    _fundAndActivate();

    vm.prank(client);
    vm.expectRevert("LogisticsContract: checkpoint not requested");
    logistics.approveCheckpoint(shipperWallet, 0, 0);
  }

  function test_ApprovingAllCheckpointsCompletesMilestoneAndReleasesPayout() public {
    _fundAndActivate();
    uint256 carrierBefore = carrierWallet.balance;

    vm.prank(client);
    logistics.requestCheckpoint(carrierWallet, 0, 0);
    vm.prank(client);
    logistics.approveCheckpoint(shipperWallet, 0, 0);

    // one checkpoint still outstanding - milestone not complete yet
    assertEq(uint256(logistics.getMilestone(0).status), uint256(MilestoneStatus.InProgress));

    vm.prank(client);
    logistics.requestCheckpoint(carrierWallet, 0, 1);
    vm.prank(client);
    logistics.approveCheckpoint(shipperWallet, 0, 1);

    assertEq(uint256(logistics.getMilestone(0).status), uint256(MilestoneStatus.Completed));
    assertEq(carrierWallet.balance, carrierBefore + 4 ether);
    assertEq(logistics.payoutRemaining(), 6 ether);
    assertEq(uint256(logistics.getMilestone(1).status), uint256(MilestoneStatus.InProgress));
  }

  function test_CompletingFinalMilestoneCompletesContract() public {
    _fundAndActivate();

    vm.prank(client);
    logistics.requestCheckpoint(carrierWallet, 0, 0);
    vm.prank(client);
    logistics.approveCheckpoint(shipperWallet, 0, 0);
    vm.prank(client);
    logistics.requestCheckpoint(carrierWallet, 0, 1);
    vm.prank(client);
    logistics.approveCheckpoint(shipperWallet, 0, 1);

    vm.prank(client);
    logistics.requestCheckpoint(carrierWallet, 1, 0);
    vm.prank(client);
    logistics.approveCheckpoint(shipperWallet, 1, 0);

    assertEq(uint256(logistics.status()), uint256(ContractStatus.Completed));
    assertEq(logistics.payoutRemaining(), 0);
    assertEq(uint256(escrow.status()), uint256(EscrowStatus.Released));
  }

  function test_CheckDeadlinesIsNoopBeforeDeadlinePasses() public {
    _fundAndActivate();

    logistics.checkDeadlines();

    assertEq(uint256(logistics.status()), uint256(ContractStatus.Activated));
  }

  function test_CheckDeadlinesTerminatesAndRefundsShipperWhenOverdue() public {
    _fundAndActivate();
    uint256 shipperBefore = shipperWallet.balance;

    vm.warp(milestone0Deadline + 1);
    logistics.checkDeadlines();

    assertEq(uint256(logistics.status()), uint256(ContractStatus.Terminated));
    assertEq(uint256(logistics.getMilestone(0).status), uint256(MilestoneStatus.Failed));
    assertEq(shipperWallet.balance, shipperBefore + totalPayoutValue);
    assertEq(uint256(escrow.status()), uint256(EscrowStatus.Refunded));
  }

  function test_TerminateContractCalledByShipperRefunds() public {
    _fundAndActivate();
    uint256 shipperBefore = shipperWallet.balance;

    vm.prank(client);
    logistics.terminateContract(shipperWallet);

    assertEq(uint256(logistics.status()), uint256(ContractStatus.Terminated));
    assertEq(shipperWallet.balance, shipperBefore + totalPayoutValue);
  }

  function test_RevertWhen_TerminateContractCalledByNonShipper() public {
    _fundAndActivate();

    vm.prank(client);
    vm.expectRevert("LogisticsContract: caller is not the shipper");
    logistics.terminateContract(stranger);
  }

  function test_RevertWhen_TerminateContractCalledByNonClient() public {
    _fundAndActivate();

    vm.prank(shipperWallet);
    vm.expectRevert("LogisticsContract: caller is not the client");
    logistics.terminateContract(shipperWallet);
  }
}
