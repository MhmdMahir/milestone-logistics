// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {UserProfile, UserRole} from "./Types.sol";

interface IUserRegistry {
  event UserRegistered(address indexed wallet, UserRole role);

  // One-time wiring: only callable while unset, so the deployer can point
  // this registry at the LogisticsClient it will trust as its caller-forwarder.
  function setClient(address _client) external;

  function client() external view returns (address);

  // `caller` is the real end user, forwarded by the trusted LogisticsClient -
  // msg.sender here is always the client contract, never the user directly.
  function register(address caller, string calldata mail, string calldata name, UserRole role) external;

  function isRegistered(address wallet) external view returns (bool);

  function login(address caller) external view returns (UserProfile memory);

  function getUser(address wallet) external view returns (UserProfile memory);
}
