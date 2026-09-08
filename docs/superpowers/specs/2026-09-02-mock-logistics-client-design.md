# Mock LogisticsClient — Design Spec

Status: approved by user, pending written-spec review
Owner: frontend demo (no chain connection)

## Goal

Replace the current ad-hoc `localStorage` flags and hardcoded mock
arrays (`profile:<address>`, `CardList`'s inline `defaultAgreements`,
`AgreementDetail`'s inline `mockAgreements`) with one JS module,
`frontend/src/mock/logisticsClient.js`, that implements the full
business behavior of the `LogisticsClient` contract family
(`UserRegistry` + `AgreementFactory` + `LogisticsContract` + `Escrow`)
as a client-side simulation. Every page reads and writes through this
module instead of touching `localStorage` directly. No real chain
connection — this is a demo-only mock, explicitly requested to stay
JS-only.

`LogisticsClient.sol`'s own interface methods are currently empty
stubs (`{}`), so it is not itself a behavioral reference. The
authoritative behavior is the policy/business-rule document below,
which in one place (payout timing) explicitly diverges from what
`LogisticsContract.sol` currently does. The mock follows the policy
doc, not the partially-implemented `.sol`.

## Source policies and business rules (as given, authoritative)

**Policy 1 — Escrow-Based Payment.** All agreements are secured
on-chain; the Shipper must deposit the full agreed payment before the
agreement becomes active.

**Policy 2 — Milestone-Based Payment.** Payments are distributed
progressively per milestone; each payment is tied to a specific
milestone and its checkpoints.

**Policy 3 — Scheduled Payout.** Payments are not released immediately
on milestone completion. Once verified, the allocated payment stays
locked in escrow until its scheduled payout date (the milestone
deadline).

**Policy 4 — Maximum Contract Duration.** 90 days maximum from
activation.

**Policy 5 — Critical Milestone Enforcement.** Every milestone is
critical; missing its deadline terminates the whole agreement
automatically.

**Policy 6 — Automated Escrow Settlement.** Releases and refunds
happen automatically, without manual third-party intervention.

**Business Rule 1 — Agreement Creation.** An agreement holds: shipper
address, carrier address, total escrow amount, contract duration (max
90 days), milestones, milestone checkpoints, per-milestone payment
allocation, per-milestone deadline (= scheduled payout date). Sum of
milestone allocations must equal the total escrow amount.

**Business Rule 2 — Escrow Funding.** Shipper deposits 100% of the
total before activation; the agreement sits in "Pending Funding" until
the escrow contract has the full amount.

**Business Rule 3 — Contract Activation.** Auto-transitions to Active
once fully funded.

**Business Rule 4 — Milestone Management.** A milestone has one or
more checkpoints; it's "completed" only once every checkpoint is
verified; it must be completed on or before its deadline.

**Business Rule 5 — Payment Management.** On verification, the
milestone's payment stays locked until its scheduled payout date; on
that date, the contract auto-releases it to the Carrier.

**Business Rule 6 — Contract Completion.** Marked Completed only once
every milestone is completed AND every scheduled payment has been
released.

**Business Rule 7 — Failure Handling.** Missing any milestone's
deadline terminates the agreement automatically; all unreleased escrow
refunds to the Shipper; already-released payments for prior completed
milestones are not clawed back.

## Storage

Three `localStorage` keys, each a single JSON dict (no more
per-address key scheme):

- `mock:users` — `{ [address]: { walletAddress, name, mail, role } }`
  (`role` is `'Shipper' | 'Carrier'`)
- `mock:agreements` — `{ [agreementAddress]: Agreement }`
- `mock:transactions` — `{ [agreementAddress]: Transaction[] }`

`account` (current connected wallet) stays as-is — it's session state,
not part of the mocked contract world.

### Agreement shape

```js
{
  address,           // generated mock id, e.g. "0xAGMT_<random hex>"
  shipper,           // wallet address (creator)
  carrier,           // wallet address
  totalPayoutValue,  // number
  payoutRemaining,   // number — total minus whatever has actually been released
  duration,          // informational: days from activation to last milestone deadline
  status,            // 'Activated' | 'Terminated' | 'Completed'
  createdAt,         // ISO date string (activation date; funding is atomic, so no
                      // externally-visible 'Pending' window — see Open Decisions)
  milestones: [
    {
      title,
      deadline,        // 'YYYY-MM-DD', doubles as the scheduled payout date
      payoutPercent,
      status,          // 'Pending' | 'InProgress' | 'Verified' | 'Completed' | 'Failed'
      checkpoints: [
        { description, isRequested, isCompleted }
      ]
    }
  ]
}
```

`MilestoneStatus` gains a value the Solidity enum doesn't have:
**`Verified`** — all checkpoints approved, payout not yet released.
`Completed` is reserved for "verified AND paid." This is required to
implement Policy 3 / BR5 (verification and payout are different
events); Business Rule 4's "considered completed" is read as
`Verified` in this state machine, and `Completed` here specifically
means the BR6 sense ("all milestones completed and all scheduled
payments released").

### Transaction shape

```js
{ sender, receiver, amount, txType, timestamp }
// txType: 'AgreementCreation' | 'Payoff' | 'Refund'
```

## State machines

**Milestone:** `Pending → InProgress → Verified → Completed`, with
`InProgress → Failed` if Sim Date passes the deadline before full
verification. Only one milestone is ever `InProgress` at a time; the
next milestone flips to `InProgress` the instant the current one
becomes `Verified` (not gated on its payout).

**Agreement:** `Activated → Completed` (all milestones `Completed`) or
`Activated → Terminated` (any milestone `Failed`, or shipper calls
`terminateAgreement`). Both are terminal.

## Settlement sweep (drives Policy 6)

A single internal function, `_settle(agreement)`, evaluates an
agreement against the current Sim Date (`localStorage.simDate`, the
same clock `FloatAction.jsx` already drives) and:

1. If the `InProgress` milestone's deadline has passed and it isn't
   fully verified → mark it `Failed`, terminate the agreement, refund
   `payoutRemaining` to the shipper (`Refund` transaction).
2. For every `Verified` milestone whose deadline has been reached →
   release its payout (`Payoff` transaction to the carrier), mark it
   `Completed`, decrement `payoutRemaining`. If it was the last
   milestone, mark the agreement `Completed`.

`_settle` runs automatically inside `getAgreementDetails` and
`listMyAgreements` (lazy evaluation on every read) so dragging the Sim
Date slider and revisiting a page is what makes payouts/failures
visible — no separate "check deadlines" button needed for the
mechanism to work. `checkDeadlines(address)` is still exposed
standalone (mirrors `ILogisticsClient`, and gives an explicit "Check
Deadlines" action in the UI for transparency), implemented as a thin
wrapper calling the same `_settle`.

## Function surface (`frontend/src/mock/logisticsClient.js`)

All caller-identity checks use `localStorage.getItem('account')` as
`msg.sender`.

- `isRegistered(address)`
- `getUser(address)`
- `listRegisteredCarriers()` — filters `mock:users` by `role ===
  'Carrier'`; backs the carrier picker on Create.
- `register({ mail, name, role })` — throws if already registered.
- `login()` — returns the current account's profile, throws if
  unregistered.
- `createAgreement({ carrier, totalPayoutValue, duration, milestones
  })` — caller is shipper. Validates: carrier is a registered Carrier;
  milestone `payoutPercent`s sum to 100; last milestone deadline is
  within 90 days of today (Policy 4, defense-in-depth alongside the
  existing client-side form check). Activates immediately (funding is
  atomic in this mock — see Open Decisions), first milestone →
  `InProgress`, logs `AgreementCreation`. Returns the new agreement.
- `listMyAgreements()` — agreements where caller is shipper or
  carrier, each passed through `_settle` first.
- `getAgreementDetails(address)` — the agreement, through `_settle`
  first.
- `terminateAgreement(address)` — caller must be shipper, agreement
  must be `Activated`; refunds `payoutRemaining`.
- `requestCheckpoint(address, milestoneIndex, checkpointIndex)` —
  caller must be carrier; milestone must be `InProgress`; checkpoint
  not already completed.
- `approveCheckpoint(address, milestoneIndex, checkpointIndex)` —
  caller must be shipper; checkpoint must be requested and not
  completed. Marks it done; if every checkpoint in the milestone is
  now done, the milestone becomes `Verified` and the next milestone
  (if any) becomes `InProgress`. Does not release payout — that's
  `_settle`'s job, driven by Sim Date.
- `checkDeadlines(address)` — thin wrapper over `_settle`.
- `listTransactions(address)` — returns the stored array for that
  agreement.

All permission/state violations throw a plain `Error(message)`; pages
catch and surface via `alert(...)`, matching the existing pattern in
`CreateAgreement.jsx`.

## UI rewiring

- **Register.jsx** — calls `logisticsClient.register`.
- **App.jsx route guards** — call `logisticsClient.isRegistered`
  instead of raw `localStorage`.
- **MainPage.jsx** — greeting via `logisticsClient.login()`.
- **CardList.jsx** — real agreements via `listMyAgreements()`; drops
  the inline `defaultAgreements` mock entirely (per user decision: new
  accounts start empty, no seeded demo agreements).
- **CreateAgreement.jsx** — shipper field becomes read-only (current
  account via `login()`); carrier field becomes a dropdown from
  `listRegisteredCarriers()` (falls back to a manual-address input if
  none are registered yet); submit calls `createAgreement(...)`.
  Milestone/checkpoint/payout-splitter UI is unchanged; the RM
  admin/processing-fee display stays as cosmetic flavor, unrelated to
  the stored `totalPayoutValue`.
- **AgreementDetail.jsx** — real data via `getAgreementDetails` +
  `listTransactions`; drops the inline `mockAgreements` dict. Adds
  role-gated actions: Request Checkpoint (carrier, per checkpoint),
  Approve Checkpoint (shipper, per requested checkpoint), Terminate
  Agreement (shipper, while Activated), Check Deadlines (either role,
  explicit trigger for transparency even though reads already
  auto-settle). Route param changes from a numeric id to the
  agreement's mock address.
- **New Transactions.jsx** + `/transactions` route — wires up the
  header link that already exists but currently 404s. Lists
  transactions across every agreement the current account is party to
  (shipper or carrier), newest first.

Two-party demo flow (shipper creates, carrier requests, shipper
approves) works by switching the connected MetaMask account — state
is keyed by wallet address already, so a different connected address
is simply a different identity. No in-app account switcher is built.

## Open decisions carried from questions already answered

- Payout timing follows the policy doc (delayed to deadline), not the
  current `.sol` (immediate) — **confirmed**.
- Carrier selection is a dropdown of registered carriers —
  **confirmed**.
- Multi-party testing via real MetaMask account switching —
  **confirmed**.
- Deadline auto-termination and the transaction ledger/page are in
  scope — **confirmed**.
- Hardcoded seed agreements are dropped; new accounts start empty —
  **confirmed**.
- Funding is atomic within `createAgreement` (the shipper "pays" as
  part of the same action, same as `AgreementFactory.sol` doing
  `lockFund` + `activateContract` synchronously in one transaction) —
  so Business Rule 2's "Pending Funding" state is real internally but
  never externally observable in either the real contract or this
  mock. No separate "fund escrow" UI step is built.

## Out of scope

- Any real `ethers`/contract call — this module never touches
  `window.ethereum` beyond what `Login.jsx` already does to get an
  address.
- Persisting or syncing state across browsers/devices — `localStorage`
  only, same as the rest of the app.
- An in-app mock-account switcher (explicitly declined in favor of
  real MetaMask switching).
- Explicit `duration` input on the create form — kept derived
  (informational) from milestone deadlines, as today.

## Testing / verification approach

Same headless-browser smoke approach used for the register flow:
drive the full lifecycle (register two accounts as Shipper and
Carrier, create an agreement, request + approve checkpoints, advance
Sim Date past a payout deadline and confirm auto-release, advance past
an unmet deadline on a second agreement and confirm auto-termination +
refund, check the Transactions page) via a Playwright script, with
`console --errors` checked at each step. No unit-test framework is set
up for the frontend today, so this stays a manual/scripted smoke pass
rather than an automated suite — flagged here in case that should
change as part of the implementation plan.
