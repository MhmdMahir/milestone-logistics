# ERC-20 Escrow Payments — Design Spec

Status: approved by user, pending written-spec review
Owner: contracts (`AgreementFactory.sol`, `Escrow.sol`, new `PaymentToken.sol`)

## Goal

Replace native-ETH escrow (`payable`, `msg.value`, `address(this).balance`,
raw `.call{value: ...}` sends) with an ERC-20 token throughout the payment
path, so the escrowed value doesn't drift with ETH's price between
agreement creation and payout. Driven by wanting a stable unit of value for
a fixed-price shipping fee use case, on a local Ganache network that has no
real-world tokens to test against.

## Scope

In scope: `AgreementFactory.sol`, `IAgreementFactory.sol`, `Escrow.sol`,
`IEscrow.sol`, a new `PaymentToken.sol`, the `Logistics.ts` Ignition
module, and the existing Solidity unit tests for the two changed
contracts (`AgreementFactory.t.sol`, `Escrow.t.sol`).

Out of scope: `LogisticsClient.sol` gets only its `createAgreement`
signature updated (`payable` removed) to keep compiling against the new
flow — no other logic. It is still an empty stub; implementing it is
explicitly not part of this change. The frontend mock
(`frontend/src/contracts/LogisticsClient.js`) is untouched — it talks to
`localStorage`, never a real contract, so nothing here affects it. The
real two-transaction flow this creates (`approve` then `createAgreement`)
only matters once the real `LogisticsClient.sol` is deployed and wired
into the frontend, which is future work.

## Why AgreementFactory does the pull, not Escrow

ERC-20's `approve(spender, amount)` requires the shipper to know the
spender's address *before* calling it. `Escrow` is deployed fresh inside
`createAgreement` itself, so its address doesn't exist at approval time —
only `AgreementFactory`'s address is known in advance. So the shipper
approves `AgreementFactory`, and `AgreementFactory` calls
`token.transferFrom(caller, address(escrow), totalPayoutValue)`, moving
tokens directly from the shipper's wallet into the newly created escrow
in one transaction. `transferFrom`'s `to` argument can be any address —
it doesn't need to be the approved spender — so this works.

## Contract changes

### New: `PaymentToken.sol`

- Extends OpenZeppelin's `ERC20`.
- `faucet()`: public, mints a fixed amount (1,000 tokens, 18 decimals) to
  `msg.sender`. Commented clearly as dev/test-only — this function must
  never exist on a real deployment, since anyone could mint themselves
  unlimited funds.
- Deployed once via Ignition; no constructor args beyond name/symbol.

### `AgreementFactory.sol`

- New state: `IERC20 public immutable token;`
- New constructor: `constructor(address _token) { token = IERC20(_token); }`
- `createAgreement`: drop `payable`; drop
  `require(msg.value == totalPayoutValue, ...)`; after `Escrow` is
  deployed and wired via `logistics.setEscrow(...)`, call
  `token.transferFrom(caller, address(escrow), totalPayoutValue)` before
  `escrow.lockFund(...)` and `logistics.activateContract()`.
- `IAgreementFactory.sol`: `createAgreement` drops `payable` to match.

### `Escrow.sol`

- New state: `IERC20 public immutable token;`
- Constructor becomes `constructor(address _agreement, address _token)`.
- `lockFund()` → `lockFund(uint256 amount)`, non-payable. The actual
  transfer already happened in `AgreementFactory`; this just emits the
  existing `FundLocked` event for the same observability the ETH version
  had.
- `balance()`: `token.balanceOf(address(this))` instead of
  `address(this).balance`.
- `releasePayment` / `refund`: replace `payable(to).call{value: amount}("")`
  with `token.transfer(to, amount)`, keeping the existing
  `require(success, "Escrow: transfer failed")` check.
- `IEscrow.sol`: `lockFund()` signature updates to match
  (`external` with a `uint256 amount` param, no longer `payable`).

### `LogisticsClient.sol` / `ILogisticsClient.sol`

- `createAgreement` drops `payable` in both. Nothing else changes.

## Deployment (`ignition/modules/Logistics.ts`)

- Deploy `PaymentToken` first.
- Pass its address into `AgreementFactory`'s constructor.
- Return `paymentToken` from the module alongside the existing
  `userRegistry`, `agreementFactory`, `logisticsClient` so it's
  addressable later (frontend, tests, scripts) the same way the others
  already are.

## Tests

`AgreementFactory.t.sol` and `Escrow.t.sol` are entirely ETH-based today
(`vm.deal`, `{value: ...}`, `.balance`/wallet-balance assertions) and need
real rewrites, not just recompiling:

- `vm.deal(address, amount)` → deploy/reference `PaymentToken`, call
  `faucet()` (or a direct mint path) to fund the test wallet, then
  `token.approve(address(factory), amount)` before each
  `createAgreement` call that previously attached `{value: amount}`.
- Wallet-balance assertions (`carrierWallet.balance`,
  `shipperWallet.balance`) become `token.balanceOf(carrierWallet)` /
  `token.balanceOf(shipperWallet)`.
- `escrow.balance()` assertions already call the right getter; only the
  underlying meaning changes (token balance, not ETH balance), no test
  code change needed there beyond the setup differences above.

Use the `hardhat` skill while writing/modifying these `.t.sol` files, per
this project's CLAUDE.md convention.

## Error handling

- `token.transferFrom` reverts on its own (insufficient balance or
  allowance) with the ERC-20 implementation's own revert reason — no
  additional `require` needed in `AgreementFactory`, matching how the
  current ETH path relies on the `require(msg.value == totalPayoutValue)`
  check alone rather than double-checking transfer success.
- `releasePayment`/`refund` keep their explicit `require(success, ...)`
  checks even though a standards-compliant ERC-20's `transfer` reverts on
  failure rather than returning `false` in most modern implementations —
  cheap defense, was already the pattern for the ETH `.call` version.

## Non-goals

- No `SafeERC20` — the project controls `PaymentToken.sol` and knows it's
  standards-compliant, so the extra dependency surface isn't earning its
  keep here. Revisit only if this is ever pointed at a real-world,
  non-standard token.
- No frontend wiring for the real two-transaction (`approve` then
  `createAgreement`) flow — the mock doesn't need it, and the real
  `LogisticsClient.sol` isn't implemented yet.
