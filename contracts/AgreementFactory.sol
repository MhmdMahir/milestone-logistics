// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IAgreementFactory} from "./interfaces/IAgreementFactory.sol";
import {MilestoneInput} from "./interfaces/Types.sol";
import {LogisticsContract} from "./LogisticsContract.sol";
import {Escrow} from "./Escrow.sol";

contract AgreementFactory is IAgreementFactory {
  mapping(address => address[]) private agreementsByUser;

  address public client;
  IERC20 public immutable token;

  modifier onlyClient() {
    require(msg.sender == client, "AgreementFactory: caller is not the client");
    _;
  }

  constructor(address _token) {
    token = IERC20(_token);
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
  ) external onlyClient returns (address agreement) {
    // msg.sender is this factory's trusted client (enforced by onlyClient),
    // so LogisticsContract can trust it the same way for its own caller checks.
    LogisticsContract logistics =
      new LogisticsContract(caller, carrier, totalPayoutValue, duration, milestones, msg.sender);
    Escrow escrow = new Escrow(address(logistics), address(token));

    logistics.setEscrow(address(escrow));
    require(token.transferFrom(caller, address(escrow), totalPayoutValue), "AgreementFactory: transfer failed");
    escrow.lockFund(totalPayoutValue);
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
