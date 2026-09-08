// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {INativeAgreementFactory} from "./interfaces/INativeAgreementFactory.sol";
import {MilestoneInput} from "./interfaces/Types.sol";
import {INativeEscrow} from "./interfaces/INativeEscrow.sol";
import {LogisticsContract} from "./LogisticsContract.sol";
import {NativeEscrow} from "./NativeEscrow.sol";

/// Native-ETH agreement factory for the refund demo.
/// AgreementFactory.sol remains the original ERC-20 implementation.
contract NativeAgreementFactory is INativeAgreementFactory {
  mapping(address => address[]) private agreementsByUser;

  address public client;

  modifier onlyClient() {
    require(msg.sender == client, "NativeAgreementFactory: caller is not the client");
    _;
  }

  function setClient(address _client) external {
    require(client == address(0), "NativeAgreementFactory: client already set");
    client = _client;
  }

  function createAgreement(
    address caller,
    address carrier,
    uint256 totalPayoutValue,
    uint256 duration,
    MilestoneInput[] calldata milestones
  ) external payable onlyClient returns (address agreement) {
    require(msg.value == totalPayoutValue, "NativeAgreementFactory: incorrect payment");

    LogisticsContract logistics = new LogisticsContract(
      caller,
      carrier,
      totalPayoutValue,
      duration,
      milestones,
      msg.sender
    );
    NativeEscrow escrow = new NativeEscrow(address(logistics));

    logistics.setEscrow(address(escrow));
    INativeEscrow(address(escrow)).lockFund{value: msg.value}();
    logistics.activateContract();

    agreement = address(logistics);
    agreementsByUser[caller].push(agreement);
    agreementsByUser[carrier].push(agreement);

    emit AgreementCreated(agreement, caller, carrier, totalPayoutValue);
  }

  function listAgreementsByUser(address user) external view returns (address[] memory) {
    return agreementsByUser[user];
  }
}