# Native-ETH Escrow Payments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Revert agreement funding from the ERC-20 `PaymentToken` path back to native ETH (`payable`, `msg.value`, `address(this).balance`, `.call{value: ...}`) across `Escrow`, `AgreementFactory`, and `LogisticsClient`, and relocate the ERC-20 token contract to `Token.sol` — fully decoupled from funding — so it's available for a future non-currency use.

**Architecture:** `AgreementFactory.createAgreement` becomes `payable`; it requires `msg.value == totalPayoutValue`, deploys a single-arg `Escrow`, and funds it via `escrow.lockFund{value: msg.value}()` instead of `token.transferFrom`. `Escrow` drops its `IERC20` dependency entirely — `balance()` reads `address(this).balance`, `releasePayment`/`refund` pay out via `payable(to).call{value: amount}("")`. `LogisticsClient.createAgreement` becomes `payable` and forwards `{value: msg.value}` to the factory — the same shape this repo had before commit `b3c0928` deleted the native-ETH path, but converted in place (one funding path, not the old dual `AgreementFactory`/`NativeAgreementFactory` split). `PaymentToken.sol` is renamed to `Token.sol` and stops being referenced by any of the above.

**Tech Stack:** Solidity ^0.8.34 (Hardhat 3), `forge-std` Solidity tests, OpenZeppelin Contracts (`ERC20` base for `Token.sol`, unrelated to funding now), Hardhat Ignition for deployment, ethers.js v6 in the frontend facade.

**Spec:** `docs/superpowers/specs/2026-09-10-eth-escrow-payments-design.md`

## Global Constraints

- Single funding path only — no dual ETH/ERC-20 split (spec's explicit non-goal). `AgreementFactory`/`Escrow` become the only path.
- Match existing revert-message style exactly: `"<ContractName>: <reason>"` strings (e.g. `"Escrow: not locked"`, `"AgreementFactory: incorrect payment"`).
- `Token.sol`'s `faucet()` stays dev/test-only with its existing warning comment — never appropriate on a real deployment. Its name/symbol strings (`"Payment Token"` / `"PAY"`) are left unchanged; what it becomes is explicitly future work, not part of this plan.
- Test commands (per project's `hardhat` skill, which also covers `forge-std` cheatcodes like `vm.deal`/`vm.prank`): `npx hardhat build` to compile, `npx hardhat test solidity` for Solidity-only tests, `npx hardhat test` for the full suite. Consult the `hardhat` skill before editing any `.t.sol` file, per this project's `CLAUDE.md`.
- Hardhat compiles every file under `contracts/` together — a stale reference in *any* `.t.sol` file (even one for a contract this plan isn't otherwise touching) breaks the whole build. Tasks below are sized around this: a task is not "done" until `npx hardhat build` and `npx hardhat test solidity` are clean for the *entire* project, not just the file that motivated the task.

---

## Task 1: Relocate `PaymentToken.sol` → `Token.sol`

**Files:**
- Create: `contracts/Token.sol` (moved from `contracts/PaymentToken.sol`)
- Create: `contracts/Token.t.sol` (moved from `contracts/PaymentToken.t.sol`)
- Delete: `contracts/PaymentToken.sol`, `contracts/PaymentToken.t.sol`
- Modify: `contracts/Escrow.t.sol`, `contracts/AgreementFactory.t.sol`, `contracts/LogisticsClient.t.sol`, `contracts/LogisticsContract.t.sol` (import path + identifier only — each still funds via the token exactly as before; the funding mechanism itself changes in Task 2)

**Interfaces:**
- Produces: `contract Token is ERC20` (was `PaymentToken`) — same `FAUCET_AMOUNT`, `faucet()`, constructor (`ERC20("Payment Token", "PAY")`). Every other file that referenced `PaymentToken` now references `Token` from `./Token.sol`.

This is a pure rename — no behavior changes anywhere in this task. It's split out first so a rename mistake and a funding-logic mistake are never in the same commit.

- [ ] **Step 1: Move the contract and test files**

```bash
git mv contracts/PaymentToken.sol contracts/Token.sol
git mv contracts/PaymentToken.t.sol contracts/Token.t.sol
```

- [ ] **Step 2: Rename the contract identifier**

In `contracts/Token.sol`, replace:

```solidity
// Dev/test-only payment token for local Ganache testing. `faucet()` lets
// any address mint itself test funds - this function must never exist on
// a real deployment, since it lets anyone mint unlimited value.
contract PaymentToken is ERC20 {
```

with:

```solidity
// Dev/test-only ERC-20 for local Ganache testing. `faucet()` lets any
// address mint itself test funds - this function must never exist on a
// real deployment, since it lets anyone mint unlimited value.
//
// Not used to fund agreements (see Escrow.sol/AgreementFactory.sol, which
// are native-ETH) - kept here as a starting point for a future non-currency
// use of ERC-20.
contract Token is ERC20 {
```

- [ ] **Step 3: Rename the identifier in its test file**

In `contracts/Token.t.sol`, replace:

```solidity
import {PaymentToken} from "./PaymentToken.sol";

contract PaymentTokenTest is Test {
  PaymentToken token;
  address alice = address(0xA11CE);
  address bob = address(0xB0B);

  function setUp() public {
    token = new PaymentToken();
  }
```

with:

```solidity
import {Token} from "./Token.sol";

contract TokenTest is Test {
  Token token;
  address alice = address(0xA11CE);
  address bob = address(0xB0B);

  function setUp() public {
    token = new Token();
  }
```

- [ ] **Step 4: Update the four test files that still fund through this token**

In `contracts/Escrow.t.sol`, replace:

```solidity
import {PaymentToken} from "./PaymentToken.sol";
```

with:

```solidity
import {Token} from "./Token.sol";
```

and replace both occurrences of `PaymentToken` in the class body (`PaymentToken token;` and `token = new PaymentToken();`) with `Token`/`new Token()`.

In `contracts/AgreementFactory.t.sol`, replace:

```solidity
import {PaymentToken} from "./PaymentToken.sol";
```

with:

```solidity
import {Token} from "./Token.sol";
```

and replace `PaymentToken token;` / `token = new PaymentToken();` with `Token token;` / `token = new Token();`.

In `contracts/LogisticsClient.t.sol`, replace:

```solidity
import {PaymentToken} from "./PaymentToken.sol";
```

with:

```solidity
import {Token} from "./Token.sol";
```

and replace `PaymentToken token;` / `token = new PaymentToken();` with `Token token;` / `token = new Token();`.

In `contracts/LogisticsContract.t.sol`, replace:

```solidity
import {PaymentToken} from "./PaymentToken.sol";
```

with:

```solidity
import {Token} from "./Token.sol";
```

and replace `PaymentToken token;` / `token = new PaymentToken();` with `Token token;` / `token = new Token();`.

- [ ] **Step 5: Verify the whole project compiles and every test still passes**

Run: `npx hardhat build`
Expected: compiles clean.

Run: `npx hardhat test solidity`
Expected: PASS — full suite green, same test count as before this task (pure rename, no test behavior changed).

- [ ] **Step 6: Commit**

```bash
git add contracts/Token.sol contracts/Token.t.sol contracts/Escrow.t.sol contracts/AgreementFactory.t.sol contracts/LogisticsClient.t.sol contracts/LogisticsContract.t.sol
git commit -m "Rename PaymentToken to Token, decoupling it from agreement funding"
```

---

## Task 2: Convert `Escrow`, `AgreementFactory`, `LogisticsClient` to native ETH

**Files:**
- Modify: `contracts/interfaces/IEscrow.sol`
- Modify: `contracts/Escrow.sol`
- Modify: `contracts/Escrow.t.sol`
- Modify: `contracts/interfaces/IAgreementFactory.sol`
- Modify: `contracts/AgreementFactory.sol`
- Modify: `contracts/AgreementFactory.t.sol`
- Modify: `contracts/interfaces/ILogisticsClient.sol`
- Modify: `contracts/LogisticsClient.sol`
- Modify: `contracts/LogisticsClient.t.sol`
- Modify: `contracts/LogisticsContract.t.sol` (constructs `Escrow` directly and funds it — has no production-code changes of its own, but breaks the whole-project build the moment `Escrow`'s constructor changes, so it's fixed in this task, not left for later)

**Interfaces:**
- Consumes: nothing new.
- Produces: `Escrow(address _agreement)` constructor (was `Escrow(address _agreement, address _token)`); `lockFund() external payable` (was `lockFund(uint256 amount) external`); `balance()` now reads `address(this).balance` (signature unchanged). `AgreementFactory()` constructor (was `AgreementFactory(address _token)`, now no-arg); `createAgreement(...)` gains `payable` (all other params unchanged, still returns `address agreement`). `LogisticsClient.createAgreement(...)` gains `payable` (params/return unchanged).

These three contracts are deployed and called through each other in a single chain (`LogisticsClient` → `AgreementFactory` → `Escrow`), and four `.t.sol` files construct them directly — none of the three can be converted in isolation without leaving the whole project uncompilable, so they're one task.

- [ ] **Step 1: Replace `Escrow.t.sol`'s test suite with the native-ETH version**

Replace `contracts/Escrow.t.sol` in full:

```solidity
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {Test} from "forge-std/Test.sol";
import {Escrow} from "./Escrow.sol";
import {IEscrow} from "./interfaces/IEscrow.sol";
import {EscrowStatus} from "./interfaces/Types.sol";

contract MockAgreement {
  address public shipper;
  address public carrier;

  constructor(address _shipper, address _carrier) {
    shipper = _shipper;
    carrier = _carrier;
  }
}

contract EscrowTest is Test {
  Escrow escrow;
  MockAgreement agreement;
  address shipperWallet = address(0xA11CE);
  address carrierWallet = address(0xB0B);
  address stranger = address(0xBAD);

  function setUp() public {
    agreement = new MockAgreement(shipperWallet, carrierWallet);
    escrow = new Escrow(address(agreement));
    vm.deal(address(this), 10 ether);
  }

  function test_LockFundIncreasesBalance() public {
    escrow.lockFund{value: 3 ether}();
    assertEq(escrow.balance(), 3 ether);
  }

  function test_RevertWhen_ReleasePaymentCalledByNonAgreement() public {
    escrow.lockFund{value: 1 ether}();

    vm.prank(stranger);
    vm.expectRevert("Escrow: caller is not the agreement");
    escrow.releasePayment(1 ether);
  }

  function test_ReleasePaymentSendsToCarrierAndEmits() public {
    escrow.lockFund{value: 1 ether}();
    uint256 before = carrierWallet.balance;

    vm.prank(address(agreement));
    vm.expectEmit(true, false, false, true, address(escrow));
    emit IEscrow.PaymentReleased(carrierWallet, 0.4 ether);
    escrow.releasePayment(0.4 ether);

    assertEq(carrierWallet.balance, before + 0.4 ether);
    assertEq(escrow.balance(), 0.6 ether);
  }

  function test_ReleasePaymentMarksReleasedWhenBalanceFullyDrained() public {
    escrow.lockFund{value: 1 ether}();

    vm.prank(address(agreement));
    escrow.releasePayment(1 ether);

    assertEq(uint256(escrow.status()), uint256(EscrowStatus.Released));
  }

  function test_RevertWhen_RefundCalledByNonAgreement() public {
    escrow.lockFund{value: 1 ether}();

    vm.prank(stranger);
    vm.expectRevert("Escrow: caller is not the agreement");
    escrow.refund();
  }

  function test_RefundSendsRemainingBalanceToShipperAndMarksRefunded() public {
    escrow.lockFund{value: 2 ether}();
    uint256 before = shipperWallet.balance;

    vm.prank(address(agreement));
    vm.expectEmit(true, false, false, true, address(escrow));
    emit IEscrow.Refunded(shipperWallet, 2 ether);
    escrow.refund();

    assertEq(shipperWallet.balance, before + 2 ether);
    assertEq(escrow.balance(), 0);
    assertEq(uint256(escrow.status()), uint256(EscrowStatus.Refunded));
  }

  function test_RevertWhen_ReleasePaymentAfterRefunded() public {
    escrow.lockFund{value: 1 ether}();

    vm.startPrank(address(agreement));
    escrow.refund();

    vm.expectRevert("Escrow: not locked");
    escrow.releasePayment(0.1 ether);
    vm.stopPrank();
  }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx hardhat test solidity`
Expected: FAIL to compile — `Escrow`'s constructor still takes two arguments and `lockFund` still takes a `uint256 amount` (non-`payable`), so `new Escrow(address(agreement))` and `escrow.lockFund{value: ...}()` don't match the current signatures.

- [ ] **Step 3: Update `IEscrow.sol`**

In `contracts/interfaces/IEscrow.sol`, replace:

```solidity
  // Amount already sits in this escrow (moved there by the caller, e.g.
  // AgreementFactory pulling from the shipper via transferFrom) - this just
  // records/confirms it arrived.
  function lockFund(uint256 amount) external;
```

with:

```solidity
  // Native-ETH funding: the caller sends value directly with the call.
  function lockFund() external payable;
```

- [ ] **Step 4: Update `Escrow.sol`**

Replace `contracts/Escrow.sol` in full:

```solidity
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {IEscrow} from "./interfaces/IEscrow.sol";
import {IAgreementInfo} from "./interfaces/IAgreementInfo.sol";
import {EscrowStatus} from "./interfaces/Types.sol";

contract Escrow is IEscrow {
  address public agreement;
  EscrowStatus public status;

  modifier onlyAgreement() {
    require(msg.sender == agreement, "Escrow: caller is not the agreement");
    _;
  }

  constructor(address _agreement) {
    agreement = _agreement;
  }

  function balance() external view returns (uint256) {
    return address(this).balance;
  }

  function lockFund() external payable {
    emit FundLocked(msg.sender, msg.value);
  }

  function releasePayment(uint256 amount) external onlyAgreement {
    require(status == EscrowStatus.Locked, "Escrow: not locked");

    address to = IAgreementInfo(agreement).carrier();
    if (address(this).balance == amount) {
      status = EscrowStatus.Released;
    }
    (bool success,) = payable(to).call{value: amount}("");
    require(success, "Escrow: transfer failed");

    emit PaymentReleased(to, amount);
  }

  function refund() external onlyAgreement {
    require(status == EscrowStatus.Locked, "Escrow: not locked");

    address to = IAgreementInfo(agreement).shipper();
    uint256 amount = address(this).balance;
    status = EscrowStatus.Refunded;
    (bool success,) = payable(to).call{value: amount}("");
    require(success, "Escrow: transfer failed");

    emit Refunded(to, amount);
  }
}
```

- [ ] **Step 5: Fix `LogisticsContract.t.sol`'s direct `Escrow` usage**

This file constructs `Escrow` directly (bypassing `AgreementFactory`) to test `LogisticsContract` in isolation, so it needs to track `Escrow`'s new constructor/funding shape.

In `contracts/LogisticsContract.t.sol`, remove the `Token` import and field entirely — replace:

```solidity
import {Token} from "./Token.sol";
```

(delete this line — no longer needed), and replace:

```solidity
  LogisticsContract logistics;
  Escrow escrow;
  Token token;
```

with:

```solidity
  LogisticsContract logistics;
  Escrow escrow;
```

Replace the `setUp` body:

```solidity
    token = new Token();
    vm.prank(shipperWallet);
    token.faucet();

    vm.prank(factory);
    logistics = new LogisticsContract(shipperWallet, carrierWallet, totalPayoutValue, 2 days, _defaultMilestones(), client);

    escrow = new Escrow(address(logistics), address(token));

    vm.prank(factory);
    logistics.setEscrow(address(escrow));
```

with:

```solidity
    vm.deal(shipperWallet, 20 ether);

    vm.prank(factory);
    logistics = new LogisticsContract(shipperWallet, carrierWallet, totalPayoutValue, 2 days, _defaultMilestones(), client);

    escrow = new Escrow(address(logistics));

    vm.prank(factory);
    logistics.setEscrow(address(escrow));
```

Replace the `_fundAndActivate` helper:

```solidity
  function _fundAndActivate() internal {
    vm.prank(shipperWallet);
    token.transfer(address(escrow), totalPayoutValue);

    vm.prank(shipperWallet);
    escrow.lockFund(totalPayoutValue);

    vm.prank(factory);
    logistics.activateContract();
  }
```

with:

```solidity
  function _fundAndActivate() internal {
    vm.prank(shipperWallet);
    escrow.lockFund{value: totalPayoutValue}();

    vm.prank(factory);
    logistics.activateContract();
  }
```

In `test_RevertWhen_SetEscrowCalledByNonFactory`, replace:

```solidity
    Escrow otherEscrow = new Escrow(address(logistics), address(token));
```

with:

```solidity
    Escrow otherEscrow = new Escrow(address(logistics));
```

In `test_RevertWhen_ActivateContractCalledBeforeFullyFunded`, replace:

```solidity
    vm.prank(shipperWallet);
    token.transfer(address(escrow), 1 ether);

    vm.prank(shipperWallet);
    escrow.lockFund(1 ether);
```

with:

```solidity
    vm.prank(shipperWallet);
    escrow.lockFund{value: 1 ether}();
```

Replace every remaining `token.balanceOf(carrierWallet)` with `carrierWallet.balance` and every `token.balanceOf(shipperWallet)` with `shipperWallet.balance` (three call sites: `test_ApprovingAllCheckpointsCompletesMilestoneAndReleasesPayout`, `test_CheckDeadlinesTerminatesAndRefundsShipperWhenOverdue`, `test_TerminateAgreementCalledByShipperRefunds`).

- [ ] **Step 6: Run the test to verify Escrow and LogisticsContract tests pass**

Run: `npx hardhat build`
Expected: FAIL — `AgreementFactory.sol` still calls `new Escrow(address(logistics), address(token))` with two arguments (fixed in Step 8 below). This is expected; continue to the next step before re-running.

- [ ] **Step 7: Update `IAgreementFactory.sol`**

In `contracts/interfaces/IAgreementFactory.sol`, replace:

```solidity
  // `caller` is the real shipper, forwarded by the trusted LogisticsClient -
  // msg.sender here is always the client contract, never the user directly.
  // Deploys a LogisticsContract + its paired Escrow in one transaction and
  // pulls totalPayoutValue in payment tokens from `caller` into that escrow
  // immediately (caller must have approved this factory beforehand), so an
  // agreement can never exist unfunded.
  function createAgreement(
    address caller,
    address carrier,
    uint256 totalPayoutValue,
    uint256 duration,
    MilestoneInput[] calldata milestones
  ) external returns (address agreement);
```

with:

```solidity
  // `caller` is the real shipper, forwarded by the trusted LogisticsClient -
  // msg.sender here is always the client contract, never the user directly.
  // Deploys a LogisticsContract + its paired Escrow in one transaction and
  // locks msg.value (must equal totalPayoutValue) into escrow immediately,
  // so an agreement can never exist unfunded.
  function createAgreement(
    address caller,
    address carrier,
    uint256 totalPayoutValue,
    uint256 duration,
    MilestoneInput[] calldata milestones
  ) external payable returns (address agreement);
```

- [ ] **Step 8: Update `AgreementFactory.sol`**

Replace `contracts/AgreementFactory.sol` in full:

```solidity
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {IAgreementFactory} from "./interfaces/IAgreementFactory.sol";
import {MilestoneInput} from "./interfaces/Types.sol";
import {LogisticsContract} from "./LogisticsContract.sol";
import {Escrow} from "./Escrow.sol";

contract AgreementFactory is IAgreementFactory {
  mapping(address => address[]) private agreementsByUser;

  address public client;

  modifier onlyClient() {
    require(msg.sender == client, "AgreementFactory: caller is not the client");
    _;
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
  ) external payable onlyClient returns (address agreement) {
    require(msg.value == totalPayoutValue, "AgreementFactory: incorrect payment");

    // msg.sender is this factory's trusted client (enforced by onlyClient),
    // so LogisticsContract can trust it the same way for its own caller checks.
    LogisticsContract logistics =
      new LogisticsContract(caller, carrier, totalPayoutValue, duration, milestones, msg.sender);
    Escrow escrow = new Escrow(address(logistics));

    logistics.setEscrow(address(escrow));
    escrow.lockFund{value: msg.value}();
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
```

- [ ] **Step 9: Replace `AgreementFactory.t.sol`'s test suite with the native-ETH version**

Replace `contracts/AgreementFactory.t.sol` in full:

```solidity
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {Test} from "forge-std/Test.sol";
import {AgreementFactory} from "./AgreementFactory.sol";
import {IAgreementFactory} from "./interfaces/IAgreementFactory.sol";
import {LogisticsContract} from "./LogisticsContract.sol";
import {ContractStatus, MilestoneInput, MilestoneStatus} from "./interfaces/Types.sol";

contract AgreementFactoryTest is Test {
  AgreementFactory factory;

  address client = address(0xC11E47);
  address shipperWallet = address(0xA11CE);
  address carrierWallet = address(0xB0B);

  uint256 totalPayoutValue = 10 ether;

  function setUp() public {
    factory = new AgreementFactory();
    factory.setClient(client);
    vm.deal(client, 20 ether);
  }

  function _defaultMilestones() internal view returns (MilestoneInput[] memory milestones) {
    milestones = new MilestoneInput[](1);

    string[] memory checkpoints = new string[](1);
    checkpoints[0] = "Delivered";
    milestones[0] = MilestoneInput({deadline: block.timestamp + 1 days, payoutPercent: 100, title: "Only leg", checkpointDescriptions: checkpoints});
  }

  function test_RevertWhen_PaymentDoesNotMatchTotalPayoutValue() public {
    vm.prank(client);
    vm.expectRevert("AgreementFactory: incorrect payment");
    factory.createAgreement{value: 1 ether}(shipperWallet, carrierWallet, totalPayoutValue, 1 days, _defaultMilestones());
  }

  function test_RevertWhen_CreateAgreementCalledByNonClient() public {
    vm.deal(shipperWallet, totalPayoutValue);
    vm.prank(shipperWallet);
    vm.expectRevert("AgreementFactory: caller is not the client");
    factory.createAgreement{value: totalPayoutValue}(shipperWallet, carrierWallet, totalPayoutValue, 1 days, _defaultMilestones());
  }

  function test_CreateAgreementDeploysActivatedAndFundedAgreement() public {
    vm.prank(client);
    address agreementAddress = factory.createAgreement{value: totalPayoutValue}(
      shipperWallet, carrierWallet, totalPayoutValue, 1 days, _defaultMilestones()
    );

    LogisticsContract agreement = LogisticsContract(agreementAddress);
    assertEq(agreement.shipper(), shipperWallet);
    assertEq(agreement.carrier(), carrierWallet);
    assertEq(agreement.client(), client);
    assertEq(uint256(agreement.status()), uint256(ContractStatus.Activated));
    assertEq(uint256(agreement.getMilestone(0).status), uint256(MilestoneStatus.InProgress));
  }

  function test_CreateAgreementRecordsItForBothParties() public {
    vm.prank(client);
    address agreementAddress = factory.createAgreement{value: totalPayoutValue}(
      shipperWallet, carrierWallet, totalPayoutValue, 1 days, _defaultMilestones()
    );

    address[] memory shipperAgreements = factory.listAgreementsByUser(shipperWallet);
    address[] memory carrierAgreements = factory.listAgreementsByUser(carrierWallet);

    assertEq(shipperAgreements.length, 1);
    assertEq(shipperAgreements[0], agreementAddress);
    assertEq(carrierAgreements.length, 1);
    assertEq(carrierAgreements[0], agreementAddress);
  }

  function test_CreateAgreementEmitsAgreementCreatedEvent() public {
    vm.prank(client);
    vm.expectEmit(false, true, true, true, address(factory));
    emit IAgreementFactory.AgreementCreated(address(0), shipperWallet, carrierWallet, totalPayoutValue);
    factory.createAgreement{value: totalPayoutValue}(shipperWallet, carrierWallet, totalPayoutValue, 1 days, _defaultMilestones());
  }

  function test_CreateAgreementLocksPaymentIntoEscrow() public {
    vm.prank(client);
    address agreementAddress = factory.createAgreement{value: totalPayoutValue}(
      shipperWallet, carrierWallet, totalPayoutValue, 1 days, _defaultMilestones()
    );

    LogisticsContract agreement = LogisticsContract(agreementAddress);
    assertEq(agreement.escrow().balance, totalPayoutValue);
  }

  function test_RevertWhen_SetClientCalledTwice() public {
    vm.expectRevert("AgreementFactory: client already set");
    factory.setClient(address(0xBAD));
  }
}
```

Note: `client` (not `shipperWallet`) is the address `vm.deal`t and pranked before calling `factory.createAgreement{value: ...}` directly, because at this layer `client` *is* the caller sending the transaction (and its value) — in the real system that's `LogisticsClient` forwarding the actual shipper's `msg.value`, but this test calls `AgreementFactory` directly, bypassing that forwarder.

- [ ] **Step 10: Run the test to verify Escrow, LogisticsContract, and AgreementFactory tests pass**

Run: `npx hardhat build`
Expected: FAIL — `LogisticsClient.sol`'s `createAgreement` is still non-`payable`, so `LogisticsClient.t.sol` (fixed in Step 12) and any `{value: ...}` call into it won't compile yet. Continue to the next step before re-running.

- [ ] **Step 11: Update `ILogisticsClient.sol`**

In `contracts/interfaces/ILogisticsClient.sol`, replace:

```solidity
  // Caller must have approved AgreementFactory for totalPayoutValue first
  // (ERC-20 funding, not native ETH).
  function createAgreement(
    address carrier,
    uint256 totalPayoutValue,
    uint256 duration,
    MilestoneInput[] calldata milestones
  ) external returns (address agreement);
```

with:

```solidity
  // Caller sends msg.value == totalPayoutValue directly (native ETH funding).
  function createAgreement(
    address carrier,
    uint256 totalPayoutValue,
    uint256 duration,
    MilestoneInput[] calldata milestones
  ) external payable returns (address agreement);
```

- [ ] **Step 12: Update `LogisticsClient.sol`**

In `contracts/LogisticsClient.sol`, replace the file header comment:

```solidity
// User-facing trusted facade. It forwards the original wallet address to the
// underlying contracts because those contracts trust this facade as client.
// Funds agreements with the ERC-20 PaymentToken; the shipper must approve
// this facade's AgreementFactory for totalPayoutValue before calling
// createAgreement.
contract LogisticsClient is ILogisticsClient {
```

with:

```solidity
// User-facing trusted facade. It forwards the original wallet address to the
// underlying contracts because those contracts trust this facade as client.
// Funds agreements with native ETH; the shipper sends msg.value ==
// totalPayoutValue directly with the createAgreement call.
contract LogisticsClient is ILogisticsClient {
```

Then replace the `createAgreement` function:

```solidity
  function createAgreement(
    address carrier,
    uint256 totalPayoutValue,
    uint256 duration,
    MilestoneInput[] calldata milestones
  ) external returns (address agreement) {
    require(carrier != address(0), "LogisticsClient: carrier is the zero address");
    require(carrier != msg.sender, "LogisticsClient: shipper and carrier must differ");
    require(totalPayoutValue > 0, "LogisticsClient: payout value must be greater than zero");
    require(userRegistry.isRegistered(msg.sender), "LogisticsClient: shipper is not registered");
    require(userRegistry.isRegistered(carrier), "LogisticsClient: carrier is not registered");
    require(
      userRegistry.getUser(msg.sender).role == UserRole.Shipper, "LogisticsClient: caller is not a shipper"
    );
    require(userRegistry.getUser(carrier).role == UserRole.Carrier, "LogisticsClient: carrier is not a carrier");

    _validateSchedule(duration, milestones);

    // Requires msg.sender to have approved this factory for totalPayoutValue
    // beforehand (ERC-20 has no "send with call" equivalent to native value).
    agreement = agreementFactory.createAgreement(msg.sender, carrier, totalPayoutValue, duration, milestones);
  }
```

with:

```solidity
  function createAgreement(
    address carrier,
    uint256 totalPayoutValue,
    uint256 duration,
    MilestoneInput[] calldata milestones
  ) external payable returns (address agreement) {
    require(carrier != address(0), "LogisticsClient: carrier is the zero address");
    require(carrier != msg.sender, "LogisticsClient: shipper and carrier must differ");
    require(totalPayoutValue > 0, "LogisticsClient: payout value must be greater than zero");
    require(userRegistry.isRegistered(msg.sender), "LogisticsClient: shipper is not registered");
    require(userRegistry.isRegistered(carrier), "LogisticsClient: carrier is not registered");
    require(
      userRegistry.getUser(msg.sender).role == UserRole.Shipper, "LogisticsClient: caller is not a shipper"
    );
    require(userRegistry.getUser(carrier).role == UserRole.Carrier, "LogisticsClient: carrier is not a carrier");

    _validateSchedule(duration, milestones);

    agreement = agreementFactory.createAgreement{value: msg.value}(
      msg.sender, carrier, totalPayoutValue, duration, milestones
    );
  }
```

- [ ] **Step 13: Replace `LogisticsClient.t.sol`'s test suite with the native-ETH version**

Replace `contracts/LogisticsClient.t.sol` in full:

```solidity
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {Test} from "forge-std/Test.sol";
import {LogisticsClient} from "./LogisticsClient.sol";
import {AgreementFactory} from "./AgreementFactory.sol";
import {UserRegistry} from "./UserRegistry.sol";
import {LogisticsContract} from "./LogisticsContract.sol";
import {ContractStatus, MilestoneInput, MilestoneStatus, TransactionType, UserProfile, UserRole} from "./interfaces/Types.sol";

contract LogisticsClientTest is Test {
  UserRegistry registry;
  AgreementFactory factory;
  LogisticsClient client;

  address shipper = address(0xA11CE);
  address carrier = address(0xB0B);
  address keeper = address(0xC0FFEE);
  address user2 = address(0xB0B2);
  uint256 totalPayout = 1 ether;

  function setUp() public {
    registry = new UserRegistry();
    factory = new AgreementFactory();
    client = new LogisticsClient(address(registry), address(factory));
    registry.setClient(address(client));
    factory.setClient(address(client));
    vm.deal(shipper, 2 ether);
  }

  function _milestones() internal view returns (MilestoneInput[] memory milestones) {
    milestones = new MilestoneInput[](1);
    string[] memory checkpoints = new string[](2);
    checkpoints[0] = "Pickup confirmed";
    checkpoints[1] = "Delivered";
    milestones[0] = MilestoneInput({
      deadline: block.timestamp + 1 days,
      payoutPercent: 100,
      title: "Delivery",
      checkpointDescriptions: checkpoints
    });
  }

  function test_ForwardsRegistrationAndLogin() public {
    vm.prank(shipper);
    client.register("shipper@example.com", "Alice", UserRole.Shipper);

    vm.prank(shipper);
    assertEq(client.login().walletAddress, shipper);
  }

  function test_CreatesAgreementAndRefundsAfterIncompleteDeadline() public {
    vm.prank(shipper);
    client.register("shipper@example.com", "Alice", UserRole.Shipper);

    vm.prank(carrier);
    client.register("carrier@example.com", "Bob", UserRole.Carrier);

    vm.prank(shipper);
    address agreementAddress = client.createAgreement{value: totalPayout}(carrier, totalPayout, 1 days, _milestones());
    LogisticsContract agreement = LogisticsContract(agreementAddress);

    assertEq(uint256(agreement.status()), uint256(ContractStatus.Activated));
    assertEq(agreement.payoutRemaining(), totalPayout);

    uint256 shipperBefore = shipper.balance;
    vm.warp(block.timestamp + 1 days + 1);

    vm.prank(keeper);
    client.checkDeadlines(agreementAddress, block.timestamp);

    assertEq(uint256(agreement.status()), uint256(ContractStatus.Terminated));
    assertEq(uint256(agreement.getMilestone(0).status), uint256(MilestoneStatus.Failed));
    assertEq(agreement.payoutRemaining(), totalPayout);
    assertEq(shipper.balance, shipperBefore + totalPayout);
    assertEq(uint256(agreement.getTransactions()[1].txType), uint256(TransactionType.Refund));
  }

  function test_RegisterThroughLogisticsClient() public {
    vm.prank(shipper);

    client.register("alice@example.com", "Alice", UserRole.Shipper);

    UserProfile memory profile = registry.getUser(shipper);

    assertEq(profile.walletAddress, shipper);
    assertEq(profile.mail, "alice@example.com");
    assertEq(profile.name, "Alice");
    assertEq(uint256(profile.role), uint256(UserRole.Shipper));
  }

  function test_LoginThroughLogisticsClient() public {
    vm.prank(shipper);

    client.register("alice@example.com", "Alice", UserRole.Shipper);

    vm.prank(shipper);

    UserProfile memory profile = client.login();

    assertEq(profile.walletAddress, shipper);
    assertEq(profile.mail, "alice@example.com");
    assertEq(profile.name, "Alice");
    assertEq(uint256(profile.role), uint256(UserRole.Shipper));
  }

  function test_LoginThroughLogisticsClientRevertsWhenNotRegistered() public {
    vm.prank(shipper);

    vm.expectRevert("UserRegistry: not registered");

    client.login();
  }

  function test_RegisterThroughLogisticsClientRejectsDuplicateName() public {
    vm.startPrank(shipper);

    client.register("alice@example.com", "Alice", UserRole.Shipper);

    vm.stopPrank();

    vm.prank(user2);

    vm.expectRevert("UserRegistry: name already exists");

    client.register("bob@example.com", "Alice", UserRole.Carrier);
  }
}
```

- [ ] **Step 14: Run the full Solidity suite and verify everything passes together**

Run: `npx hardhat build`
Expected: compiles clean — every contract and test file in `contracts/` now agrees on the native-ETH shape.

Run: `npx hardhat test solidity`
Expected: PASS — `Token.t.sol` (7 tests, untouched since Task 1), `EscrowTest` (7 tests), `AgreementFactoryTest` (7 tests), `LogisticsClientTest` (7 tests), `LogisticsContractTest` (all tests from the current file, unchanged in count) all green.

- [ ] **Step 15: Commit**

```bash
git add contracts/interfaces/IEscrow.sol contracts/Escrow.sol contracts/Escrow.t.sol \
        contracts/interfaces/IAgreementFactory.sol contracts/AgreementFactory.sol contracts/AgreementFactory.t.sol \
        contracts/interfaces/ILogisticsClient.sol contracts/LogisticsClient.sol contracts/LogisticsClient.t.sol \
        contracts/LogisticsContract.t.sol
git commit -m "Convert Escrow, AgreementFactory, and LogisticsClient to native-ETH funding"
```

---

## Task 3: Ignition module — stop deploying `Token`, `AgreementFactory` takes no args

**Files:**
- Modify: `ignition/modules/Logistics.ts`

**Interfaces:**
- Consumes: `AgreementFactory()` (Task 2, no-arg constructor).
- Produces: the module now returns `{ userRegistry, agreementFactory, logisticsClient }` (was `{ userRegistry, paymentToken, agreementFactory, logisticsClient }`) — `Token` isn't deployed by this module at all; nothing currently reads this module's `paymentToken` result (grep confirms no other file references it), so removing it is safe.

- [ ] **Step 1: Update the module**

Replace `ignition/modules/Logistics.ts` in full:

```typescript
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("LogisticsModule", (m) => {
  const userRegistry = m.contract("UserRegistry");
  const agreementFactory = m.contract("AgreementFactory");

  const logisticsClient = m.contract("LogisticsClient", [userRegistry, agreementFactory]);

  // One-time wiring so UserRegistry/AgreementFactory trust LogisticsClient as
  // their caller-forwarder (see the onlyClient modifiers on each).
  m.call(userRegistry, "setClient", [logisticsClient]);
  m.call(agreementFactory, "setClient", [logisticsClient]);

  return { userRegistry, agreementFactory, logisticsClient };
});
```

- [ ] **Step 2: Verify it deploys cleanly on an ephemeral network**

Run: `npx hardhat build`
Expected: compiles clean.

Run: `npx hardhat ignition deploy ignition/modules/Logistics.ts --network hardhatMainnet`
Expected: deploys three contracts (`LogisticsModule#UserRegistry`, `LogisticsModule#AgreementFactory`, `LogisticsModule#LogisticsClient`) and both `setClient` calls, printing their addresses with no errors. `hardhatMainnet` is Hardhat's in-memory ephemeral network, so this doesn't touch or conflict with the real `ignition/deployments/chain-1337/` records from prior Ganache deploys.

- [ ] **Step 3: Commit**

```bash
git add ignition/modules/Logistics.ts
git commit -m "Stop deploying Token in Ignition module; AgreementFactory takes no constructor args"
```

**Note for whoever next deploys to the real Ganache network:** `ignition/deployments/chain-1337/` has a deployment recorded against the *old* `AgreementFactory(address)` constructor and includes a `PaymentToken` entry. The next `--network ganache` deploy needs `--reset` to discard that stale record: `npx hardhat ignition deploy ignition/modules/Logistics.ts --network ganache --reset`. Not run as part of this plan since it touches a real running Ganache node this plan doesn't control.

---

## Task 4: `scripts/createTestAgreement.ts` — match the new `Escrow` ABI

**Files:**
- Modify: `scripts/createTestAgreement.ts`

**Interfaces:**
- Consumes: `Escrow(address _agreement)` constructor, `lockFund() external payable` (both Task 2).

This is your own hand-run script for manually setting up a test agreement against a live Ganache deployment — `SHIPPER`, `CARRIER`, `LOGISTICS_CLIENT` stay hardcoded and get hand-edited before each run, same as today. Only the `Escrow`/funding calls change, to match Task 2's ABI. `PAYMENT_TOKEN` goes away entirely — nothing left in this script needs it.

- [ ] **Step 1: Drop the `PAYMENT_TOKEN` constant**

In `scripts/createTestAgreement.ts`, remove:

```typescript
  const PAYMENT_TOKEN =
    "0xf9FD26612b81Af7BaC7E1d8d60Ff386d0bee0eBf";

```

(the blank line after it goes too, so `SHIPPER`/`CARRIER` lookup follows directly from `LOGISTICS_CLIENT`'s block as before).

- [ ] **Step 2: Deploy `Escrow` with one argument**

Replace:

```typescript
  const escrow = await Escrow.deploy(
    agreementAddress,
    PAYMENT_TOKEN
  );
```

with:

```typescript
  const escrow = await Escrow.deploy(
    agreementAddress
  );
```

- [ ] **Step 3: Fund the escrow with ETH instead of PAY**

Replace:

```typescript
  console.log("4. Funding escrow with 1 PAY...");

  const token = await ethers.getContractAt("PaymentToken", PAYMENT_TOKEN, shipper);
  await (await token.faucet()).wait();
  await (await token.transfer(escrowAddress, payout)).wait();
  tx = await escrow.connect(shipper).lockFund(payout);

  await tx.wait();

  console.log("Escrow funded.");
```

with:

```typescript
  console.log("4. Funding escrow with 1 ETH...");

  // shipper must already hold at least `payout` ETH on this Ganache network
  // (true for its default pre-funded accounts).
  tx = await escrow.connect(shipper).lockFund({ value: payout });

  await tx.wait();

  console.log("Escrow funded.");
```

- [ ] **Step 4: Verify it typechecks**

Run: `npx hardhat build`
Expected: compiles clean — this confirms the script has no leftover reference to the old `Escrow`/`PaymentToken` shape. The script itself still can't be run in this environment (it targets a specific live Ganache deployment with hardcoded addresses this plan has no access to) — running it manually against your own Ganache instance stays a step you do yourself, unchanged from today.

- [ ] **Step 5: Commit**

```bash
git add scripts/createTestAgreement.ts
git commit -m "Update createTestAgreement script for native-ETH Escrow"
```

---

## Task 5: Frontend — drop the ERC-20 faucet/approve flow

**Files:**
- Modify: `frontend/src/contracts/LogisticsClient.js`

**Interfaces:**
- Consumes: `this.contract.createAgreement(carrier, totalPayoutValue, duration, milestones, { value: totalPayoutValue })` — the contract-level method (from Task 2) is now `payable`, so ethers.js accepts an overrides object with `value` as its final argument.
- Produces: `LogisticsClient.createAgreement(carrier, totalPayoutValue, duration, milestones)` — same JS-level signature as before (see `LogisticsClient.d.ts`, unchanged), same return value (the new agreement's address).

- [ ] **Step 1: Replace the `createAgreement` method**

In `frontend/src/contracts/LogisticsClient.js`, replace:

```javascript
  async createAgreement(carrier, totalPayoutValue, duration, milestones) {
    // ERC-20 funding: the shipper must hold and approve enough PaymentToken
    // for the factory to pull via transferFrom. faucet() is dev/test-only
    // (see PaymentToken.sol) — top up automatically so the demo never blocks
    // on a separate "get test tokens" step.
    const token = getContract('PaymentToken', CHAIN_ID, this.signer);
    const me = await this.signer.getAddress();
    const factoryAddress = await this.contract.agreementFactory();

    if ((await token.balanceOf(me)) < totalPayoutValue) {
      await (await token.faucet()).wait();
    }
    if ((await token.allowance(me, factoryAddress)) < totalPayoutValue) {
      await (await token.approve(factoryAddress, totalPayoutValue)).wait();
    }

    const tx = await this.contract.createAgreement(carrier, totalPayoutValue, duration, milestones);
    await tx.wait();

    // createAgreement returns the new address on-chain, but a transaction
    // receipt cannot carry a return value. Reading the caller's agreements
    // back and taking the newest is the simplest way to recover it.
    const mine = await this.contract.listMyAgreements();
    return mine[mine.length - 1];
  }
```

with:

```javascript
  async createAgreement(carrier, totalPayoutValue, duration, milestones) {
    // Native-ETH funding: the shipper sends totalPayoutValue as msg.value
    // directly with the call, no separate approve step.
    const tx = await this.contract.createAgreement(carrier, totalPayoutValue, duration, milestones, {
      value: totalPayoutValue,
    });
    await tx.wait();

    // createAgreement returns the new address on-chain, but a transaction
    // receipt cannot carry a return value. Reading the caller's agreements
    // back and taking the newest is the simplest way to recover it.
    const mine = await this.contract.listMyAgreements();
    return mine[mine.length - 1];
  }
```

- [ ] **Step 2: Lint the frontend**

Run: `cd frontend && npm run lint`
Expected: no new errors (removed the now-unused `getContract`/`CHAIN_ID` usage inside this method — both are still used elsewhere in the file, e.g. the constructor and `getUserName`, so their imports stay).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/contracts/LogisticsClient.js
git commit -m "Fund agreements with native ETH from the frontend, drop faucet/approve"
```

---

## Task 6: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Full Solidity suite, one more time**

Run: `npx hardhat test solidity`
Expected: PASS — same green suite as the end of Task 2.

- [ ] **Step 2: Deploy to a persistent local node and run the seed script against it**

`hardhatMainnet` is an ephemeral in-memory network that resets between separate CLI invocations (Ignition doesn't even persist a deployment record for it), so a deploy and a script run as two separate commands against it don't share state. Use a real local node instead:

Start a persistent node in the background: `npx hardhat node` (note: needs to be stopped afterward).

Run: `npx hardhat ignition deploy ignition/modules/Logistics.ts --network localhost`
Expected: deploys `UserRegistry`, `AgreementFactory`, `LogisticsClient` with no errors (same as Task 3's check, confirming Task 4 didn't touch anything deploy-relevant).

Run: `npx hardhat run test/createAgreementTest.ts --network localhost`
Expected: this script already calls `client.connect(shipper).createAgreement(carrier.address, totalPayoutValue, duration, milestones, { value: totalPayoutValue })` — it was written for the native-ETH shape and never updated when the repo temporarily switched to ERC-20, so this is the first time it can actually pass end-to-end. Expected output: registration for both wallets, "Agreement deployed at: 0x...", "Funded with 3.0 ETH, split 30 / 70", and every entry under "Validation checks" printed as `rejected — ...` (none printed as `NOT REJECTED`).

Afterward: stop the background node, and delete the throwaway `ignition/deployments/chain-31337/` record it created (this is separate from the real `chain-1337` Ganache deployment — don't touch that one).

- [ ] **Step 3: Frontend build check**

Run: `cd frontend && npm run build`
Expected: builds clean — confirms `LogisticsClient.js`'s changed method has no syntax/reference errors beyond what `npm run lint` already caught.

No commit for this task — it's verification only, nothing to check in.
