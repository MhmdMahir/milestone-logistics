// Frontend facade over contracts/LogisticsClient.sol. Talks to the deployed
// contract directly via ethers — see ./LogisticsClient.d.ts for the type
// contract this must satisfy, and Types.sol for the enums converted below.

import { ethers } from 'ethers';
import { getContract, CHAIN_ID } from './index';

const ROLE_LABELS = ['Shipper', 'Carrier'];
const ROLE_VALUES = { Shipper: 0, Carrier: 1 };
const STATUS_LABELS = ['Pending', 'Activated', 'Terminated', 'Completed'];
const MILESTONE_STATUS_LABELS = ['Pending', 'InProgress', 'Completed', 'Failed'];
const TX_TYPE_LABELS = ['AgreementCreation', 'Payoff', 'Refund'];

// checkDeadlines()/approveCheckpoint() act on a per-agreement LogisticsContract,
// deployed dynamically by the factory (no fixed address, so it isn't one of
// index.js's known deployments). These are the only events off it we need.
const AGREEMENT_EVENTS = new ethers.Interface([
  'event ContractTerminated()',
  'event ContractCompleted()',
  'event MilestoneStatusUpdated(uint256 indexed milestoneIndex)',
]);

// Demo-only: checkDeadlines() takes "now" from the caller instead of reading
// block.timestamp, so the FloatAction "Sim Date" control can fast-forward
// past a deadline without waiting real time. NEVER do this in a production
// deployment — see the DEMO-ONLY comment on ILogisticsContract.checkDeadlines.
export function simulatedNow() {
  const sim = localStorage.getItem('simDate');
  return Math.floor((sim ? new Date(sim) : new Date()).getTime() / 1000);
}

/**
 * Pulls the Solidity require() message out of an ethers/MetaMask error.
 * Where that string actually lives depends on which layer caught the
 * revert — a mined transaction, a pre-flight gas estimate, and MetaMask's
 * own RPC error wrapping each nest it differently — so this checks the
 * known spots before falling back to whatever text is available.
 */
export function revertReason(error, fallback = 'Transaction failed') {
  return (
    error?.reason ??
    error?.data?.data?.reason ??
    error?.info?.error?.data?.reason ??
    error?.shortMessage ??
    error?.data?.message ??
    error?.message ??
    fallback
  );
}

/** @implements {import('./LogisticsClient.d.ts').LogisticsClient} */
export class LogisticsClient {
  constructor(signer) {
    this.signer = signer;
    this.contract = getContract('LogisticsClient', CHAIN_ID, signer);
  }

  async login() {
    const profile = await this.contract.login();
    return {
      walletAddress: profile.walletAddress,
      mail: profile.mail,
      role: ROLE_LABELS[Number(profile.role)],
      name: profile.name,
    };
  }

  async register(mail, name, role) {
    const tx = await this.contract.register(mail, name, ROLE_VALUES[role]);
    await tx.wait();
  }

  async createAgreement(carrier, totalPayoutValue, duration, milestones) {
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

  async listMyAgreements() {
    return this.contract.listMyAgreements();
  }

  async getAgreementDetails(agreementAddress) {
    const d = await this.contract.getAgreementDetails(agreementAddress);
    return {
      address: agreementAddress,
      shipper: d.shipper,
      carrier: d.carrier,
      totalPayoutValue: d.totalPayoutValue,
      payoutRemaining: d.payoutRemaining,
      duration: d.duration,
      status: STATUS_LABELS[Number(d.status)],
      milestones: d.milestones.map((m) => ({
        deadline: Number(m.deadline),
        payoutPercent: Number(m.payoutPercent),
        title: m.title,
        status: MILESTONE_STATUS_LABELS[Number(m.status)],
        checkpoints: m.checkpoints.map((c) => ({
          description: c.description,
          isRequested: c.isRequested,
          isCompleted: c.isCompleted,
        })),
      })),
    };
  }

  async terminateAgreement(agreementAddress) {
    const tx = await this.contract.terminateAgreement(agreementAddress);
    await tx.wait();
  }

  async requestCheckpoint(agreementAddress, milestoneIndex, checkpointIndex) {
    const tx = await this.contract.requestCheckpoint(agreementAddress, milestoneIndex, checkpointIndex);
    await tx.wait();
  }

  async approveCheckpoint(agreementAddress, milestoneIndex, checkpointIndex) {
    const tx = await this.contract.approveCheckpoint(agreementAddress, milestoneIndex, checkpointIndex);
    await tx.wait();
  }

  async checkDeadlines(agreementAddress) {
    const tx = await this.contract.checkDeadlines(agreementAddress, simulatedNow());
    const receipt = await tx.wait();
    return this.#deadlineEvent(agreementAddress, receipt);
  }

  async listTransactions(agreementAddress) {
    const txs = await this.contract.listTransactions(agreementAddress);
    return txs.map((t) => ({
      sender: t.sender,
      receiver: t.receiver,
      amount: t.amount,
      txType: TX_TYPE_LABELS[Number(t.txType)],
      timestamp: Number(t.timestamp),
    }));
  }

  // checkDeadlines() itself returns nothing on-chain; LogisticsContract.sol's
  // events emitted in the same transaction are the only way to tell whether
  // it actually failed a milestone versus a no-op poke before the deadline.
  async #deadlineEvent(agreementAddress, receipt) {
    const events = receipt.logs
      .filter((log) => log.address.toLowerCase() === agreementAddress.toLowerCase())
      .map((log) => {
        try {
          return AGREEMENT_EVENTS.parseLog(log);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    const milestoneUpdate = events.find((e) => e.name === 'MilestoneStatusUpdated');
    if (!milestoneUpdate) return null;

    const [details, transactions] = await Promise.all([
      this.getAgreementDetails(agreementAddress),
      this.listTransactions(agreementAddress),
    ]);
    const milestone = details.milestones[Number(milestoneUpdate.args.milestoneIndex)];
    const amount = transactions[transactions.length - 1]?.amount ?? 0n;

    return {
      agreementAddress,
      milestone: milestone.title,
      amount,
      type: events.some((e) => e.name === 'ContractTerminated')
        ? 'Terminated'
        : events.some((e) => e.name === 'ContractCompleted')
          ? 'Completed'
          : 'MilestoneCompleted',
    };
  }
}
