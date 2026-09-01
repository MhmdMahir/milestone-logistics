// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {UserProfile, UserRole} from "./Types.sol";

interface IUserRegistry {
  event UserRegistered(address indexed wallet, UserRole role);

  function register(string calldata mail, string calldata name, UserRole role) external;

  function isRegistered(address wallet) external view returns (bool);

  function login() external view returns (UserProfile memory);

  function getUser(address wallet) external view returns (UserProfile memory);
}
