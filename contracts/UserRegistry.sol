// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {IUserRegistry} from "./interfaces/IUserRegistry.sol";
import {UserProfile, UserRole} from "./interfaces/Types.sol";

contract UserRegistry is IUserRegistry {
  mapping(address => UserProfile) private users;

  function register(string calldata mail, string calldata name, UserRole role) external {}

  function isRegistered(address wallet) external view returns (bool registered) {}

  function login() external view returns (UserProfile memory profile) {}

  function getUser(address wallet) external view returns (UserProfile memory profile) {}
}
