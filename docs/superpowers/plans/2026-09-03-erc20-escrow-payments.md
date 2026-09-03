# ERC-20 Escrow Payments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace native-ETH escrow (`payable`/`msg.value`/`address(this).balance`) with an ERC-20 token across the payment path, using a new dev-only `PaymentToken.sol` deployed locally for testing.

**Architecture:** `AgreementFactory` holds an immutable `IERC20 token` reference and pulls payment via `token.transferFrom(shipper, escrow, amount)` at agreement-creation time (it has to be the puller, not `Escrow`, since `Escrow`'s address doesn't exist until inside that same call — see spec). `Escrow` swaps its `payable`/`.call{value}` sends for `token.transfer`/`balanceOf`. `LogisticsClient` only loses the now-meaningless `payable` keyword on `createAgreement` — it stays an empty stub, out of scope here.

**Tech Stack:** Solidity ^0.8.34 (Hardhat 3), `forge-std` Solidity tests, OpenZeppelin Contracts (new dependency) for the ERC-20 base, Hardhat Ignition for deployment.

**Spec:** `docs/superpowers/specs/2026-09-03-erc20-escrow-payments-design.md`

## Global Constraints

- No `SafeERC20` — spec's explicit non-goal; plain `IERC20`/`ERC20` only.
- `PaymentToken.faucet()` is dev/test-only and must be clearly commented as such — never appropriate on a real deployment.
- Match existing revert-message style exactly: `"<ContractName>: <reason>"` strings (e.g. `"Escrow: not locked"`), except where OpenZeppelin's own custom errors apply (its `ERC20InsufficientAllowance`/`ERC20InsufficientBalance` reverts are not our string style — don't try to replicate them).
- `LogisticsClient.sol` gets only its `createAgreement` signature's `payable` keyword removed. No other logic — it stays an empty stub.
- Test commands (per project's `hardhat` skill): `npx hardhat build` to compile, `npx hardhat test solidity` for Solidity-only tests, `npx hardhat test` for the full suite.

---

## Task 1: PaymentToken.sol (new dev/test token)

**Files:**
- Modify: `package.json` (add `@openzeppelin/contracts` devDependency)
- Create: `contracts/PaymentToken.sol`
- Test: `contracts/PaymentToken.t.sol`

**Interfaces:**
- Produces: `contract PaymentToken is ERC20` — `constructor()` (name `"Payment Token"`, symbol `"PAY"`); `FAUCET_AMOUNT` (`uint256 public constant`, `1_000 * 10 ** 18`); `faucet() external` mints `FAUCET_AMOUNT` to `msg.sender`. Inherits standard `ERC20` (`balanceOf`, `transfer`, `approve`, `transferFrom`, `allowance`, `name`, `symbol`).

- [ ] **Step 1: Install the OpenZeppelin Contracts dependency**

```bash
npm install --save-dev @openzeppelin/contracts@^5.1.0
```

- [ ] **Step 2: Write the failing test**

Create `contracts/PaymentToken.t.sol`:

```solidity
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {Test} from "forge-std/Test.sol";
import {PaymentToken} from "./PaymentToken.sol";

contract PaymentTokenTest is Test {
  PaymentToken token;
  address alice = address(0xA11CE);
  address bob = address(0xB0B);

  function setUp() public {
    token = new PaymentToken();
  }

  function test_FaucetMintsFixedAmountToCaller() public {
    vm.prank(alice);
    token.faucet();

    assertEq(token.balanceOf(alice), token.FAUCET_AMOUNT());
  }

  function test_FaucetCanBeCalledByAnyAddress() public {
    vm.prank(alice);
    token.faucet();

    vm.prank(bob);
    token.faucet();

    assertEq(token.balanceOf(alice), token.FAUCET_AMOUNT());
    assertEq(token.balanceOf(bob), token.FAUCET_AMOUNT());
  }

  function test_FaucetIsAdditiveAcrossMultipleCalls() public {
    vm.startPrank(alice);
    token.faucet();
    token.faucet();
    vm.stopPrank();

    assertEq(token.balanceOf(alice), token.FAUCET_AMOUNT() * 2);
  }

  function test_NameAndSymbol() public view {
    assertEq(token.name(), "Payment Token");
    assertEq(token.symbol(), "PAY");
  }
}
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx hardhat test solidity`
Expected: FAIL to compile — `PaymentToken.sol` doesn't exist yet (`Source "contracts/PaymentToken.sol" not found`).

- [ ] **Step 4: Write the implementation**

Create `contracts/PaymentToken.sol`:

```solidity
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Dev/test-only payment token for local Ganache testing. `faucet()` lets
// any address mint itself test funds - this function must never exist on
// a real deployment, since it lets anyone mint unlimited value.
contract PaymentToken is ERC20 {
  uint256 public constant FAUCET_AMOUNT = 1_000 * 10 ** 18;

  constructor() ERC20("Payment Token", "PAY") {}

  function faucet() external {
    _mint(msg.sender, FAUCET_AMOUNT);
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx hardhat test solidity`
Expected: PASS — all 4 `PaymentTokenTest` cases green.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json contracts/PaymentToken.sol contracts/PaymentToken.t.sol
git commit -m "Add dev/test PaymentToken (ERC-20) with an open faucet"
```

---

## Task 2: Escrow.sol / IEscrow.sol — ERC-20 conversion

**Files:**
- Modify: `contracts/interfaces/IEscrow.sol`
- Modify: `contracts/Escrow.sol`
- Modify: `contracts/Escrow.t.sol`

**Interfaces:**
- Consumes: `PaymentToken` (Task 1) — `new PaymentToken()`, `faucet()`, `balanceOf(address)`, `transfer(address, uint256)`.
- Produces: `Escrow(address _agreement, address _token)` constructor (was `Escrow(address _agreement)`); `lockFund(uint256 amount) external` (was `lockFund() external payable`); `balance()` now reads ERC-20 balance instead of ETH balance (signature unchanged: `external view returns (uint256)`). `releasePayment`/`refund`/`status`/`agreement` signatures unchanged.

- [ ] **Step 1: Write the failing test**

Replace `contracts/Escrow.t.sol` in full:

```solidity
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {Test} from "forge-std/Test.sol";
import {Escrow} from "./Escrow.sol";
import {IEscrow} from "./interfaces/IEscrow.sol";
import {EscrowStatus} from "./interfaces/Types.sol";
import {PaymentToken} from "./PaymentToken.sol";

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
  PaymentToken token;
  MockAgreement agreement;
  address shipperWallet = address(0xA11CE);
  address carrierWallet = address(0xB0B);
  address stranger = address(0xBAD);

  function setUp() public {
    agreement = new MockAgreement(shipperWallet, carrierWallet);
    token = new PaymentToken();
    escrow = new Escrow(address(agreement), address(token));
    token.faucet(); // gives address(this) PaymentToken.FAUCET_AMOUNT (1000e18)
  }

  // Mirrors what AgreementFactory really does: move tokens into escrow,
  // then tell it how much just arrived.
  function _fund(uint256 amount) internal {
    token.transfer(address(escrow), amount);
    escrow.lockFund(amount);
  }

  function test_LockFundIncreasesBalance() public {
    _fund(3 ether);
    assertEq(escrow.balance(), 3 ether);
  }

  function test_RevertWhen_ReleasePaymentCalledByNonAgreement() public {
    _fund(1 ether);

    vm.prank(stranger);
    vm.expectRevert("Escrow: caller is not the agreement");
    escrow.releasePayment(1 ether);
  }

  function test_ReleasePaymentSendsToCarrierAndEmits() public {
    _fund(1 ether);
    uint256 before = token.balanceOf(carrierWallet);

    vm.prank(address(agreement));
    vm.expectEmit(true, false, false, true, address(escrow));
    emit IEscrow.PaymentReleased(carrierWallet, 0.4 ether);
    escrow.releasePayment(0.4 ether);

    assertEq(token.balanceOf(carrierWallet), before + 0.4 ether);
    assertEq(escrow.balance(), 0.6 ether);
  }

  function test_ReleasePaymentMarksReleasedWhenBalanceFullyDrained() public {
    _fund(1 ether);

    vm.prank(address(agreement));
    escrow.releasePayment(1 ether);

    assertEq(uint256(escrow.status()), uint256(EscrowStatus.Released));
  }

  function test_RevertWhen_RefundCalledByNonAgreement() public {
    _fund(1 ether);

    vm.prank(stranger);
    vm.expectRevert("Escrow: caller is not the agreement");
    escrow.refund();
  }

  function test_RefundSendsRemainingBalanceToShipperAndMarksRefunded() public {
    _fund(2 ether);
    uint256 before = token.balanceOf(shipperWallet);

    vm.prank(address(agreement));
    vm.expectEmit(true, false, false, true, address(escrow));
    emit IEscrow.Refunded(shipperWallet, 2 ether);
    escrow.refund();

    assertEq(token.balanceOf(shipperWallet), before + 2 ether);
    assertEq(escrow.balance(), 0);
    assertEq(uint256(escrow.status()), uint256(EscrowStatus.Refunded));
  }

  function test_RevertWhen_ReleasePaymentAfterRefunded() public {
    _fund(1 ether);

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
Expected: FAIL to compile — `Escrow`'s constructor still takes one argument, `lockFund()` still takes zero (and is `payable`), so `new Escrow(address(agreement), address(token))` and `escrow.lockFund(amount)` don't match the current signatures.

- [ ] **Step 3: Update the interface**

In `contracts/interfaces/IEscrow.sol`, replace:

```solidity
  function lockFund() external payable;
```

with:

```solidity
  // Amount already sits in this escrow (moved there by the caller, e.g.
  // AgreementFactory pulling from the shipper via transferFrom) - this just
  // records/confirms it arrived.
  function lockFund(uint256 amount) external;
```

- [ ] **Step 4: Update the implementation**

Replace `contracts/Escrow.sol` in full:

```solidity
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IEscrow} from "./interfaces/IEscrow.sol";
import {IAgreementInfo} from "./interfaces/IAgreementInfo.sol";
import {EscrowStatus} from "./interfaces/Types.sol";

contract Escrow is IEscrow {
  address public agreement;
  IERC20 public immutable token;
  EscrowStatus public status;

  modifier onlyAgreement() {
    require(msg.sender == agreement, "Escrow: caller is not the agreement");
    _;
  }

  constructor(address _agreement, address _token) {
    agreement = _agreement;
    token = IERC20(_token);
  }

  function balance() external view returns (uint256) {
    return token.balanceOf(address(this));
  }

  function lockFund(uint256 amount) external {
    emit FundLocked(msg.sender, amount);
  }

  function releasePayment(uint256 amount) external onlyAgreement {
    require(status == EscrowStatus.Locked, "Escrow: not locked");

    address to = IAgreementInfo(agreement).carrier();
    if (token.balanceOf(address(this)) == amount) {
      status = EscrowStatus.Released;
    }
    require(token.transfer(to, amount), "Escrow: transfer failed");

    emit PaymentReleased(to, amount);
  }

  function refund() external onlyAgreement {
    require(status == EscrowStatus.Locked, "Escrow: not locked");

    address to = IAgreementInfo(agreement).shipper();
    uint256 amount = token.balanceOf(address(this));
    status = EscrowStatus.Refunded;
    require(token.transfer(to, amount), "Escrow: transfer failed");

    emit Refunded(to, amount);
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx hardhat test solidity`
Expected: PASS — all 7 `EscrowTest` cases green (`PaymentTokenTest` from Task 1 still green too).

- [ ] **Step 6: Commit**

```bash
git add contracts/interfaces/IEscrow.sol contracts/Escrow.sol contracts/Escrow.t.sol
git commit -m "Convert Escrow to ERC-20 token payments"
```

---

## Task 3: AgreementFactory.sol / IAgreementFactory.sol — ERC-20 conversion

**Files:**
- Modify: `contracts/interfaces/IAgreementFactory.sol`
- Modify: `contracts/AgreementFactory.sol`
- Modify: `contracts/AgreementFactory.t.sol`

**Interfaces:**
- Consumes: `Escrow(address _agreement, address _token)` (Task 2); `PaymentToken` (Task 1) — `faucet()`, `approve(address, uint256)`, `balanceOf(address)`.
- Produces: `AgreementFactory(address _token)` constructor (was implicit/no-arg); `createAgreement(...)` drops `payable` (all other params unchanged, still returns `address agreement`). `setClient`/`listAgreementsByUser`/`client`/`token` (new public getter) unchanged/added.

- [ ] **Step 1: Write the failing test**

Replace `contracts/AgreementFactory.t.sol` in full:

```solidity
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {Test} from "forge-std/Test.sol";
import {AgreementFactory} from "./AgreementFactory.sol";
import {IAgreementFactory} from "./interfaces/IAgreementFactory.sol";
import {LogisticsContract} from "./LogisticsContract.sol";
import {PaymentToken} from "./PaymentToken.sol";
import {ContractStatus, MilestoneInput, MilestoneStatus} from "./interfaces/Types.sol";

contract AgreementFactoryTest is Test {
  AgreementFactory factory;
  PaymentToken token;

  address client = address(0xC11E47);
  address shipperWallet = address(0xA11CE);
  address carrierWallet = address(0xB0B);

  uint256 totalPayoutValue = 10 ether;

  function setUp() public {
    token = new PaymentToken();
    factory = new AgreementFactory(address(token));
    factory.setClient(client);

    vm.prank(shipperWallet);
    token.faucet();
    vm.prank(shipperWallet);
    token.approve(address(factory), type(uint256).max);
  }

  function _defaultMilestones() internal view returns (MilestoneInput[] memory milestones) {
    milestones = new MilestoneInput[](1);

    string[] memory checkpoints = new string[](1);
    checkpoints[0] = "Delivered";
    milestones[0] = MilestoneInput({deadline: block.timestamp + 1 days, payoutPercent: 100, title: "Only leg", checkpointDescriptions: checkpoints});
  }

  function test_RevertWhen_PaymentAllowanceIsInsufficient() public {
    vm.prank(shipperWallet);
    token.approve(address(factory), 1 ether);

    vm.prank(client);
    vm.expectRevert();
    factory.createAgreement(shipperWallet, carrierWallet, totalPayoutValue, 1 days, _defaultMilestones());
  }

  function test_RevertWhen_CreateAgreementCalledByNonClient() public {
    vm.prank(shipperWallet);
    vm.expectRevert("AgreementFactory: caller is not the client");
    factory.createAgreement(shipperWallet, carrierWallet, totalPayoutValue, 1 days, _defaultMilestones());
  }

  function test_CreateAgreementDeploysActivatedAndFundedAgreement() public {
    vm.prank(client);
    address agreementAddress = factory.createAgreement(
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
    address agreementAddress = factory.createAgreement(
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
    factory.createAgreement(shipperWallet, carrierWallet, totalPayoutValue, 1 days, _defaultMilestones());
  }

  function test_CreateAgreementPullsPaymentFromShipperIntoEscrow() public {
    uint256 shipperBalanceBefore = token.balanceOf(shipperWallet);

    vm.prank(client);
    address agreementAddress = factory.createAgreement(
      shipperWallet, carrierWallet, totalPayoutValue, 1 days, _defaultMilestones()
    );

    LogisticsContract agreement = LogisticsContract(agreementAddress);
    assertEq(token.balanceOf(shipperWallet), shipperBalanceBefore - totalPayoutValue);
    assertEq(token.balanceOf(agreement.escrow()), totalPayoutValue);
  }

  function test_RevertWhen_SetClientCalledTwice() public {
    vm.expectRevert("AgreementFactory: client already set");
    factory.setClient(address(0xBAD));
  }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx hardhat test solidity`
Expected: FAIL to compile — `new AgreementFactory(address(token))` doesn't match the current no-arg constructor, and `createAgreement` is still called without `{value: ...}` while still being `payable` with a `msg.value` check internally that these new tests never satisfy.

- [ ] **Step 3: Update the interface**

In `contracts/interfaces/IAgreementFactory.sol`, replace:

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

with:

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

- [ ] **Step 4: Update the implementation**

Replace `contracts/AgreementFactory.sol` in full:

```solidity
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
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx hardhat test solidity`
Expected: PASS — all 7 `AgreementFactoryTest` cases green (Tasks 1-2's tests still green too).

- [ ] **Step 6: Commit**

```bash
git add contracts/interfaces/IAgreementFactory.sol contracts/AgreementFactory.sol contracts/AgreementFactory.t.sol
git commit -m "Convert AgreementFactory to pull payment via ERC-20 transferFrom"
```

---

## Task 4: LogisticsClient.sol / ILogisticsClient.sol — drop `payable`

**Files:**
- Modify: `contracts/interfaces/ILogisticsClient.sol`
- Modify: `contracts/LogisticsClient.sol`

**Interfaces:**
- Consumes: nothing new (still calls into `IAgreementFactory`/`IUserRegistry`, both interfaces already read).
- Produces: `createAgreement(...)` loses `payable` (signature otherwise unchanged: same params, same `returns (address agreement)`). No other method touched — `LogisticsClient` remains an empty stub.

- [ ] **Step 1: Update the interface**

In `contracts/interfaces/ILogisticsClient.sol`, replace:

```solidity
  function createAgreement(
    address carrier,
    uint256 totalPayoutValue,
    uint256 duration,
    MilestoneInput[] calldata milestones
  ) external payable returns (address agreement);
```

with:

```solidity
  function createAgreement(
    address carrier,
    uint256 totalPayoutValue,
    uint256 duration,
    MilestoneInput[] calldata milestones
  ) external returns (address agreement);
```

- [ ] **Step 2: Update the implementation**

In `contracts/LogisticsClient.sol`, replace:

```solidity
  function createAgreement(
    address carrier,
    uint256 totalPayoutValue,
    uint256 duration,
    MilestoneInput[] calldata milestones
  ) external payable returns (address agreement) {}
```

with:

```solidity
  function createAgreement(
    address carrier,
    uint256 totalPayoutValue,
    uint256 duration,
    MilestoneInput[] calldata milestones
  ) external returns (address agreement) {}
```

- [ ] **Step 3: Verify the whole project still compiles and every test still passes**

Run: `npx hardhat build`
Expected: compiles clean (no other file references `LogisticsClient.createAgreement` with `{value: ...}`, so nothing else breaks).

Run: `npx hardhat test solidity`
Expected: PASS — full suite green, same count as end of Task 3 (this task adds no new tests; there is no `LogisticsClient.t.sol` yet, matching the project's current state).

- [ ] **Step 4: Commit**

```bash
git add contracts/interfaces/ILogisticsClient.sol contracts/LogisticsClient.sol
git commit -m "Drop payable from LogisticsClient.createAgreement for ERC-20 payments"
```

---

## Task 5: Ignition module — deploy PaymentToken and wire it in

**Files:**
- Modify: `ignition/modules/Logistics.ts`

**Interfaces:**
- Consumes: `PaymentToken` (Task 1, no-arg constructor), `AgreementFactory(address _token)` (Task 3).
- Produces: the module now returns `{ paymentToken, userRegistry, agreementFactory, logisticsClient }` (was `{ userRegistry, agreementFactory, logisticsClient }`) — anything reading this module's results (none currently in this repo) gains a `paymentToken` key.

- [ ] **Step 1: Update the module**

Replace `ignition/modules/Logistics.ts` in full:

```typescript
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("LogisticsModule", (m) => {
  const paymentToken = m.contract("PaymentToken");
  const userRegistry = m.contract("UserRegistry");
  const agreementFactory = m.contract("AgreementFactory", [paymentToken]);

  const logisticsClient = m.contract("LogisticsClient", [userRegistry, agreementFactory]);

  // One-time wiring so UserRegistry/AgreementFactory trust LogisticsClient as
  // their caller-forwarder (see the onlyClient modifiers on each).
  m.call(userRegistry, "setClient", [logisticsClient]);
  m.call(agreementFactory, "setClient", [logisticsClient]);

  return { paymentToken, userRegistry, agreementFactory, logisticsClient };
});
```

- [ ] **Step 2: Verify it deploys cleanly on an ephemeral network**

Run: `npx hardhat build`
Expected: compiles clean.

Run: `npx hardhat ignition deploy ignition/modules/Logistics.ts --network hardhatMainnet`
Expected: deploys all four contracts (`LogisticsModule#PaymentToken`, `LogisticsModule#UserRegistry`, `LogisticsModule#AgreementFactory`, `LogisticsModule#LogisticsClient`) and both `setClient` calls, printing their addresses with no errors. `hardhatMainnet` is Hardhat's in-memory ephemeral network (per `hardhat.config.ts`), so this doesn't touch or conflict with the real `ignition/deployments/chain-1337/` records from prior Ganache deploys.

- [ ] **Step 3: Commit**

```bash
git add ignition/modules/Logistics.ts
git commit -m "Deploy PaymentToken and wire it into AgreementFactory"
```

**Note for whoever next deploys to the real Ganache network:** `ignition/deployments/chain-1337/` already has a deployment recorded against the *old* `AgreementFactory` constructor (no token arg). The next `--network ganache` deploy will need `--reset` to discard that stale record: `npx hardhat ignition deploy ignition/modules/Logistics.ts --network ganache --reset`. Not run as part of this plan since it touches a real running Ganache node this plan doesn't control.
