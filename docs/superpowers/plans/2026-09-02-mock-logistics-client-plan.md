# Mock LogisticsClient Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ad-hoc `localStorage` flags and hardcoded mock arrays in the frontend with one JS module, `frontend/src/mock/logisticsClient.js`, that fully simulates the `LogisticsClient`/`UserRegistry`/`AgreementFactory`/`LogisticsContract`/`Escrow` contract family's business behavior client-side, and rewire every page to use it.

**Architecture:** A small internal layer (`storage.js`, `simDate.js`, `users.js`, `settlement.js`, `agreements.js`) implements the mock, with `logisticsClient.js` as the single public facade every page imports. State lives in three `localStorage` JSON dicts (`mock:users`, `mock:agreements`, `mock:transactions`). A settlement sweep (`settleAgreement`) evaluates deadline failures and scheduled payouts against the existing Sim Date mechanism, run lazily on every read.

**Tech Stack:** React 19 + Vite (existing), plain JS (no TypeScript in `frontend/`), Node's built-in `node --test` runner for unit tests (no new test framework dependency), Playwright (added as a devDependency in Task 1) for browser smoke checks.

**Spec:** `docs/superpowers/specs/2026-09-02-mock-logistics-client-design.md`

## Global Constraints

- No real `ethers`/contract calls anywhere in this module — mock only.
- Deadlines and `createdAt`/payout dates are `'YYYY-MM-DD'` strings compared against `localStorage.getItem('simDate')`, the same clock `frontend/src/components/FloatAction.jsx` already drives — never `Date.now()`.
- Payout release is delayed until a milestone's deadline (Policy 3 / BR5), via a `Verified` milestone status not present in the Solidity enum — verification and payout are separate events.
- Error messages reuse the exact Solidity `require(...)` strings where an equivalent check exists (e.g. `"UserRegistry: already registered"`, `"LogisticsContract: caller is not the shipper"`), thrown as plain `Error`.
- New accounts start with an empty agreement list — no seeded demo data.
- Multi-party testing (shipper vs. carrier) happens by switching the connected wallet address in `localStorage.account` — no in-app account switcher.

---

## Task 1: Storage & Sim Date helpers, test runner, Playwright setup

**Files:**
- Create: `frontend/src/mock/storage.js`
- Create: `frontend/src/mock/simDate.js`
- Create: `frontend/test/mock/testHelpers.js`
- Test: `frontend/test/mock/storage.test.js`
- Test: `frontend/test/mock/simDate.test.js`
- Modify: `frontend/package.json`

**Interfaces:**
- Produces: `readDict(key: string): object`, `writeDict(key: string, dict: object): void` from `storage.js` (keys are namespaced under `mock:` internally, e.g. `readDict('users')` reads `localStorage['mock:users']`). `getSimDate(): string` from `simDate.js` (returns `'YYYY-MM-DD'`, falling back to today if `localStorage.simDate` is unset). `makeFakeStorage()`, `resetMockEnvironment({account, simDate})`, `setAccount(address)`, `setSimDate(date)` from `test/mock/testHelpers.js`, used by every later unit test file.

- [ ] **Step 1: Add the test runner script and Playwright devDependency to package.json**

Edit `frontend/package.json`:

```json
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "oxlint",
    "preview": "vite preview",
    "test": "node --test test/"
  },
```

Add to `devDependencies`:

```json
    "playwright": "^1.62.1"
```

Run:
```bash
cd frontend && npm install
npx playwright install chromium --with-deps
```

- [ ] **Step 2: Write the test helper module**

Create `frontend/test/mock/testHelpers.js`:

```js
export function makeFakeStorage() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
}

export function resetMockEnvironment({ account, simDate } = {}) {
  globalThis.localStorage = makeFakeStorage();
  if (account) globalThis.localStorage.setItem('account', account);
  if (simDate) globalThis.localStorage.setItem('simDate', simDate);
}

export function setAccount(address) {
  globalThis.localStorage.setItem('account', address);
}

export function setSimDate(date) {
  globalThis.localStorage.setItem('simDate', date);
}
```

- [ ] **Step 3: Write the failing tests for storage.js**

Create `frontend/test/mock/storage.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resetMockEnvironment } from './testHelpers.js';
import { readDict, writeDict } from '../../src/mock/storage.js';

test('readDict returns an empty object when nothing is stored', () => {
  resetMockEnvironment();
  assert.deepEqual(readDict('users'), {});
});

test('writeDict then readDict round-trips the same data', () => {
  resetMockEnvironment();
  writeDict('users', { '0xabc': { name: 'Jane' } });
  assert.deepEqual(readDict('users'), { '0xabc': { name: 'Jane' } });
});

test('writeDict namespaces keys under mock: so it does not collide with account/simDate', () => {
  resetMockEnvironment();
  writeDict('agreements', { foo: 'bar' });
  assert.equal(globalThis.localStorage.getItem('mock:agreements'), '{"foo":"bar"}');
  assert.equal(globalThis.localStorage.getItem('agreements'), null);
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `cd frontend && node --test test/mock/storage.test.js`
Expected: FAIL — `../../src/mock/storage.js` does not exist yet.

- [ ] **Step 5: Implement storage.js**

Create `frontend/src/mock/storage.js`:

```js
const PREFIX = 'mock:';

export function readDict(key) {
  const raw = localStorage.getItem(`${PREFIX}${key}`);
  return raw ? JSON.parse(raw) : {};
}

export function writeDict(key, dict) {
  localStorage.setItem(`${PREFIX}${key}`, JSON.stringify(dict));
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd frontend && node --test test/mock/storage.test.js`
Expected: PASS (3 tests)

- [ ] **Step 7: Write the failing tests for simDate.js**

Create `frontend/test/mock/simDate.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resetMockEnvironment } from './testHelpers.js';
import { getSimDate } from '../../src/mock/simDate.js';

test('getSimDate returns the stored simDate when present', () => {
  resetMockEnvironment({ simDate: '2026-09-01' });
  assert.equal(getSimDate(), '2026-09-01');
});

test('getSimDate falls back to today when nothing is stored', () => {
  resetMockEnvironment();
  const today = new Date().toISOString().split('T')[0];
  assert.equal(getSimDate(), today);
});
```

- [ ] **Step 8: Run to verify it fails, then implement simDate.js**

Run: `cd frontend && node --test test/mock/simDate.test.js` — expect FAIL (module missing).

Create `frontend/src/mock/simDate.js`:

```js
export function getSimDate() {
  return localStorage.getItem('simDate') || new Date().toISOString().split('T')[0];
}
```

- [ ] **Step 9: Run all Task 1 tests to verify they pass**

Run: `cd frontend && node --test test/mock/`
Expected: PASS (5 tests total)

- [ ] **Step 10: Commit**

```bash
cd frontend && git add package.json package-lock.json src/mock/storage.js src/mock/simDate.js test/mock/testHelpers.js test/mock/storage.test.js test/mock/simDate.test.js
git commit -m "Add mock storage/simDate helpers, node --test runner, Playwright devDependency"
```

---

## Task 2: User registry (`users.js`)

**Files:**
- Create: `frontend/src/mock/users.js`
- Test: `frontend/test/mock/users.test.js`

**Interfaces:**
- Consumes: `readDict`, `writeDict` from `storage.js` (Task 1).
- Produces: `getCurrentAccount(): string|null`, `isRegistered(address: string): boolean`, `getUser(address: string): {walletAddress, mail, name, role}|null`, `listRegisteredCarriers(): Array<{walletAddress, mail, name, role}>`, `register({mail, name, role}): {walletAddress, mail, name, role}` (throws `"UserRegistry: already registered"` if the current account already has a profile), `login(): {walletAddress, mail, name, role}` (throws `"UserRegistry: not registered"` if none). All consumed by Task 5 (`logisticsClient.js` facade) and Tasks 4, 6-10 (UI).

- [ ] **Step 1: Write the failing tests**

Create `frontend/test/mock/users.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resetMockEnvironment, setAccount } from './testHelpers.js';
import { isRegistered, getUser, listRegisteredCarriers, register, login } from '../../src/mock/users.js';

test('register saves a profile for the current account and returns it', () => {
  resetMockEnvironment({ account: '0xship' });
  const profile = register({ mail: 'a@b.com', name: 'Alice', role: 'Shipper' });
  assert.deepEqual(profile, { walletAddress: '0xship', mail: 'a@b.com', name: 'Alice', role: 'Shipper' });
  assert.equal(isRegistered('0xship'), true);
});

test('register throws if the account already registered', () => {
  resetMockEnvironment({ account: '0xship' });
  register({ mail: 'a@b.com', name: 'Alice', role: 'Shipper' });
  assert.throws(
    () => register({ mail: 'a@b.com', name: 'Alice', role: 'Shipper' }),
    /UserRegistry: already registered/
  );
});

test('login returns the profile for the current account', () => {
  resetMockEnvironment({ account: '0xship' });
  register({ mail: 'a@b.com', name: 'Alice', role: 'Shipper' });
  assert.equal(login().name, 'Alice');
});

test('login throws when the current account has not registered', () => {
  resetMockEnvironment({ account: '0xnobody' });
  assert.throws(() => login(), /UserRegistry: not registered/);
});

test('getUser returns null for an unknown address', () => {
  resetMockEnvironment();
  assert.equal(getUser('0xghost'), null);
});

test('listRegisteredCarriers only returns Carrier-role profiles', () => {
  resetMockEnvironment({ account: '0xship' });
  register({ mail: 'a@b.com', name: 'Alice', role: 'Shipper' });
  setAccount('0xcarrier');
  register({ mail: 'c@d.com', name: 'Bob', role: 'Carrier' });
  const carriers = listRegisteredCarriers();
  assert.equal(carriers.length, 1);
  assert.equal(carriers[0].name, 'Bob');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && node --test test/mock/users.test.js`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement users.js**

Create `frontend/src/mock/users.js`:

```js
import { readDict, writeDict } from './storage.js';

export function getCurrentAccount() {
  return localStorage.getItem('account');
}

export function isRegistered(address) {
  if (!address) return false;
  return Boolean(readDict('users')[address]);
}

export function getUser(address) {
  return readDict('users')[address] || null;
}

export function listRegisteredCarriers() {
  return Object.values(readDict('users')).filter((u) => u.role === 'Carrier');
}

export function register({ mail, name, role }) {
  const account = getCurrentAccount();
  if (!account) {
    throw new Error('UserRegistry: no connected account');
  }
  const users = readDict('users');
  if (users[account]) {
    throw new Error('UserRegistry: already registered');
  }
  users[account] = { walletAddress: account, mail, name, role };
  writeDict('users', users);
  return users[account];
}

export function login() {
  const account = getCurrentAccount();
  const profile = readDict('users')[account];
  if (!profile) {
    throw new Error('UserRegistry: not registered');
  }
  return profile;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && node --test test/mock/users.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/mock/users.js test/mock/users.test.js
git commit -m "Add mock user registry (register/login/carrier directory)"
```

---

## Task 3: Settlement sweep (`settlement.js`)

**Files:**
- Create: `frontend/src/mock/settlement.js`
- Test: `frontend/test/mock/settlement.test.js`

**Interfaces:**
- Consumes: `getSimDate` from `simDate.js` (Task 1).
- Produces: `settleAgreement(agreement: Agreement): {agreement: Agreement, transactions: Transaction[]}` — pure function, does not touch `localStorage` itself except reading `simDate` via `getSimDate()`. Consumed by Task 4 (`agreements.js`).
- Agreement/Transaction shapes as defined in the spec: `agreement.milestones[i].status` is one of `'Pending'|'InProgress'|'Verified'|'Completed'|'Failed'`; `agreement.status` is one of `'Activated'|'Terminated'|'Completed'`; `Transaction` is `{sender, receiver, amount, txType, timestamp}` with `txType` one of `'AgreementCreation'|'Payoff'|'Refund'`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/test/mock/settlement.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resetMockEnvironment } from './testHelpers.js';
import { settleAgreement } from '../../src/mock/settlement.js';

function baseAgreement(overrides = {}) {
  return {
    address: '0xAGMT_1',
    shipper: '0xship',
    carrier: '0xcarrier',
    totalPayoutValue: 1000,
    payoutRemaining: 1000,
    duration: 30,
    status: 'Activated',
    createdAt: '2026-08-01',
    milestones: [
      { title: 'M1', deadline: '2026-08-10', payoutPercent: 50, status: 'InProgress', checkpoints: [{ description: 'c1', isRequested: false, isCompleted: false }] },
      { title: 'M2', deadline: '2026-08-20', payoutPercent: 50, status: 'Pending', checkpoints: [{ description: 'c2', isRequested: false, isCompleted: false }] },
    ],
    ...overrides,
  };
}

test('settleAgreement leaves non-Activated agreements untouched', () => {
  resetMockEnvironment({ simDate: '2026-09-01' });
  const agreement = baseAgreement({ status: 'Terminated' });
  const { agreement: result, transactions } = settleAgreement(agreement);
  assert.equal(result.status, 'Terminated');
  assert.deepEqual(transactions, []);
});

test('an InProgress milestone whose deadline has passed fails and terminates with a full refund', () => {
  resetMockEnvironment({ simDate: '2026-08-11' });
  const { agreement, transactions } = settleAgreement(baseAgreement());
  assert.equal(agreement.status, 'Terminated');
  assert.equal(agreement.milestones[0].status, 'Failed');
  assert.equal(agreement.payoutRemaining, 0);
  assert.deepEqual(transactions, [{
    sender: '0xAGMT_1', receiver: '0xship', amount: 1000, txType: 'Refund', timestamp: new Date('2026-08-11').getTime(),
  }]);
});

test('a Verified milestone releases its payout once Sim Date reaches its deadline', () => {
  resetMockEnvironment({ simDate: '2026-08-10' });
  const input = baseAgreement({
    milestones: [
      { title: 'M1', deadline: '2026-08-10', payoutPercent: 50, status: 'Verified', checkpoints: [{ description: 'c1', isRequested: true, isCompleted: true }] },
      { title: 'M2', deadline: '2026-08-20', payoutPercent: 50, status: 'InProgress', checkpoints: [{ description: 'c2', isRequested: false, isCompleted: false }] },
    ],
  });
  const { agreement, transactions } = settleAgreement(input);
  assert.equal(agreement.milestones[0].status, 'Completed');
  assert.equal(agreement.payoutRemaining, 500);
  assert.equal(agreement.status, 'Activated');
  assert.deepEqual(transactions, [{
    sender: '0xAGMT_1', receiver: '0xcarrier', amount: 500, txType: 'Payoff', timestamp: new Date('2026-08-10').getTime(),
  }]);
});

test('a Verified milestone before its deadline stays locked (no payout yet)', () => {
  resetMockEnvironment({ simDate: '2026-08-09' });
  const input = baseAgreement({
    milestones: [
      { title: 'M1', deadline: '2026-08-10', payoutPercent: 50, status: 'Verified', checkpoints: [{ description: 'c1', isRequested: true, isCompleted: true }] },
      { title: 'M2', deadline: '2026-08-20', payoutPercent: 50, status: 'InProgress', checkpoints: [{ description: 'c2', isRequested: false, isCompleted: false }] },
    ],
  });
  const { agreement, transactions } = settleAgreement(input);
  assert.equal(agreement.milestones[0].status, 'Verified');
  assert.equal(agreement.payoutRemaining, 1000);
  assert.deepEqual(transactions, []);
});

test('releasing the last milestone completes the whole agreement', () => {
  resetMockEnvironment({ simDate: '2026-08-20' });
  const input = baseAgreement({
    payoutRemaining: 500,
    milestones: [
      { title: 'M1', deadline: '2026-08-10', payoutPercent: 50, status: 'Completed', checkpoints: [{ description: 'c1', isRequested: true, isCompleted: true }] },
      { title: 'M2', deadline: '2026-08-20', payoutPercent: 50, status: 'Verified', checkpoints: [{ description: 'c2', isRequested: true, isCompleted: true }] },
    ],
  });
  const { agreement, transactions } = settleAgreement(input);
  assert.equal(agreement.status, 'Completed');
  assert.equal(agreement.milestones[1].status, 'Completed');
  assert.equal(agreement.payoutRemaining, 0);
  assert.equal(transactions.length, 1);
  assert.equal(transactions[0].txType, 'Payoff');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && node --test test/mock/settlement.test.js`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement settlement.js**

Create `frontend/src/mock/settlement.js`:

```js
import { getSimDate } from './simDate.js';

// Failure is checked before releasing any Verified-but-unpaid milestone in
// the same sweep: if a later milestone's deadline has also passed, the
// agreement terminates and whatever hasn't been released yet (including an
// earlier Verified milestone's earned-but-unpaid share) is refunded in one
// lump sum, rather than replaying events in strict chronological order.
export function settleAgreement(agreement) {
  if (agreement.status !== 'Activated') {
    return { agreement, transactions: [] };
  }

  const simDate = getSimDate();
  const transactions = [];
  const next = {
    ...agreement,
    milestones: agreement.milestones.map((m) => ({
      ...m,
      checkpoints: m.checkpoints.map((c) => ({ ...c })),
    })),
  };

  const inProgressIndex = next.milestones.findIndex((m) => m.status === 'InProgress');
  if (inProgressIndex !== -1 && simDate > next.milestones[inProgressIndex].deadline) {
    next.milestones[inProgressIndex].status = 'Failed';
    next.status = 'Terminated';
    const refundAmount = next.payoutRemaining;
    next.payoutRemaining = 0;
    transactions.push({
      sender: next.address,
      receiver: next.shipper,
      amount: refundAmount,
      txType: 'Refund',
      timestamp: new Date(simDate).getTime(),
    });
    return { agreement: next, transactions };
  }

  next.milestones.forEach((milestone, index) => {
    if (milestone.status === 'Verified' && simDate >= milestone.deadline) {
      const payoutShare = (next.totalPayoutValue * milestone.payoutPercent) / 100;
      milestone.status = 'Completed';
      next.payoutRemaining -= payoutShare;
      transactions.push({
        sender: next.address,
        receiver: next.carrier,
        amount: payoutShare,
        txType: 'Payoff',
        timestamp: new Date(simDate).getTime(),
      });
      if (index === next.milestones.length - 1) {
        next.status = 'Completed';
      }
    }
  });

  return { agreement: next, transactions };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && node --test test/mock/settlement.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/mock/settlement.js test/mock/settlement.test.js
git commit -m "Add settlement sweep: deadline failure + scheduled payout release"
```

---

## Task 4: Agreement lifecycle (`agreements.js`)

**Files:**
- Create: `frontend/src/mock/agreements.js`
- Test: `frontend/test/mock/agreements.test.js`

**Interfaces:**
- Consumes: `readDict`, `writeDict` (`storage.js`), `getSimDate` (`simDate.js`), `getCurrentAccount`, `getUser` (`users.js`), `settleAgreement` (`settlement.js`).
- Produces: `createAgreement({carrier, totalPayoutValue, duration, milestones}): Agreement` where `milestones` input items are `{title, deadline, payoutPercent, checkpoints: string[]}`; `listMyAgreements(): Agreement[]`; `getAgreementDetails(address): Agreement`; `terminateAgreement(address): Agreement`; `requestCheckpoint(address, milestoneIndex, checkpointIndex): Agreement`; `approveCheckpoint(address, milestoneIndex, checkpointIndex): Agreement`; `checkDeadlines(address): Agreement`; `listTransactions(address): Transaction[]`. All consumed by Task 5 (facade) and the UI tasks.

- [ ] **Step 1: Write the failing tests**

Create `frontend/test/mock/agreements.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resetMockEnvironment, setAccount, setSimDate } from './testHelpers.js';
import { register } from '../../src/mock/users.js';
import {
  createAgreement,
  listMyAgreements,
  getAgreementDetails,
  terminateAgreement,
  requestCheckpoint,
  approveCheckpoint,
  checkDeadlines,
  listTransactions,
} from '../../src/mock/agreements.js';

function registerShipperAndCarrier() {
  resetMockEnvironment({ account: '0xship', simDate: '2026-08-01' });
  register({ mail: 's@x.com', name: 'Shipper Co', role: 'Shipper' });
  setAccount('0xcarrier');
  register({ mail: 'c@x.com', name: 'Carrier Co', role: 'Carrier' });
  setAccount('0xship');
}

function createBasicAgreement(overrides = {}) {
  return createAgreement({
    carrier: '0xcarrier',
    totalPayoutValue: 1000,
    duration: 20,
    milestones: [
      { title: 'M1', deadline: '2026-08-10', payoutPercent: 50, checkpoints: ['Loaded'] },
      { title: 'M2', deadline: '2026-08-20', payoutPercent: 50, checkpoints: ['Delivered'] },
    ],
    ...overrides,
  });
}

test('createAgreement activates immediately, funds the full amount, and starts milestone 1', () => {
  registerShipperAndCarrier();
  const agreement = createBasicAgreement();
  assert.equal(agreement.status, 'Activated');
  assert.equal(agreement.payoutRemaining, 1000);
  assert.equal(agreement.milestones[0].status, 'InProgress');
  assert.equal(agreement.milestones[1].status, 'Pending');
  assert.deepEqual(listTransactions(agreement.address), [{
    sender: '0xship', receiver: agreement.address, amount: 1000, txType: 'AgreementCreation', timestamp: new Date('2026-08-01').getTime(),
  }]);
});

test('createAgreement appears in listMyAgreements for both shipper and carrier', () => {
  registerShipperAndCarrier();
  const agreement = createBasicAgreement();
  assert.equal(listMyAgreements().length, 1);
  setAccount('0xcarrier');
  assert.equal(listMyAgreements()[0].address, agreement.address);
});

test('createAgreement rejects milestone payouts that do not sum to 100', () => {
  registerShipperAndCarrier();
  assert.throws(
    () => createBasicAgreement({ milestones: [{ title: 'M1', deadline: '2026-08-10', payoutPercent: 40, checkpoints: ['x'] }] }),
    /LogisticsContract: payout percentages must sum to 100/
  );
});

test('createAgreement rejects a carrier that is not a registered Carrier', () => {
  registerShipperAndCarrier();
  assert.throws(() => createBasicAgreement({ carrier: '0xghost' }), /AgreementFactory: carrier is not a registered Carrier/);
});

test('createAgreement rejects a final deadline beyond 90 days from Sim Date', () => {
  registerShipperAndCarrier();
  assert.throws(
    () => createBasicAgreement({ milestones: [{ title: 'M1', deadline: '2026-12-01', payoutPercent: 100, checkpoints: ['x'] }] }),
    /LogisticsContract: duration exceeds 90 days/
  );
});

test('only the carrier can request a checkpoint', () => {
  registerShipperAndCarrier();
  const agreement = createBasicAgreement();
  assert.throws(() => requestCheckpoint(agreement.address, 0, 0), /LogisticsContract: caller is not the carrier/);
});

test('approving a checkpoint requires it to have been requested first', () => {
  registerShipperAndCarrier();
  const agreement = createBasicAgreement();
  assert.throws(() => approveCheckpoint(agreement.address, 0, 0), /LogisticsContract: checkpoint not requested/);
});

test('completing every checkpoint in a milestone verifies it and starts the next one', () => {
  registerShipperAndCarrier();
  const agreement = createBasicAgreement();
  setAccount('0xcarrier');
  requestCheckpoint(agreement.address, 0, 0);
  setAccount('0xship');
  const updated = approveCheckpoint(agreement.address, 0, 0);
  assert.equal(updated.milestones[0].status, 'Verified');
  assert.equal(updated.milestones[1].status, 'InProgress');
});

test('a Verified milestone pays out once Sim Date reaches its deadline, via getAgreementDetails', () => {
  registerShipperAndCarrier();
  const agreement = createBasicAgreement();
  setAccount('0xcarrier');
  requestCheckpoint(agreement.address, 0, 0);
  setAccount('0xship');
  approveCheckpoint(agreement.address, 0, 0);

  setSimDate('2026-08-10');
  const details = getAgreementDetails(agreement.address);
  assert.equal(details.milestones[0].status, 'Completed');
  assert.equal(details.payoutRemaining, 500);
  const txs = listTransactions(agreement.address);
  assert.equal(txs.filter((t) => t.txType === 'Payoff').length, 1);
});

test('checkDeadlines terminates and refunds when a milestone misses its deadline', () => {
  registerShipperAndCarrier();
  const agreement = createBasicAgreement();
  setSimDate('2026-08-11');
  const result = checkDeadlines(agreement.address);
  assert.equal(result.status, 'Terminated');
  assert.equal(result.milestones[0].status, 'Failed');
  const txs = listTransactions(agreement.address);
  assert.equal(txs.filter((t) => t.txType === 'Refund').length, 1);
});

test('only the shipper can terminate an active agreement', () => {
  registerShipperAndCarrier();
  const agreement = createBasicAgreement();
  setAccount('0xcarrier');
  assert.throws(() => terminateAgreement(agreement.address), /LogisticsContract: caller is not the shipper/);
});

test('terminateAgreement refunds the shipper and logs the refund', () => {
  registerShipperAndCarrier();
  const agreement = createBasicAgreement();
  const result = terminateAgreement(agreement.address);
  assert.equal(result.status, 'Terminated');
  assert.equal(result.payoutRemaining, 0);
  const txs = listTransactions(agreement.address);
  assert.deepEqual(txs[txs.length - 1], {
    sender: agreement.address, receiver: '0xship', amount: 1000, txType: 'Refund', timestamp: new Date('2026-08-01').getTime(),
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && node --test test/mock/agreements.test.js`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement agreements.js**

Create `frontend/src/mock/agreements.js`:

```js
import { readDict, writeDict } from './storage.js';
import { getCurrentAccount, getUser } from './users.js';
import { getSimDate } from './simDate.js';
import { settleAgreement } from './settlement.js';

function generateAddress() {
  return `0xAGMT_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

function loadAgreements() {
  return readDict('agreements');
}

function saveAgreements(agreements) {
  writeDict('agreements', agreements);
}

function appendTransactions(address, newTxs) {
  if (newTxs.length === 0) return;
  const txByAgreement = readDict('transactions');
  const existing = txByAgreement[address] || [];
  txByAgreement[address] = [...existing, ...newTxs];
  writeDict('transactions', txByAgreement);
}

function requireAccount() {
  const account = getCurrentAccount();
  if (!account) {
    throw new Error('LogisticsClient: no connected account');
  }
  return account;
}

function requireAgreement(agreements, address) {
  const agreement = agreements[address];
  if (!agreement) {
    throw new Error('LogisticsClient: agreement not found');
  }
  return agreement;
}

export function createAgreement({ carrier, totalPayoutValue, duration, milestones }) {
  const shipper = requireAccount();

  if (!milestones || milestones.length === 0) {
    throw new Error('LogisticsContract: at least one milestone required');
  }
  const percentTotal = milestones.reduce((sum, m) => sum + Number(m.payoutPercent || 0), 0);
  if (percentTotal !== 100) {
    throw new Error('LogisticsContract: payout percentages must sum to 100');
  }
  const carrierProfile = getUser(carrier);
  if (!carrierProfile || carrierProfile.role !== 'Carrier') {
    throw new Error('AgreementFactory: carrier is not a registered Carrier');
  }
  const simDate = getSimDate();
  const maxDeadline = new Date(simDate);
  maxDeadline.setDate(maxDeadline.getDate() + 90);
  const maxDeadlineStr = maxDeadline.toISOString().split('T')[0];
  const lastDeadline = milestones[milestones.length - 1].deadline;
  if (lastDeadline > maxDeadlineStr) {
    throw new Error('LogisticsContract: duration exceeds 90 days');
  }

  const address = generateAddress();
  const agreement = {
    address,
    shipper,
    carrier,
    totalPayoutValue: Number(totalPayoutValue),
    payoutRemaining: Number(totalPayoutValue),
    duration,
    status: 'Activated',
    createdAt: simDate,
    milestones: milestones.map((m, index) => ({
      title: m.title,
      deadline: m.deadline,
      payoutPercent: Number(m.payoutPercent),
      status: index === 0 ? 'InProgress' : 'Pending',
      checkpoints: m.checkpoints.map((description) => ({ description, isRequested: false, isCompleted: false })),
    })),
  };

  const agreements = loadAgreements();
  agreements[address] = agreement;
  saveAgreements(agreements);

  appendTransactions(address, [{
    sender: shipper,
    receiver: address,
    amount: agreement.totalPayoutValue,
    txType: 'AgreementCreation',
    timestamp: new Date(simDate).getTime(),
  }]);

  return agreement;
}

function settleAndPersist(agreement) {
  const { agreement: settled, transactions } = settleAgreement(agreement);
  if (transactions.length > 0) {
    const agreements = loadAgreements();
    agreements[settled.address] = settled;
    saveAgreements(agreements);
    appendTransactions(settled.address, transactions);
  }
  return settled;
}

export function listMyAgreements() {
  const account = requireAccount();
  const agreements = loadAgreements();
  return Object.values(agreements)
    .filter((a) => a.shipper === account || a.carrier === account)
    .map(settleAndPersist);
}

export function getAgreementDetails(address) {
  const agreements = loadAgreements();
  const agreement = requireAgreement(agreements, address);
  return settleAndPersist(agreement);
}

export function checkDeadlines(address) {
  return getAgreementDetails(address);
}

export function terminateAgreement(address) {
  const account = requireAccount();
  const agreements = loadAgreements();
  const agreement = requireAgreement(agreements, address);
  if (agreement.status !== 'Activated') {
    throw new Error('LogisticsContract: not activated');
  }
  if (account !== agreement.shipper) {
    throw new Error('LogisticsContract: caller is not the shipper');
  }
  const refundAmount = agreement.payoutRemaining;
  const updated = { ...agreement, status: 'Terminated', payoutRemaining: 0 };
  agreements[address] = updated;
  saveAgreements(agreements);
  appendTransactions(address, [{
    sender: address,
    receiver: agreement.shipper,
    amount: refundAmount,
    txType: 'Refund',
    timestamp: new Date(getSimDate()).getTime(),
  }]);
  return updated;
}

export function requestCheckpoint(address, milestoneIndex, checkpointIndex) {
  const account = requireAccount();
  const agreements = loadAgreements();
  const agreement = requireAgreement(agreements, address);
  if (account !== agreement.carrier) {
    throw new Error('LogisticsContract: caller is not the carrier');
  }
  const milestone = agreement.milestones[milestoneIndex];
  if (!milestone || milestone.status !== 'InProgress') {
    throw new Error('LogisticsContract: milestone not in progress');
  }
  const checkpoint = milestone.checkpoints[checkpointIndex];
  if (!checkpoint || checkpoint.isCompleted) {
    throw new Error('LogisticsContract: checkpoint already completed');
  }
  checkpoint.isRequested = true;
  agreements[address] = agreement;
  saveAgreements(agreements);
  return agreement;
}

export function approveCheckpoint(address, milestoneIndex, checkpointIndex) {
  const account = requireAccount();
  const agreements = loadAgreements();
  const agreement = requireAgreement(agreements, address);
  if (account !== agreement.shipper) {
    throw new Error('LogisticsContract: caller is not the shipper');
  }
  const milestone = agreement.milestones[milestoneIndex];
  if (!milestone || milestone.status !== 'InProgress') {
    throw new Error('LogisticsContract: milestone not in progress');
  }
  const checkpoint = milestone.checkpoints[checkpointIndex];
  if (!checkpoint || !checkpoint.isRequested) {
    throw new Error('LogisticsContract: checkpoint not requested');
  }
  if (checkpoint.isCompleted) {
    throw new Error('LogisticsContract: checkpoint already completed');
  }
  checkpoint.isCompleted = true;

  const allCompleted = milestone.checkpoints.every((c) => c.isCompleted);
  if (allCompleted) {
    milestone.status = 'Verified';
    const nextIndex = milestoneIndex + 1;
    if (nextIndex < agreement.milestones.length) {
      agreement.milestones[nextIndex].status = 'InProgress';
    }
  }

  agreements[address] = agreement;
  saveAgreements(agreements);
  return settleAndPersist(agreement);
}

export function listTransactions(address) {
  return readDict('transactions')[address] || [];
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && node --test test/mock/agreements.test.js`
Expected: PASS (12 tests)

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/mock/agreements.js test/mock/agreements.test.js
git commit -m "Add mock agreement lifecycle: create, checkpoints, terminate, deadlines"
```

---

## Task 5: Public facade (`logisticsClient.js`)

**Files:**
- Create: `frontend/src/mock/logisticsClient.js`
- Test: `frontend/test/mock/logisticsClient.test.js`

**Interfaces:**
- Consumes: everything produced by Tasks 2 and 4.
- Produces: the single import path every page uses from now on — `frontend/src/mock/logisticsClient.js` re-exporting `isRegistered, getUser, listRegisteredCarriers, register, login, createAgreement, listMyAgreements, getAgreementDetails, terminateAgreement, requestCheckpoint, approveCheckpoint, checkDeadlines, listTransactions`.

- [ ] **Step 1: Write the failing test**

Create `frontend/test/mock/logisticsClient.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resetMockEnvironment, setAccount } from './testHelpers.js';
import * as logisticsClient from '../../src/mock/logisticsClient.js';

test('logisticsClient re-exports the full registry and agreement surface', () => {
  resetMockEnvironment({ account: '0xship', simDate: '2026-08-01' });
  logisticsClient.register({ mail: 's@x.com', name: 'Shipper Co', role: 'Shipper' });
  assert.equal(logisticsClient.isRegistered('0xship'), true);
  assert.equal(logisticsClient.login().name, 'Shipper Co');

  setAccount('0xcarrier');
  logisticsClient.register({ mail: 'c@x.com', name: 'Carrier Co', role: 'Carrier' });
  setAccount('0xship');

  const agreement = logisticsClient.createAgreement({
    carrier: '0xcarrier',
    totalPayoutValue: 100,
    duration: 10,
    milestones: [{ title: 'M1', deadline: '2026-08-10', payoutPercent: 100, checkpoints: ['done'] }],
  });
  assert.equal(logisticsClient.listMyAgreements().length, 1);
  assert.equal(logisticsClient.getAgreementDetails(agreement.address).status, 'Activated');
  assert.deepEqual(
    logisticsClient.listTransactions(agreement.address).map((t) => t.txType),
    ['AgreementCreation']
  );
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && node --test test/mock/logisticsClient.test.js`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement logisticsClient.js**

Create `frontend/src/mock/logisticsClient.js`:

```js
export { isRegistered, getUser, listRegisteredCarriers, register, login } from './users.js';
export {
  createAgreement,
  listMyAgreements,
  getAgreementDetails,
  terminateAgreement,
  requestCheckpoint,
  approveCheckpoint,
  checkDeadlines,
  listTransactions,
} from './agreements.js';
```

- [ ] **Step 4: Run the full unit-test suite to verify everything passes**

Run: `cd frontend && node --test test/mock/`
Expected: PASS (25 tests total across all Task 1-5 files)

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/mock/logisticsClient.js test/mock/logisticsClient.test.js
git commit -m "Add logisticsClient facade re-exporting the full mock contract surface"
```

---

## Task 6: Wire Register.jsx and App.jsx guards to logisticsClient

**Files:**
- Modify: `frontend/src/pages/Register.jsx`
- Modify: `frontend/src/App.jsx`
- Create: `frontend/scripts/smoke/register.mjs`

**Interfaces:**
- Consumes: `register`, `isRegistered` from `frontend/src/mock/logisticsClient.js` (Task 5).

- [ ] **Step 1: Rewire Register.jsx to call the mock module**

Edit `frontend/src/pages/Register.jsx`:

```js
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FixedFooter from '../components/FixedFooter';
import { register } from '../mock/logisticsClient.js';
```

Replace the `handleSubmit` body:

```js
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name || !mail || !role) {
      setError('Please fill in your name, email, and role.');
      return;
    }

    try {
      register({ mail, name, role });
      navigate('/main');
    } catch (err) {
      setError(err.message);
    }
  };
```

(The `localStorage.setItem(\`profile:${account}\`, ...)` line and the standalone `profile` object are removed — `register()` now does that internally under the `mock:users` key.)

- [ ] **Step 2: Rewire App.jsx's guards to use the mock module's isRegistered**

Edit `frontend/src/App.jsx`:

```js
import { isRegistered } from './mock/logisticsClient.js';
```

Remove the local `isRegistered` function definition:

```js
function isRegistered(account) {
  return account ? !!localStorage.getItem(`profile:${account}`) : false;
}
```

`ProtectedRoute`, `RegisterRoute`, and `PublicRoute` keep calling `isRegistered(account)` exactly as before — only the import changes, not the call sites.

- [ ] **Step 3: Write the smoke script**

Create `frontend/scripts/smoke/register.mjs`:

```js
import { chromium } from 'playwright';

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage();
const errors = [];
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('pageerror', (err) => errors.push(String(err)));

await page.goto('http://localhost:5173/');
await page.evaluate(() => localStorage.setItem('account', '0xSmokeShipper'));

await page.goto('http://localhost:5173/main');
await page.waitForSelector('text=Complete your registration');

await page.fill('input[type="text"]', 'Smoke Shipper');
await page.fill('input[type="email"]', 'shipper@smoke.test');
await page.click('button:has-text("Shipper")');
await page.click('button:has-text("Register")');
await page.waitForSelector('text=Hello, Smoke Shipper !');

const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('mock:users'))['0xSmokeShipper']);
if (stored.role !== 'Shipper') throw new Error(`expected role Shipper, got ${stored.role}`);

await page.goto('http://localhost:5173/register');
await page.waitForSelector('text=Hello, Smoke Shipper !');

if (errors.length) throw new Error(`console errors: ${JSON.stringify(errors)}`);
console.log('register smoke: PASS');
await browser.close();
```

- [ ] **Step 4: Run the smoke script against the dev server**

Run:
```bash
cd frontend
lsof -ti:5173 -sTCP:LISTEN | xargs -r kill 2>/dev/null
nohup npx vite --port 5173 > /tmp/vite-dev.log 2>&1 & disown
for i in $(seq 1 30); do curl -sf http://localhost:5173 >/dev/null && break; sleep 1; done
node scripts/smoke/register.mjs
lsof -ti:5173 -sTCP:LISTEN | xargs -r kill 2>/dev/null
```
Expected: `register smoke: PASS` printed, no thrown error.

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/pages/Register.jsx src/App.jsx scripts/smoke/register.mjs
git commit -m "Wire Register.jsx and App.jsx route guards to logisticsClient"
```

---

## Task 7: Wire MainPage.jsx and CardList.jsx to logisticsClient

**Files:**
- Modify: `frontend/src/pages/MainPage.jsx`
- Modify: `frontend/src/components/CardList.jsx`
- Create: `frontend/scripts/smoke/list.mjs`

**Interfaces:**
- Consumes: `login`, `listMyAgreements`, `getUser` from `logisticsClient.js` (Task 5).
- `CardList` now requires an `account` prop (the viewer's wallet address) instead of an `agreements` prop with a hardcoded default.

- [ ] **Step 1: Rewrite MainPage.jsx**

Replace the full contents of `frontend/src/pages/MainPage.jsx`:

```jsx
import Header from '../components/Header';
import CardList from '../components/CardList';
import FixedFooter from '../components/FixedFooter';
import FloatAction from '../components/FloatAction';
import { login } from '../mock/logisticsClient.js';

function MainPage() {
    const profile = login();

    return (
        <div className="container pt-5 mt-4 pb-5 text-start">
            <Header />
            <div className="mt-4 mb-4">
                <h1 className="h2 mb-4">Hello, {profile.name} !</h1>
                <CardList account={profile.walletAddress} />
            </div>
            <FloatAction />
            <FixedFooter />
        </div>
    );
}

export default MainPage;
```

- [ ] **Step 2: Rewrite CardList.jsx**

Replace the full contents of `frontend/src/components/CardList.jsx`:

```jsx
import { useNavigate } from 'react-router-dom';
import { Card, Row, Col, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { getUser, listMyAgreements } from '../mock/logisticsClient.js';

function deriveCardViewModel(agreement, account) {
  const isCarrier = agreement.carrier === account;
  const isShipper = agreement.shipper === account;
  const inProgress = agreement.milestones.find((m) => m.status === 'InProgress');

  let requiresAttention = false;
  let tooltipText = 'No Action Needed: Agreement operating normally';

  if (agreement.status === 'Terminated') {
    tooltipText = 'Agreement Terminated';
  } else if (agreement.status === 'Completed') {
    tooltipText = 'Agreement Completed';
  } else if (inProgress) {
    if (isCarrier && inProgress.checkpoints.some((c) => !c.isRequested && !c.isCompleted)) {
      requiresAttention = true;
      tooltipText = 'Action Needed: Request a checkpoint';
    } else if (isShipper && inProgress.checkpoints.some((c) => c.isRequested && !c.isCompleted)) {
      requiresAttention = true;
      tooltipText = 'Action Needed: Approve a requested checkpoint';
    }
  }

  const carrierProfile = getUser(agreement.carrier);
  const shipperProfile = getUser(agreement.shipper);

  return {
    id: agreement.address,
    title: `Escrow Agreement #${agreement.address.slice(-6)}`,
    amount: `RM ${agreement.totalPayoutValue.toFixed(2)}`,
    carrier: carrierProfile?.name || agreement.carrier,
    shipper: shipperProfile?.name || agreement.shipper,
    requiresAttention,
    tooltipText,
  };
}

function CardList({ account, onCardClick }) {
  const navigate = useNavigate();
  const agreements = listMyAgreements().map((a) => deriveCardViewModel(a, account));

  const handleCardClick = (item) => {
    if (onCardClick) {
      onCardClick(item);
    } else {
      navigate(`/agreement/${item.id}`);
    }
  };

  if (agreements.length === 0) {
    return <p className="text-muted">No agreements yet. Create one to get started.</p>;
  }

  return (
    <Row className="g-4">
      {agreements.map((item) => (
        <Col key={item.id} xs={12} md={6} lg={4}>
          <Card
            className="position-relative shadow-sm h-100 border-secondary-subtle"
            style={{ cursor: 'pointer', transition: 'transform 0.15s ease-in-out, box-shadow 0.15s ease-in-out' }}
            onClick={() => handleCardClick(item)}
          >
            <OverlayTrigger
              placement="top"
              overlay={
                <Tooltip id={`tooltip-dot-${item.id}`}>
                  {item.tooltipText}
                </Tooltip>
              }
            >
              <span
                className={`position-absolute rounded-circle border border-2 border-white ${
                  item.requiresAttention ? 'bg-danger' : 'bg-success'
                }`}
                style={{
                  top: '12px',
                  right: '12px',
                  width: '14px',
                  height: '14px',
                  zIndex: 3,
                  boxShadow: item.requiresAttention ? '0 0 6px rgba(245, 101, 101, 0.9)' : 'none'
                }}
                onClick={(e) => e.stopPropagation()}
              />
            </OverlayTrigger>

            <Card.Body className="d-flex flex-column justify-content-between p-4">
              <div>
                <Card.Title className="h5 fw-bold mb-2 pe-3 text-truncate">
                  {item.title}
                </Card.Title>

                <div className="mb-3">
                  <span className="text-muted d-block small">Amount</span>
                  <span className="fs-5 fw-bold text-dark">{item.amount}</span>
                </div>

                <div className="row g-2 pt-1">
                  <div className="col-6">
                    <span className="text-muted d-block small">Carrier</span>
                    <span className="small fw-semibold text-dark text-truncate d-block">
                      {item.carrier}
                    </span>
                  </div>
                  <div className="col-6 text-end">
                    <span className="text-muted d-block small">Shipper</span>
                    <span className="small fw-semibold text-dark text-truncate d-block">
                      {item.shipper}
                    </span>
                  </div>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      ))}
    </Row>
  );
}

export default CardList;
```

- [ ] **Step 3: Write the smoke script**

Create `frontend/scripts/smoke/list.mjs`:

```js
import { chromium } from 'playwright';

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage();
const errors = [];
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('pageerror', (err) => errors.push(String(err)));

await page.goto('http://localhost:5173/');
await page.evaluate(() => {
  localStorage.setItem('account', '0xShip');
  localStorage.setItem('simDate', '2026-08-05');
  localStorage.setItem('mock:users', JSON.stringify({
    '0xShip': { walletAddress: '0xShip', name: 'Ship Co', mail: 's@x.com', role: 'Shipper' },
    '0xCarry': { walletAddress: '0xCarry', name: 'Carry Co', mail: 'c@x.com', role: 'Carrier' },
  }));
  localStorage.setItem('mock:agreements', JSON.stringify({
    '0xAGMT_needsaction': {
      address: '0xAGMT_needsaction', shipper: '0xShip', carrier: '0xCarry',
      totalPayoutValue: 1000, payoutRemaining: 1000, duration: 20, status: 'Activated', createdAt: '2026-08-01',
      milestones: [{ title: 'M1', deadline: '2026-08-20', payoutPercent: 100, status: 'InProgress',
        checkpoints: [{ description: 'Requested one', isRequested: true, isCompleted: false }] }],
    },
    '0xAGMT_quiet': {
      address: '0xAGMT_quiet', shipper: '0xShip', carrier: '0xCarry',
      totalPayoutValue: 500, payoutRemaining: 500, duration: 10, status: 'Activated', createdAt: '2026-08-01',
      milestones: [{ title: 'M1', deadline: '2026-08-20', payoutPercent: 100, status: 'InProgress',
        checkpoints: [{ description: 'Not requested', isRequested: false, isCompleted: false }] }],
    },
  }));
  localStorage.setItem('mock:transactions', JSON.stringify({}));
});

await page.goto('http://localhost:5173/main');
await page.waitForSelector('text=Hello, Ship Co !');

const cardCount = await page.locator('.card').count();
if (cardCount !== 2) throw new Error(`expected 2 cards, got ${cardCount}`);

const dangerDots = await page.locator('.bg-danger').count();
if (dangerDots < 1) throw new Error('expected at least one attention dot');

await page.waitForSelector('text=Carry Co');

if (errors.length) throw new Error(`console errors: ${JSON.stringify(errors)}`);
console.log('list smoke: PASS');
await browser.close();
```

- [ ] **Step 4: Run the smoke script**

Run:
```bash
cd frontend
lsof -ti:5173 -sTCP:LISTEN | xargs -r kill 2>/dev/null
nohup npx vite --port 5173 > /tmp/vite-dev.log 2>&1 & disown
for i in $(seq 1 30); do curl -sf http://localhost:5173 >/dev/null && break; sleep 1; done
node scripts/smoke/list.mjs
lsof -ti:5173 -sTCP:LISTEN | xargs -r kill 2>/dev/null
```
Expected: `list smoke: PASS`

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/pages/MainPage.jsx src/components/CardList.jsx scripts/smoke/list.mjs
git commit -m "Wire MainPage and CardList to real mock agreements"
```

---

## Task 8: Wire CreateAgreement.jsx to logisticsClient

**Files:**
- Modify: `frontend/src/pages/CreateAgreement.jsx`
- Create: `frontend/scripts/smoke/create.mjs`

**Interfaces:**
- Consumes: `login`, `listRegisteredCarriers`, `createAgreement` from `logisticsClient.js` (Task 5), and `getSimDate` from `mock/simDate.js` (Task 1) to replace the file's own duplicated helper.

- [ ] **Step 1: Update imports and remove the duplicated getSimDate helper**

Edit `frontend/src/pages/CreateAgreement.jsx`, replace:

```js
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Accordion, Button, Form } from 'react-bootstrap';
import Header from '../components/Header';
import FixedFooter from '../components/FixedFooter';
```

with:

```js
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Accordion, Button, Form } from 'react-bootstrap';
import Header from '../components/Header';
import FixedFooter from '../components/FixedFooter';
import { login, listRegisteredCarriers, createAgreement } from '../mock/logisticsClient.js';
import { getSimDate } from '../mock/simDate.js';
```

- [ ] **Step 2: Replace the shipper/carrier state and the local getSimDate with real data**

Replace:

```js
    const [shipper, setShipper] = useState('');
    const [carrier, setCarrier] = useState('');
    const [totalEscrowAmount, setTotalEscrowAmount] = useState(1000);
```

with:

```js
    const shipper = login();
    const carriers = listRegisteredCarriers().filter((c) => c.walletAddress !== shipper.walletAddress);
    const [carrierAddress, setCarrierAddress] = useState('');
    const [totalEscrowAmount, setTotalEscrowAmount] = useState(1000);
```

Replace:

```js
    // Date calculation
    const getSimDate = () => {
        const saved = localStorage.getItem('simDate');
        return saved ? new Date(saved) : new Date();
    };

    const simDateObj = getSimDate();
```

with:

```js
    const simDateObj = new Date(getSimDate());
```

- [ ] **Step 3: Replace the Shipper Name / Carrier Name fields**

Replace:

```jsx
                        <div className="col-md-6">
                            <Form.Group>
                                <Form.Label className="fw-semibold">Shipper Name</Form.Label>
                                <Form.Control
                                    type="text"
                                    placeholder="e.g. Maersk Global"
                                    value={shipper}
                                    onChange={(e) => setShipper(e.target.value)}
                                    required
                                />
                            </Form.Group>
                        </div>
                        <div className="col-md-6">
                            <Form.Group>
                                <Form.Label className="fw-semibold">Carrier Name (Account)</Form.Label>
                                <Form.Control
                                    type="text"
                                    placeholder="e.g. DHL Express Cargo"
                                    value={carrier}
                                    onChange={(e) => setCarrier(e.target.value)}
                                    required
                                />
                            </Form.Group>
                        </div>
```

with:

```jsx
                        <div className="col-md-6">
                            <Form.Group>
                                <Form.Label className="fw-semibold">Shipper</Form.Label>
                                <Form.Control type="text" value={`${shipper.name} (${shipper.walletAddress})`} disabled />
                            </Form.Group>
                        </div>
                        <div className="col-md-6">
                            <Form.Group>
                                <Form.Label className="fw-semibold">Carrier</Form.Label>
                                {carriers.length === 0 ? (
                                    <div className="alert alert-warning small p-2 mb-0">
                                        No registered carriers yet. Ask a carrier to register before creating an agreement.
                                    </div>
                                ) : (
                                    <Form.Select
                                        value={carrierAddress}
                                        onChange={(e) => setCarrierAddress(e.target.value)}
                                        required
                                    >
                                        <option value="" disabled>Select a carrier</option>
                                        {carriers.map((c) => (
                                            <option key={c.walletAddress} value={c.walletAddress}>
                                                {c.name} ({c.walletAddress})
                                            </option>
                                        ))}
                                    </Form.Select>
                                )}
                            </Form.Group>
                        </div>
```

- [ ] **Step 4: Replace handleSubmit**

Replace:

```js
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!shipper || !carrier) {
            alert('Please enter Shipper and Carrier names.');
            return;
        }
        if (totalPercentage !== 100) {
            alert(`Milestone payout percentages must sum to 100% (currently ${totalPercentage}%).`);
            return;
        }
        if (lastDeadlineInvalid) {
            alert('The last milestone deadline cannot exceed 90 days from the current date.');
            return;
        }
        alert('Logistics Escrow Agreement created successfully!');
        navigate('/main');
    };
```

with:

```js
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!carrierAddress) {
            alert('Please select a carrier.');
            return;
        }
        if (totalPercentage !== 100) {
            alert(`Milestone payout percentages must sum to 100% (currently ${totalPercentage}%).`);
            return;
        }
        if (lastDeadlineInvalid) {
            alert('The last milestone deadline cannot exceed 90 days from the current date.');
            return;
        }

        try {
            const agreement = createAgreement({
                carrier: carrierAddress,
                totalPayoutValue: totalPayout,
                duration: Math.round((new Date(lastMilestone.deadline) - simDateObj) / (1000 * 60 * 60 * 24)),
                milestones: milestones.map((m) => ({
                    title: m.name,
                    deadline: m.deadline,
                    payoutPercent: Number(m.payoutPercentage) || 0,
                    checkpoints: m.checkpoints.map((c) => c.description),
                })),
            });
            navigate(`/agreement/${agreement.address}`);
        } catch (err) {
            alert(err.message);
        }
    };
```

- [ ] **Step 5: Write the smoke script**

Create `frontend/scripts/smoke/create.mjs`:

```js
import { chromium } from 'playwright';

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage();
const errors = [];
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('pageerror', (err) => errors.push(String(err)));

await page.goto('http://localhost:5173/');
await page.evaluate(() => {
  localStorage.setItem('account', '0xShip');
  localStorage.setItem('simDate', '2026-08-05');
  localStorage.setItem('mock:users', JSON.stringify({
    '0xShip': { walletAddress: '0xShip', name: 'Ship Co', mail: 's@x.com', role: 'Shipper' },
    '0xCarry': { walletAddress: '0xCarry', name: 'Carry Co', mail: 'c@x.com', role: 'Carrier' },
  }));
});

await page.goto('http://localhost:5173/create');
await page.waitForSelector('text=Create Escrow Agreement');

await page.selectOption('select', { label: 'Carry Co (0xCarry)' });
await page.fill('input[type="number"]', '1000');

const deadlineInputs = page.locator('input[type="date"]');
await deadlineInputs.nth(0).fill('2026-08-15');
await page.click('text=Milestone #2:');
await deadlineInputs.nth(1).fill('2026-08-25');

await page.click('button:has-text("Create Agreement")');
await page.waitForURL(/\/agreement\/0xAGMT_/);

await page.waitForSelector('text=Carry Co');
await page.waitForSelector('text=RM 1000.00');

if (errors.length) throw new Error(`console errors: ${JSON.stringify(errors)}`);
console.log('create smoke: PASS');
await browser.close();
```

- [ ] **Step 6: Run the smoke script**

Run:
```bash
cd frontend
lsof -ti:5173 -sTCP:LISTEN | xargs -r kill 2>/dev/null
nohup npx vite --port 5173 > /tmp/vite-dev.log 2>&1 & disown
for i in $(seq 1 30); do curl -sf http://localhost:5173 >/dev/null && break; sleep 1; done
node scripts/smoke/create.mjs
lsof -ti:5173 -sTCP:LISTEN | xargs -r kill 2>/dev/null
```
Expected: `create smoke: PASS`. (This also requires Task 9's route/page to exist to land on `/agreement/<address>` without a blank page — run this smoke check again after Task 9 if Task 9 hasn't landed yet; a plain URL-pattern match on `waitForURL` alone will still pass even with a not-yet-rewired detail page.)

- [ ] **Step 7: Commit**

```bash
cd frontend && git add src/pages/CreateAgreement.jsx scripts/smoke/create.mjs
git commit -m "Wire CreateAgreement.jsx to logisticsClient: real carrier picker and submission"
```

---

## Task 9: Wire AgreementDetail.jsx to logisticsClient with role-gated actions

**Files:**
- Modify: `frontend/src/pages/AgreementDetail.jsx`
- Create: `frontend/scripts/smoke/detail.mjs`

**Interfaces:**
- Consumes: `getAgreementDetails`, `listTransactions`, `requestCheckpoint`, `approveCheckpoint`, `terminateAgreement`, `checkDeadlines`, `login`, `getUser` from `logisticsClient.js` (Task 5).
- Route param stays `:id` in `App.jsx` (unchanged) — this page just reads it as the agreement's address.
- Adds `<FloatAction />` to this page (previously only on `MainPage`) so Sim Date can be advanced while looking at the agreement whose deadlines you're testing.

- [ ] **Step 1: Rewrite AgreementDetail.jsx**

Replace the full contents of `frontend/src/pages/AgreementDetail.jsx`:

```jsx
import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Badge, Button } from 'react-bootstrap';
import Header from '../components/Header';
import FixedFooter from '../components/FixedFooter';
import FloatAction from '../components/FloatAction';
import {
  getAgreementDetails,
  listTransactions,
  requestCheckpoint,
  approveCheckpoint,
  terminateAgreement,
  checkDeadlines,
  login,
  getUser,
} from '../mock/logisticsClient.js';

const MILESTONE_BADGE_VARIANT = {
  Pending: 'secondary',
  InProgress: 'primary',
  Verified: 'warning',
  Completed: 'success',
  Failed: 'danger',
};

function AgreementDetail() {
  const { id: address } = useParams();
  const navigate = useNavigate();
  const [, forceRefresh] = useState(0);
  const refresh = () => forceRefresh((n) => n + 1);

  const account = login().walletAddress;

  let agreement;
  try {
    agreement = getAgreementDetails(address);
  } catch {
    agreement = null;
  }

  if (!agreement) {
    return (
      <div className="container pt-5 mt-4 pb-5 text-start">
        <Header />
        <div className="mt-4 mb-4">
          <h1 className="h2 mb-3">Agreement not found</h1>
          <p className="text-muted">No agreement exists with address "{address}".</p>
          <Link to="/main" className="btn btn-primary">Back to Agreements</Link>
        </div>
        <FixedFooter />
      </div>
    );
  }

  const shipperProfile = getUser(agreement.shipper);
  const carrierProfile = getUser(agreement.carrier);
  const isShipper = account === agreement.shipper;
  const isCarrier = account === agreement.carrier;
  const transactions = listTransactions(address);
  const releasedSoFar = agreement.totalPayoutValue - agreement.payoutRemaining;

  const handleAction = (fn) => {
    try {
      fn();
      refresh();
    } catch (err) {
      alert(err.message);
    }
  };

  const statusVariant = { Activated: 'success', Completed: 'success', Terminated: 'danger' }[agreement.status] || 'secondary';

  return (
    <div className="container pt-5 mt-4 pb-5 text-start" style={{ maxWidth: '840px' }}>
      <Header />

      <Button variant="link" className="ps-0 mb-2 text-decoration-none" onClick={() => navigate('/main')}>
        &larr; Back to Agreements
      </Button>

      <div className="d-flex justify-content-between align-items-start mb-4">
        <h1 className="h2 fw-bold text-dark mb-0">Escrow Agreement #{address.slice(-6)}</h1>
        <Badge bg={statusVariant} className="mt-1">{agreement.status}</Badge>
      </div>

      {agreement.status === 'Activated' && (
        <Button variant="outline-secondary" size="sm" className="mb-4" onClick={() => handleAction(() => checkDeadlines(address))}>
          Check Deadlines
        </Button>
      )}

      <section className="mb-5">
        <h2 className="h4 fw-bold text-dark border-bottom pb-2 mb-3">Agreement Details</h2>
        <div className="row g-3">
          <div className="col-md-6">
            <span className="text-muted d-block small">Shipper</span>
            <span className="fw-semibold text-dark">{shipperProfile?.name || agreement.shipper}</span>
          </div>
          <div className="col-md-6">
            <span className="text-muted d-block small">Carrier</span>
            <span className="fw-semibold text-dark">{carrierProfile?.name || agreement.carrier}</span>
          </div>
          <div className="col-md-6">
            <span className="text-muted d-block small">Total Escrow Amount</span>
            <span className="fw-semibold text-dark">RM {agreement.totalPayoutValue.toFixed(2)}</span>
          </div>
        </div>
      </section>

      <section className="mb-5">
        <h2 className="h4 fw-bold text-dark border-bottom pb-2 mb-3">Milestones</h2>
        {agreement.milestones.map((m, mIndex) => {
          const milestonePayout = ((agreement.totalPayoutValue * m.payoutPercent) / 100).toFixed(2);
          return (
            <div key={mIndex} className="card mb-3 shadow-sm">
              <div className="card-body p-4">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="fw-bold">Milestone #{mIndex + 1}: {m.title}</span>
                  <Badge bg={MILESTONE_BADGE_VARIANT[m.status]}>{m.status}</Badge>
                </div>
                <div className="d-flex gap-4 mb-3 small text-muted">
                  <span>Deadline: {m.deadline}</span>
                  <span>Payout: {m.payoutPercent}% (RM {milestonePayout})</span>
                </div>

                <div className="bg-light p-3 rounded border">
                  <span className="fw-bold small text-dark d-block mb-2">Checkpoints</span>
                  {m.checkpoints.map((cp, cpIndex) => (
                    <div key={cpIndex} className="d-flex align-items-center justify-content-between gap-2 mb-2">
                      <div className="d-flex align-items-center gap-2">
                        <span className={`badge ${cp.isCompleted ? 'bg-success' : cp.isRequested ? 'bg-warning' : 'bg-secondary'}`}>
                          {cp.isCompleted ? '✓' : cpIndex + 1}
                        </span>
                        <span className={cp.isCompleted ? 'text-dark' : 'text-muted'}>{cp.description}</span>
                      </div>
                      {m.status === 'InProgress' && isCarrier && !cp.isRequested && !cp.isCompleted && (
                        <Button size="sm" variant="dark" onClick={() => handleAction(() => requestCheckpoint(address, mIndex, cpIndex))}>
                          Request
                        </Button>
                      )}
                      {m.status === 'InProgress' && isShipper && cp.isRequested && !cp.isCompleted && (
                        <Button size="sm" variant="warning" onClick={() => handleAction(() => approveCheckpoint(address, mIndex, cpIndex))}>
                          Approve
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <section className="mb-4">
        <h2 className="h4 fw-bold text-dark border-bottom pb-2 mb-3">Payment Summary</h2>
        <div className="card p-4">
          <div className="table-responsive mb-3">
            <table className="table table-borderless align-middle mb-0">
              <tbody>
                <tr>
                  <td className="ps-0 text-muted">Total Escrow</td>
                  <td className="pe-0 text-end fw-semibold text-dark">RM {agreement.totalPayoutValue.toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="ps-0 text-muted">Released to Carrier</td>
                  <td className="pe-0 text-end fw-semibold text-dark">RM {releasedSoFar.toFixed(2)}</td>
                </tr>
                <tr className="border-top">
                  <td className="ps-0 fw-bold fs-5 text-dark pt-3">Locked in Escrow</td>
                  <td className="pe-0 text-end fw-bold fs-4 text-primary pt-3">RM {agreement.payoutRemaining.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {transactions.length > 0 && (
            <div className="table-responsive">
              <span className="fw-bold small text-dark d-block mb-2">Transactions</span>
              <table className="table table-sm">
                <thead>
                  <tr><th>Type</th><th>From</th><th>To</th><th className="text-end">Amount</th></tr>
                </thead>
                <tbody>
                  {transactions.map((t, i) => (
                    <tr key={i}>
                      <td>{t.txType}</td>
                      <td className="text-truncate" style={{ maxWidth: '140px' }}>{t.sender}</td>
                      <td className="text-truncate" style={{ maxWidth: '140px' }}>{t.receiver}</td>
                      <td className="text-end">RM {t.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {agreement.status === 'Activated' && isShipper && (
            <Button
              variant="outline-danger"
              size="sm"
              className="mt-2 align-self-start"
              onClick={() => {
                if (window.confirm('Terminate this agreement and refund the remaining escrow to you?')) {
                  handleAction(() => terminateAgreement(address));
                }
              }}
            >
              Terminate Agreement
            </Button>
          )}
        </div>
      </section>

      <FloatAction />
      <FixedFooter />
    </div>
  );
}

export default AgreementDetail;
```

- [ ] **Step 2: Write the smoke script**

Create `frontend/scripts/smoke/detail.mjs`:

```js
import { chromium } from 'playwright';

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage();
const errors = [];
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('pageerror', (err) => errors.push(String(err)));

const AGREEMENT = '0xAGMT_detailtest';

await page.goto('http://localhost:5173/');
await page.evaluate((address) => {
  localStorage.setItem('simDate', '2026-08-05');
  localStorage.setItem('mock:users', JSON.stringify({
    '0xShip': { walletAddress: '0xShip', name: 'Ship Co', mail: 's@x.com', role: 'Shipper' },
    '0xCarry': { walletAddress: '0xCarry', name: 'Carry Co', mail: 'c@x.com', role: 'Carrier' },
  }));
  localStorage.setItem('mock:agreements', JSON.stringify({
    [address]: {
      address, shipper: '0xShip', carrier: '0xCarry',
      totalPayoutValue: 1000, payoutRemaining: 1000, duration: 20, status: 'Activated', createdAt: '2026-08-01',
      milestones: [{ title: 'M1', deadline: '2026-08-20', payoutPercent: 100, status: 'InProgress',
        checkpoints: [{ description: 'Load cargo', isRequested: false, isCompleted: false }] }],
    },
  }));
  localStorage.setItem('mock:transactions', JSON.stringify({}));
}, AGREEMENT);

await page.evaluate(() => localStorage.setItem('account', '0xCarry'));
await page.goto(`http://localhost:5173/agreement/${AGREEMENT}`);
await page.click('button:has-text("Request")');

const afterRequest = await page.evaluate(
  (addr) => JSON.parse(localStorage.getItem('mock:agreements'))[addr].milestones[0].checkpoints[0].isRequested,
  AGREEMENT
);
if (!afterRequest) throw new Error('expected checkpoint isRequested=true after Request click');

await page.evaluate(() => localStorage.setItem('account', '0xShip'));
await page.reload();
await page.click('button:has-text("Approve")');
await page.waitForSelector('text=Verified');

const finalStatus = await page.evaluate(
  (addr) => JSON.parse(localStorage.getItem('mock:agreements'))[addr].milestones[0].status,
  AGREEMENT
);
if (finalStatus !== 'Verified') throw new Error(`expected milestone Verified, got ${finalStatus}`);

if (errors.length) throw new Error(`console errors: ${JSON.stringify(errors)}`);
console.log('detail smoke: PASS');
await browser.close();
```

- [ ] **Step 3: Run the smoke script**

Run:
```bash
cd frontend
lsof -ti:5173 -sTCP:LISTEN | xargs -r kill 2>/dev/null
nohup npx vite --port 5173 > /tmp/vite-dev.log 2>&1 & disown
for i in $(seq 1 30); do curl -sf http://localhost:5173 >/dev/null && break; sleep 1; done
node scripts/smoke/detail.mjs
lsof -ti:5173 -sTCP:LISTEN | xargs -r kill 2>/dev/null
```
Expected: `detail smoke: PASS`

- [ ] **Step 4: Commit**

```bash
cd frontend && git add src/pages/AgreementDetail.jsx scripts/smoke/detail.mjs
git commit -m "Wire AgreementDetail.jsx to logisticsClient with role-gated checkpoint/terminate actions"
```

---

## Task 10: Transactions page

**Files:**
- Create: `frontend/src/pages/Transactions.jsx`
- Modify: `frontend/src/App.jsx`
- Create: `frontend/scripts/smoke/transactions.mjs`

**Interfaces:**
- Consumes: `listMyAgreements`, `listTransactions` from `logisticsClient.js` (Task 5).

- [ ] **Step 1: Create the Transactions page**

Create `frontend/src/pages/Transactions.jsx`:

```jsx
import { Link } from 'react-router-dom';
import { Table } from 'react-bootstrap';
import Header from '../components/Header';
import FixedFooter from '../components/FixedFooter';
import { listMyAgreements, listTransactions } from '../mock/logisticsClient.js';

function Transactions() {
  const agreements = listMyAgreements();
  const rows = agreements
    .flatMap((agreement) =>
      listTransactions(agreement.address).map((t) => ({ ...t, agreementAddress: agreement.address }))
    )
    .sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="container pt-5 mt-4 pb-5 text-start">
      <Header />
      <h1 className="h2 fw-bold text-dark mb-4">Transactions</h1>

      {rows.length === 0 ? (
        <p className="text-muted">No transactions yet.</p>
      ) : (
        <div className="table-responsive">
          <Table className="align-middle">
            <thead>
              <tr>
                <th>Date</th>
                <th>Agreement</th>
                <th>Type</th>
                <th>From</th>
                <th>To</th>
                <th className="text-end">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t, i) => (
                <tr key={i}>
                  <td>{new Date(t.timestamp).toISOString().split('T')[0]}</td>
                  <td>
                    <Link to={`/agreement/${t.agreementAddress}`}>#{t.agreementAddress.slice(-6)}</Link>
                  </td>
                  <td>{t.txType}</td>
                  <td className="text-truncate d-inline-block" style={{ maxWidth: '160px' }}>{t.sender}</td>
                  <td className="text-truncate d-inline-block" style={{ maxWidth: '160px' }}>{t.receiver}</td>
                  <td className="text-end">RM {t.amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      <FixedFooter />
    </div>
  );
}

export default Transactions;
```

- [ ] **Step 2: Wire the route**

Edit `frontend/src/App.jsx`, add the import:

```js
import Transactions from './pages/Transactions.jsx';
```

Add the route alongside the other `ProtectedRoute`-wrapped routes:

```jsx
        <Route path="/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
```

- [ ] **Step 3: Write the smoke script**

Create `frontend/scripts/smoke/transactions.mjs`:

```js
import { chromium } from 'playwright';

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage();
const errors = [];
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('pageerror', (err) => errors.push(String(err)));

const AGREEMENT = '0xAGMT_txtest';

await page.goto('http://localhost:5173/');
await page.evaluate((address) => {
  localStorage.setItem('account', '0xShip');
  localStorage.setItem('simDate', '2026-08-05');
  localStorage.setItem('mock:users', JSON.stringify({
    '0xShip': { walletAddress: '0xShip', name: 'Ship Co', mail: 's@x.com', role: 'Shipper' },
    '0xCarry': { walletAddress: '0xCarry', name: 'Carry Co', mail: 'c@x.com', role: 'Carrier' },
  }));
  localStorage.setItem('mock:agreements', JSON.stringify({
    [address]: {
      address, shipper: '0xShip', carrier: '0xCarry',
      totalPayoutValue: 1000, payoutRemaining: 1000, duration: 20, status: 'Activated', createdAt: '2026-08-01',
      milestones: [{ title: 'M1', deadline: '2026-08-20', payoutPercent: 100, status: 'InProgress',
        checkpoints: [{ description: 'Load cargo', isRequested: false, isCompleted: false }] }],
    },
  }));
  localStorage.setItem('mock:transactions', JSON.stringify({
    [address]: [{ sender: '0xShip', receiver: address, amount: 1000, txType: 'AgreementCreation', timestamp: new Date('2026-08-01').getTime() }],
  }));
}, AGREEMENT);

await page.goto('http://localhost:5173/transactions');
await page.waitForSelector('text=AgreementCreation');
await page.click(`text=#${AGREEMENT.slice(-6)}`);
await page.waitForURL(new RegExp(AGREEMENT));

if (errors.length) throw new Error(`console errors: ${JSON.stringify(errors)}`);
console.log('transactions smoke: PASS');
await browser.close();
```

- [ ] **Step 4: Run the smoke script**

Run:
```bash
cd frontend
lsof -ti:5173 -sTCP:LISTEN | xargs -r kill 2>/dev/null
nohup npx vite --port 5173 > /tmp/vite-dev.log 2>&1 & disown
for i in $(seq 1 30); do curl -sf http://localhost:5173 >/dev/null && break; sleep 1; done
node scripts/smoke/transactions.mjs
lsof -ti:5173 -sTCP:LISTEN | xargs -r kill 2>/dev/null
```
Expected: `transactions smoke: PASS`

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/pages/Transactions.jsx src/App.jsx scripts/smoke/transactions.mjs
git commit -m "Add Transactions page, wire up the header's existing nav link"
```

---

## Task 11: Full two-role lifecycle smoke test

**Files:**
- Create: `frontend/scripts/smoke/full-lifecycle.mjs`

**Interfaces:**
- Exercises the entire stack built in Tasks 1-10 through the real UI, switching the connected account to simulate both parties, as the final integration proof called for in the spec's Testing section.

- [ ] **Step 1: Write the full lifecycle script**

Create `frontend/scripts/smoke/full-lifecycle.mjs`:

```js
import { chromium } from 'playwright';

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage();
const errors = [];
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('pageerror', (err) => errors.push(String(err)));

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
}

// --- Register shipper and carrier ---
await page.goto('http://localhost:5173/');
await page.evaluate(() => {
  localStorage.setItem('account', '0xE2EShip');
  localStorage.setItem('simDate', '2026-08-01');
});
await page.goto('http://localhost:5173/main');
await page.waitForSelector('text=Complete your registration');
await page.fill('input[type="text"]', 'E2E Shipper');
await page.fill('input[type="email"]', 'ship@e2e.test');
await page.click('button:has-text("Shipper")');
await page.click('button:has-text("Register")');
await page.waitForSelector('text=Hello, E2E Shipper !');

await page.evaluate(() => localStorage.setItem('account', '0xE2ECarry'));
await page.goto('http://localhost:5173/main');
await page.waitForSelector('text=Complete your registration');
await page.fill('input[type="text"]', 'E2E Carrier');
await page.fill('input[type="email"]', 'carry@e2e.test');
await page.click('button:has-text("Carrier")');
await page.click('button:has-text("Register")');
await page.waitForSelector('text=Hello, E2E Carrier !');

// --- Shipper creates an agreement with two milestones ---
await page.evaluate(() => localStorage.setItem('account', '0xE2EShip'));
await page.goto('http://localhost:5173/create');
await page.waitForSelector('text=Create Escrow Agreement');
await page.selectOption('select', { label: 'E2E Carrier (0xE2ECarry)' });
await page.fill('input[type="number"]', '1000');
const deadlines = page.locator('input[type="date"]');
await deadlines.nth(0).fill('2026-08-10');
await page.click('text=Milestone #2:');
await deadlines.nth(1).fill('2026-08-20');
await page.click('button:has-text("Create Agreement")');
await page.waitForURL(/\/agreement\/0xAGMT_/);
const agreementAddress = page.url().split('/agreement/')[1];

// --- Milestone 1: carrier requests, shipper approves ---
await page.evaluate(() => localStorage.setItem('account', '0xE2ECarry'));
await page.reload();
await page.click('button:has-text("Request")');

await page.evaluate(() => localStorage.setItem('account', '0xE2EShip'));
await page.reload();
await page.click('button:has-text("Approve")');
await page.waitForSelector('text=Verified');

let state = await page.evaluate((addr) => JSON.parse(localStorage.getItem('mock:agreements'))[addr], agreementAddress);
assert(state.milestones[0].status === 'Verified', 'milestone 1 should be Verified before its payout date');
assert(state.payoutRemaining === 1000, 'no payout released before Sim Date reaches the deadline');

// --- Advance Sim Date to milestone 1's deadline via the FloatAction widget ---
await page.click('#dropdown-sim-date');
await page.fill('input[type="date"].form-control', '2026-08-10');
await page.reload();

state = await page.evaluate((addr) => JSON.parse(localStorage.getItem('mock:agreements'))[addr], agreementAddress);
assert(state.milestones[0].status === 'Completed', 'milestone 1 should auto-release on its deadline');
assert(state.payoutRemaining === 500, 'half the escrow should be released after milestone 1');
assert(state.milestones[1].status === 'InProgress', 'milestone 2 should already be in progress');

// --- Milestone 2: same request/approve dance ---
await page.evaluate(() => localStorage.setItem('account', '0xE2ECarry'));
await page.reload();
await page.click('button:has-text("Request")');
await page.evaluate(() => localStorage.setItem('account', '0xE2EShip'));
await page.reload();
await page.click('button:has-text("Approve")');

// --- Advance Sim Date to milestone 2's deadline: agreement should complete ---
await page.click('#dropdown-sim-date');
await page.fill('input[type="date"].form-control', '2026-08-20');
await page.reload();

state = await page.evaluate((addr) => JSON.parse(localStorage.getItem('mock:agreements'))[addr], agreementAddress);
assert(state.status === 'Completed', 'agreement should be Completed once the last milestone pays out');
assert(state.payoutRemaining === 0, 'escrow should be fully released');

// --- Second agreement: miss the milestone-1 deadline entirely, expect termination + refund ---
await page.evaluate(() => localStorage.setItem('account', '0xE2EShip'));
await page.goto('http://localhost:5173/create');
await page.selectOption('select', { label: 'E2E Carrier (0xE2ECarry)' });
await page.fill('input[type="number"]', '400');
const secondDeadlines = page.locator('input[type="date"]');
await secondDeadlines.nth(0).fill('2026-08-25');
await page.click('text=Milestone #2:');
await secondDeadlines.nth(1).fill('2026-08-28');
await page.click('button:has-text("Create Agreement")');
await page.waitForURL(/\/agreement\/0xAGMT_/);
const secondAddress = page.url().split('/agreement/')[1];

await page.click('#dropdown-sim-date');
await page.fill('input[type="date"].form-control', '2026-08-26');
await page.reload();

const secondState = await page.evaluate((addr) => JSON.parse(localStorage.getItem('mock:agreements'))[addr], secondAddress);
assert(secondState.status === 'Terminated', 'agreement should auto-terminate after missing its milestone-1 deadline');
assert(secondState.payoutRemaining === 0, 'refund should zero out payoutRemaining');

const secondTxs = await page.evaluate((addr) => JSON.parse(localStorage.getItem('mock:transactions'))[addr], secondAddress);
assert(secondTxs.some((t) => t.txType === 'Refund' && t.amount === 400), 'expected a 400 refund transaction');

// --- Transactions page shows everything for the shipper ---
await page.goto('http://localhost:5173/transactions');
await page.waitForSelector('text=Payoff');
await page.waitForSelector('text=Refund');
const rowCount = await page.locator('tbody tr').count();
assert(rowCount >= 5, `expected at least 5 transaction rows, got ${rowCount}`);

if (errors.length) throw new Error(`console errors: ${JSON.stringify(errors)}`);
console.log('full lifecycle smoke: PASS');
await browser.close();
```

- [ ] **Step 2: Run the full lifecycle script**

Run:
```bash
cd frontend
lsof -ti:5173 -sTCP:LISTEN | xargs -r kill 2>/dev/null
nohup npx vite --port 5173 > /tmp/vite-dev.log 2>&1 & disown
for i in $(seq 1 30); do curl -sf http://localhost:5173 >/dev/null && break; sleep 1; done
node scripts/smoke/full-lifecycle.mjs
lsof -ti:5173 -sTCP:LISTEN | xargs -r kill 2>/dev/null
```
Expected: `full lifecycle smoke: PASS`, no assertion errors, no console errors.

- [ ] **Step 3: Run the full unit-test suite one more time as a final regression check**

Run: `cd frontend && node --test test/mock/`
Expected: PASS (25 tests)

- [ ] **Step 4: Run a production build as a final sanity check**

Run: `cd frontend && npx vite build`
Expected: build succeeds with no errors (the existing >500kB chunk-size warning is pre-existing and fine to ignore).

- [ ] **Step 5: Commit**

```bash
cd frontend && git add scripts/smoke/full-lifecycle.mjs
git commit -m "Add full two-role lifecycle smoke test covering the whole mock LogisticsClient"
```

---

## Self-Review Notes

- **Spec coverage:** storage/simDate (Task 1) → users.js covers register/login/isRegistered/getUser/listRegisteredCarriers (Task 2) → settlement.js covers Policy 3/5/6 and BR5/6/7 (Task 3) → agreements.js covers createAgreement/listMyAgreements/getAgreementDetails/terminateAgreement/requestCheckpoint/approveCheckpoint/checkDeadlines/listTransactions and BR1/2/3/4 (Task 4) → facade (Task 5) → all six UI rewiring bullets from the spec (Tasks 6-10) → full lifecycle proof (Task 11). No spec section is without a task.
- **Placeholder scan:** every step has runnable code; no "similar to Task N", no "add validation" without showing it.
- **Type consistency checked:** `Agreement.status` values (`'Activated'|'Terminated'|'Completed'`) and `Milestone.status` values (`'Pending'|'InProgress'|'Verified'|'Completed'|'Failed'`) are used identically across settlement.js, agreements.js, AgreementDetail.jsx, and CardList.jsx. `createAgreement`'s milestone input shape (`{title, deadline, payoutPercent, checkpoints: string[]}`) matches exactly between agreements.js (Task 4) and CreateAgreement.jsx's submit mapping (Task 8). Function names exported from `logisticsClient.js` (Task 5) match every import in Tasks 6-10 exactly.
