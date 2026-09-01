// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {IUserRegistry} from "./interfaces/IUserRegistry.sol";
import {UserProfile, UserRole} from "./interfaces/Types.sol";

contract UserRegistry is IUserRegistry {
  mapping(address => UserProfile) private users;
  mapping(address => bool) private registered;

  function register(string calldata mail, string calldata name, UserRole role) external {
    require(!registered[msg.sender], "UserRegistry: already registered");

    registered[msg.sender] = true;
    users[msg.sender] = UserProfile({walletAddress: msg.sender, mail: mail, role: role, name: name});

    emit UserRegistered(msg.sender, role);
  }

  function isRegistered(address wallet) external view returns (bool) {
    return registered[wallet];
  }

  function login() external view returns (UserProfile memory) {
    require(registered[msg.sender], "UserRegistry: not registered");
    return users[msg.sender];
  }

  function getUser(address wallet) external view returns (UserProfile memory) {
    return users[wallet];
  }
}
