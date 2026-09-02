// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {IUserRegistry} from "./interfaces/IUserRegistry.sol";
import {UserProfile, UserRole} from "./interfaces/Types.sol";

contract UserRegistry is IUserRegistry {
  mapping(address => UserProfile) private users;
  mapping(address => bool) private registered;

  address public client;

  modifier onlyClient() {
    require(msg.sender == client, "UserRegistry: caller is not the client");
    _;
  }

  function setClient(address _client) external {
    require(client == address(0), "UserRegistry: client already set");
    client = _client;
  }

  function register(address caller, string calldata mail, string calldata name, UserRole role) external onlyClient {
    require(!registered[caller], "UserRegistry: already registered");

    registered[caller] = true;
    users[caller] = UserProfile({walletAddress: caller, mail: mail, role: role, name: name});

    emit UserRegistered(caller, role);
  }

  function isRegistered(address wallet) external view returns (bool) {
    return registered[wallet];
  }

  function login(address caller) external view onlyClient returns (UserProfile memory) {
    require(registered[caller], "UserRegistry: not registered");
    return users[caller];
  }

  function getUser(address wallet) external view returns (UserProfile memory) {
    return users[wallet];
  }
}
