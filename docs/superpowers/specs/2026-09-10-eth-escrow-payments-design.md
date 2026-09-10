# Native-ETH Escrow Payments — Design Spec

Status: approved by user, pending written-spec review
Owner: contracts (`Escrow.sol`, `AgreementFactory.sol`, `LogisticsClient.sol`), a new
`Token.sol`, `ignition/modules/Logistics.ts`, the frontend facade, and the
affected Solidity/TS tests.

## Goal

Revert agreement funding from the ERC-20 `PaymentToken` path (introduced in
`2026-09-03-erc20-escrow-payments-design.md`, commit `b3c0928`) back to
native ETH (`payable`, `msg.value`, `address(this).balance`,
`.call{value: ...}`). Driven by wanting to reuse the ERC-20 machinery for
something other than currency later — `PaymentToken.sol` is relocated and
renamed rather than deleted, so it survives as a starting point for that
future feature, fully decoupled from the funding path.

This repo previously carried a native-ETH path (`NativeAgreementFactory.sol` /
`NativeEscrow.sol`) alongside the ERC-20 one, deleted in `b3c0928`. This
design converts the existing ERC-20 contracts in place instead of restoring
that dual-path pattern — one funding path total, since ERC-20 is not staying
around as a currency option.

## Scope

In scope: `Escrow.sol`, `IEscrow.sol`, `AgreementFactory.sol`,
`IAgreementFactory.sol`, `LogisticsClient.sol`, `ILogisticsClient.sol`,
`ignition/modules/Logistics.ts`, `frontend/src/contracts/LogisticsClient.js`,
and the Solidity unit tests that fund through the ERC-20 path today
(`Escrow.t.sol`, `AgreementFactory.t.sol`, `LogisticsClient.t.sol`,
`LogisticsContract.t.sol`). `PaymentToken.sol` / `PaymentToken.t.sol` are
relocated to `Token.sol` / `Token.t.sol` (contract renamed `Token`), body
otherwise unchanged.

Out of scope: `CreateAgreement.jsx`, `AgreementDetail.jsx`, `MainPage.jsx` —
these already format `totalPayoutValue`/`payoutRemaining` with
`ethers.formatEther`/`parseEther` and label everything "ETH"; they were never
updated for the ERC-20 detour and need no changes now. `test/createAgreementTest.ts`
already calls `createAgreement(..., { value: totalPayoutValue })`; it needs no
change either. No new functionality for `Token.sol` — what it becomes instead
of a payment token is a separate future task.

## Contract changes

### `Escrow.sol` / `IEscrow.sol`

- Drop `IERC20 public immutable token;` and the `IERC20` import.
- Constructor: `constructor(address _agreement, address _token)` →
  `constructor(address _agreement)`.
- `balance()`: `token.balanceOf(address(this))` → `address(this).balance`.
- `lockFund(uint256 amount)` → `lockFund()`, `external payable`. Emits the
  existing `FundLocked(msg.sender, msg.value)`.
- `releasePayment`/`refund`: replace `token.transfer(to, amount)` +
  `require(success, ...)` with
  `(bool success,) = payable(to).call{value: amount}(""); require(success, "Escrow: transfer failed");`.
- `IEscrow.sol`: `lockFund` signature updates to `external payable` (no
  `amount` param — value carries it), matching the pre-`b3c0928`
  `INativeEscrow` shape. Comments referencing ERC-20/`transferFrom` updated.

### `AgreementFactory.sol` / `IAgreementFactory.sol`

- Drop `IERC20 public immutable token;`, the `IERC20` import, and the
  constructor entirely (no args needed, matching pre-`b3c0928`
  `NativeAgreementFactory`).
- `createAgreement`: add `payable`; add
  `require(msg.value == totalPayoutValue, "AgreementFactory: incorrect payment");`;
  deploy `Escrow` with one arg (`new Escrow(address(logistics))`); replace
  `token.transferFrom(caller, address(escrow), totalPayoutValue)` +
  `escrow.lockFund(totalPayoutValue)` with
  `escrow.lockFund{value: msg.value}()`.
- `IAgreementFactory.sol`: `createAgreement` gains `payable`; comment updated
  to describe ETH funding instead of the `approve`-then-pull flow.

### `LogisticsClient.sol` / `ILogisticsClient.sol`

- `createAgreement` gains `payable` in both.
- Forward the call: `agreementFactory.createAgreement{value: msg.value}(msg.sender, carrier, totalPayoutValue, duration, milestones);`
- File header comment (currently: "Funds agreements with the ERC-20
  PaymentToken; the shipper must approve...") updated to describe the ETH
  flow.

### `PaymentToken.sol` → `Token.sol`

- Move `contracts/PaymentToken.sol` to `contracts/Token.sol`; rename the
  contract `PaymentToken` → `Token`. Keep the OZ `ERC20` base, `faucet()`,
  and the existing dev/test-only warning comment verbatim — only the
  name and file path change.
- Move `contracts/PaymentToken.t.sol` to `contracts/Token.t.sol`, updating
  the import and identifiers (`PaymentToken` → `Token`) to match. Test
  bodies and assertions (`faucet`, `FAUCET_AMOUNT`, `name()`/`symbol()`)
  are unchanged in behavior — the OZ constructor call
  (`ERC20("Payment Token", "PAY")`) may stay as-is or be genericized; since
  no new use case is defined yet, leave the name/symbol strings as they
  are to avoid guessing at a future purpose.

## Deployment (`ignition/modules/Logistics.ts`)

- `AgreementFactory` deployed with no constructor args.
- Stop deploying `PaymentToken`/`Token` and stop wiring it into
  `AgreementFactory` — nothing references it once the funding path is
  ETH-only. Not deployed by this module at all for now (YAGNI); add it
  back once the new use case for `Token.sol` is built.
- Update the module's comment block, which currently describes the ERC-20
  path and references the already-deleted `NativeAgreementFactory`/
  `NativeEscrow`.

## Frontend (`frontend/src/contracts/LogisticsClient.js`)

- `createAgreement`: drop the `PaymentToken` balance check, `faucet()`
  top-up, allowance check, and `approve()` call. Call
  `this.contract.createAgreement(carrier, totalPayoutValue, duration, milestones, { value: totalPayoutValue })`
  directly.
- Drop the now-unused `getContract('PaymentToken', ...)` lookup and the
  `factoryAddress` read (`this.contract.agreementFactory()`) that existed
  only to compute the allowance target.

## Tests

`Escrow.t.sol`, `AgreementFactory.t.sol`, `LogisticsClient.t.sol`,
`LogisticsContract.t.sol` currently fund via `PaymentToken.faucet()` /
`approve()` / `transfer()` and need real rewrites, not just recompiling:

- Remove the `PaymentToken token;` field and its setup (`new PaymentToken()`,
  `token.faucet()`, `token.approve(...)`).
- Wherever a test previously called `token.transfer(address(escrow), amount)`
  to pre-fund an escrow directly, fund it instead by calling the real
  `lockFund{value: amount}()` path or `vm.deal(address(escrow), amount)` +
  the contract's own funding call, matching how the pre-`b3c0928` ETH tests
  funded escrows.
- `createAgreement`/`createAgreement`-adjacent calls that previously relied
  on a prior `approve` instead attach `{value: totalPayoutValue}` directly.
- Balance assertions (`token.balanceOf(carrierWallet)`,
  `token.balanceOf(shipperWallet)`, `token.balanceOf(agreement.escrow())`)
  become native balance assertions (wallet `.balance`, `address(...).balance`,
  or forge-std's `expectEmit`/balance-change cheatcodes as already used
  elsewhere in the suite).
- `escrow.balance()` assertions already call the right getter; only the
  underlying meaning changes (native balance, not token balance).

Use the `hardhat` skill while writing/modifying these `.t.sol` files, per
this project's CLAUDE.md convention — it covers the `forge-std` cheatcodes
(`vm.deal`, balance-change matchers) needed here.

`Token.t.sol` (renamed from `PaymentToken.t.sol`) needs no behavioral
changes — same tests, same assertions, contract identifier renamed.

## Error handling

- `AgreementFactory.createAgreement`'s `require(msg.value == totalPayoutValue, ...)`
  is the funding-correctness check — matches the pre-`b3c0928` native path
  exactly, replacing the ERC-20 path's implicit reliance on
  `transferFrom`'s own revert.
- `Escrow.releasePayment`/`refund` keep the explicit
  `require(success, "Escrow: transfer failed")` after `.call{value: ...}`,
  since a low-level call's `success` flag is the only failure signal
  available (no revert-on-failure convention like a standards-compliant
  ERC-20 transfer).

## Non-goals

- No redesign of what `Token.sol` becomes — this spec only relocates and
  renames it so it's decoupled from the funding path. Its new purpose
  (reputation, rewards, staking, or anything else "instead of currency")
  is explicitly deferred to a future task.
- No dual funding path (ETH + ERC-20 side by side) — the project is not
  keeping ERC-20 as a currency option, so the old `NativeAgreementFactory`/
  `NativeEscrow` split is not being restored; `AgreementFactory`/`Escrow`
  become the only path, now ETH-based.
- No changes to `CreateAgreement.jsx`, `AgreementDetail.jsx`, `MainPage.jsx`,
  or `test/createAgreementTest.ts` — already ETH-shaped, as noted in Scope.
