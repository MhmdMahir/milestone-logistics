// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Dev/test-only ERC-20 for local Ganache testing. `faucet()` lets any
// address mint itself test funds - this function must never exist on a
// real deployment, since it lets anyone mint unlimited value.
//
// Not used to fund agreements (see Escrow.sol/AgreementFactory.sol, which
// are native-ETH) - kept here as a starting point for a future non-currency
// use of ERC-20.
contract Token is ERC20 {
  uint256 public constant FAUCET_AMOUNT = 1_000 * 10 ** 18;

  constructor() ERC20("Payment Token", "PAY") {}

  function faucet() external {
    _mint(msg.sender, FAUCET_AMOUNT);
  }
}
