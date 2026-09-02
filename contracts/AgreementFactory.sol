// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {IAgreementFactory} from "./interfaces/IAgreementFactory.sol";
import {MilestoneInput} from "./interfaces/Types.sol";
import {LogisticsContract} from "./LogisticsContract.sol";
import {Escrow} from "./Escrow.sol";

contract AgreementFactory is IAgreementFactory {
  address[] private agreements;
  mapping(address => address[]) private agreementsByUser;

  address public client;

  modifier onlyClient() {
    require(msg.sender == client, "AgreementFactory: caller is not the client");
    _;
  }

  function setClient(address _client) external {
    require(client == address(0), "AgreementFactory: client already set");
    client = _client;
  }

  function createAgreement(
    address caller,
    address carrier,
    uint256 totalPayoutValue,
    uint256 duration,
    MilestoneInput[] calldata milestones
  ) external payable onlyClient returns (address agreement) {
    require(msg.value == totalPayoutValue, "AgreementFactory: incorrect payment");

    // msg.sender is this factory's trusted client (enforced by onlyClient),
    // so LogisticsContract can trust it the same way for its own caller checks.
    LogisticsContract logistics =
      new LogisticsContract(caller, carrier, totalPayoutValue, duration, milestones, msg.sender);
    Escrow escrow = new Escrow(address(logistics));

    logistics.setEscrow(address(escrow));
    escrow.lockFund{value: msg.value}();
    logistics.activateContract();

    agreement = address(logistics);
    agreements.push(agreement);
    agreementsByUser[caller].push(agreement);
    agreementsByUser[carrier].push(agreement);

    emit AgreementCreated(agreement, caller, carrier, totalPayoutValue);
  }

  function listAgreements() external view returns (address[] memory) {
    return agreements;
  }

  function listAgreementsByUser(address user) external view returns (address[] memory) {
    return agreementsByUser[user];
  }
}
