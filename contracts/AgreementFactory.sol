// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {IAgreementFactory} from "./interfaces/IAgreementFactory.sol";
import {MilestoneInput} from "./interfaces/Types.sol";
import {LogisticsContract} from "./LogisticsContract.sol";
import {Escrow} from "./Escrow.sol";

contract AgreementFactory is IAgreementFactory {
  address[] private agreements;
  mapping(address => address[]) private agreementsByUser;

  function createAgreement(
    address carrier,
    uint256 totalPayoutValue,
    uint256 duration,
    MilestoneInput[] calldata milestones
  ) external payable returns (address agreement) {
    require(msg.value == totalPayoutValue, "AgreementFactory: incorrect payment");

    LogisticsContract logistics = new LogisticsContract(msg.sender, carrier, totalPayoutValue, duration, milestones);
    Escrow escrow = new Escrow(address(logistics));

    logistics.setEscrow(address(escrow));
    escrow.lockFund{value: msg.value}();
    logistics.activateContract();

    agreement = address(logistics);
    agreements.push(agreement);
    agreementsByUser[msg.sender].push(agreement);
    agreementsByUser[carrier].push(agreement);

    emit AgreementCreated(agreement, msg.sender, carrier, totalPayoutValue);
  }

  function listAgreements() external view returns (address[] memory) {
    return agreements;
  }

  function listAgreementsByUser(address user) external view returns (address[] memory) {
    return agreementsByUser[user];
  }
}
