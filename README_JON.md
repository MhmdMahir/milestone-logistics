# Implementation Changes

This document records the changes made for the native-ETH refund flow and standalone refund demonstration.

## Summary

The project now contains:

- A working `LogisticsClient` Solidity facade.
- An additive native-ETH agreement factory and escrow path.
- The existing ERC-20 escrow path preserved unchanged.
- A focused Solidity test for native agreement creation and deadline refund.
- A standalone frontend route at `/refund-demo`.
- A localStorage-backed refund simulation that follows the Solidity state machine.

## Backend Changes

### `contracts/LogisticsClient.sol`

Implemented the user-facing facade:

- Stores the `UserRegistry` address.
- Stores the native agreement factory address.
- Implements the constructor wiring.
- Implements `login()` by forwarding the caller to `UserRegistry`.
- Implements `register()` by forwarding the caller and profile data.
- Makes `createAgreement()` payable.
- Forwards `msg.value` and the original shipper address to the native factory.
- Implements `listMyAgreements()`.
- Implements `getAgreementDetails()`.
- Reads every milestone with `milestoneCount()` and `getMilestone()`.
- Implements `terminateAgreement()`.
- Implements `requestCheckpoint()`.
- Implements `approveCheckpoint()`.
- Implements `checkDeadlines()` by delegating to the agreement contract.
- Implements `listTransactions()`.
- Removes the unused empty `checkTermination()` function.
- Adds comments describing the trusted-forwarder facade and refund ownership.

`LogisticsClient` does not call `refund()` directly. The refund call remains owned by the agreement contract.

### `contracts/NativeAgreementFactory.sol`

Added a native-ETH version of the agreement factory:

- Accepts native ETH through a payable `createAgreement()`.
- Requires `msg.value == totalPayoutValue`.
- Deploys `LogisticsContract`.
- Deploys a paired `NativeEscrow`.
- Funds the escrow with native ETH.
- Activates the agreement after funding.
- Records the agreement for both shipper and carrier.
- Preserves the trusted `LogisticsClient` caller check.

The existing ERC-20 `AgreementFactory.sol` was not changed.

### `contracts/NativeEscrow.sol`

Added native-ETH escrow behavior:

- Stores ETH in the escrow contract balance.
- Reports `address(this).balance`.
- Releases ETH payments to the carrier.
- Refunds remaining ETH to the shipper.
- Allows only the paired agreement contract to release or refund funds.
- Preserves escrow status transitions: `Locked`, `Released`, and `Refunded`.

The existing ERC-20 `Escrow.sol` was not changed.

### Native interfaces

Added:

- `contracts/interfaces/INativeAgreementFactory.sol`
- `contracts/interfaces/INativeEscrow.sol`

These keep the native-ETH ABI separate from the original ERC-20 interfaces.

The original `IAgreementFactory.sol` and `IEscrow.sol` token-based interfaces remain available.

### `contracts/interfaces/ILogisticsClient.sol`

Updated `createAgreement()` to be payable so native ETH can be forwarded by the facade.

### `ignition/modules/Logistics.ts`

Changed the logistics deployment module to deploy:

```text
UserRegistry
NativeAgreementFactory
LogisticsClient
```

It also wires `UserRegistry` and `NativeAgreementFactory` to trust `LogisticsClient`.

The existing ERC-20 contracts remain available through a separate deployment configuration.

### `contracts/LogisticsClient.t.sol`

Added focused Solidity tests for:

- Registration and login forwarding.
- Native-ETH agreement creation.
- Agreement activation after funding.
- Deadline expiry with incomplete checkpoints.
- Agreement termination.
- Milestone failure.
- Native ETH refund to the shipper.
- Recording of the `Refund` transaction type.

## Refund Flow

The implemented refund path is:

```text
Caller
  -> LogisticsClient.checkDeadlines(agreement)
  -> LogisticsContract.checkDeadlines()
  -> active milestone deadline check
  -> milestone marked Failed
  -> LogisticsContract._terminate()
  -> Refund transaction recorded
  -> NativeEscrow.refund()
  -> remaining ETH sent to shipper
```

`checkDeadlines()` is permissionless but not automatic. A wallet, frontend, backend service, or keeper must submit the transaction.

The refund occurs only when:

- The agreement is `Activated`.
- The active milestone is `InProgress`.
- The blockchain timestamp is past the milestone deadline.

## Frontend Changes

### `frontend/src/pages/RefundDemo.jsx`

Added a standalone refund simulation page.

The page can:

- Create or reset a deterministic mock agreement.
- Use the connected wallet as both mock shipper and carrier.
- Display agreement status and remaining escrow.
- Display milestones and checkpoints.
- Request checkpoints.
- Approve checkpoints.
- Move the simulated date past the deadline.
- Invoke `checkDeadlines()`.
- Display the recorded transaction history.
- Show the resulting refund transaction.

This page uses the localStorage mock facade and does not submit blockchain transactions.

### `frontend/src/App.jsx`

Added the public route:

```text
/refund-demo
```

The route is separate from the protected main logistics flow, like `/counter-demo`.

### `frontend/src/contracts/LogisticsClient.js`

Extended the localStorage facade:

- Added a refund-demo agreement creation helper.
- Added a dedicated demo agreement key.
- Ensured the demo can use one wallet for both roles.
- Updated checkpoint approval behavior so final approval immediately completes the milestone.
- Added milestone payout recording for completed milestones.
- Kept deadline termination and refund transaction recording through `checkDeadlines()`.
- Added comments explaining the relationship between the mock and Solidity implementation.

### `frontend/src/contracts/index.js`

Updated the facade boundary comment to explain:

- The current refund demo uses the localStorage facade.
- A later live integration can return an ethers contract for `LogisticsClient`.
- The page API is intended to remain stable when switching implementations.

## Preserved Code

The following ERC-20 implementation was intentionally preserved:

- `contracts/Escrow.sol`
- `contracts/AgreementFactory.sol`
- `contracts/interfaces/IEscrow.sol`
- `contracts/interfaces/IAgreementFactory.sol`
- `contracts/PaymentToken.sol`

Native ETH support was added through separate contracts and interfaces rather than replacing the ERC-20 implementation.

## Validation

The following checks passed:

```bash
npx hardhat build
npx hardhat test solidity
npx tsc --noEmit
cd frontend
npm run build
```

Solidity test result:

```text
43 passing
```

The frontend build passed. Vite reported only a bundle-size warning for the generated JavaScript chunk.

## Testing the Native Refund

### Automated Solidity test

Run:

```bash
npx hardhat test solidity
```

The focused test creates a native agreement, leaves checkpoints incomplete, advances blockchain time with `vm.warp`, calls `checkDeadlines()`, and verifies the refund to the shipper.

### Frontend mock test

Run:

```bash
cd frontend
npm run dev
```

Open:

```text
http://localhost:5173/refund-demo
```

Then:

1. Click `Create mock agreement`.
2. Leave at least one checkpoint incomplete.
3. Click `Move past deadline`.
4. Click `Run checkDeadlines()`.
5. Confirm the milestone is `Failed`.
6. Confirm the agreement is `Terminated`.
7. Confirm remaining escrow is `0 ETH`.
8. Confirm a `Refund` transaction is listed for the shipper.

## Two-Wallet Testing

For the live native Solidity contracts:

- Wallet A should be the shipper and fund the agreement.
- Wallet B should be the carrier.
- Wallet B requests checkpoints.
- Wallet A approves checkpoints.
- Either wallet, or another keeper wallet, may call `checkDeadlines()`.
- Deadline failure refunds the remaining balance to Wallet A.

The current `/refund-demo` is intentionally a local single-wallet simulation. The main frontend facade still needs to be switched from localStorage to an ethers contract before the regular UI submits live native-ETH transactions.
