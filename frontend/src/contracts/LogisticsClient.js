// Frontend facade over UserRegistry, AgreementFactory, LogisticsContract,
// and Escrow. See ./LogisticsClient.d.ts for the type contract.
//
// Mock: backs every method with localStorage instead of an ethers.Contract
// call, mirroring the access rules and state machine already implemented in
// contracts/LogisticsContract.sol so swapping in the real client later is a
// drop-in replacement of this file's internals only.

import { ethers } from 'ethers';

/** @typedef {import('./LogisticsClient.d.ts').LogisticsClient} LogisticsClientContract */

const AGREEMENTS_KEY = 'ml_agreements';
const REFUND_DEMO_KEY = 'ml_refund_demo';

function loadAgreements() {
  return JSON.parse(localStorage.getItem(AGREEMENTS_KEY) || '[]');
}

function saveAgreements(list) {
  localStorage.setItem(AGREEMENTS_KEY, JSON.stringify(list));
}

function loadProfile(address) {
  const raw = localStorage.getItem(`profile:${address}`);
  return raw ? JSON.parse(raw) : null;
}

// Honors FloatAction's simulated platform date so deadline logic is testable.
function nowSeconds() {
  const sim = localStorage.getItem('simDate');
  return Math.floor((sim ? new Date(sim) : new Date()).getTime() / 1000);
}

/** @implements {LogisticsClientContract} */
export class LogisticsClient {
  constructor(signer) {
    this.signer = signer;
  }

  async #address() {
    return this.signer.getAddress();
  }

  #find(agreementAddress) {
    const all = loadAgreements();
    const agreement = all.find((a) => a.address === agreementAddress);
    if (!agreement) throw new Error('LogisticsClient: agreement not found');
    return { all, agreement };
  }

  async login() {
    const profile = loadProfile(await this.#address());
    if (!profile) throw new Error('UserRegistry: not registered');
    return profile;
  }

  async register(mail, name, role) {
    const address = await this.#address();
    if (loadProfile(address)) throw new Error('UserRegistry: already registered');
    localStorage.setItem(`profile:${address}`, JSON.stringify({ walletAddress: address, mail, name, role }));
  }

  async createAgreement(carrier, totalPayoutValue, duration, milestones) {
    const shipper = await this.#address();
    const profile = loadProfile(shipper);
    if (!profile || profile.role !== 'Carrier') {
      throw new Error('LogisticsClient: only accounts registered as Carrier can create an agreement');
    }
    const agreement = {
      address: crypto.randomUUID(),
      shipper,
      carrier: ethers.getAddress(carrier.trim()),
      totalPayoutValue: totalPayoutValue.toString(),
      payoutRemaining: totalPayoutValue.toString(),
      duration,
      status: 'Activated',
      milestones: milestones.map((m, i) => ({
        deadline: m.deadline,
        payoutPercent: m.payoutPercent,
        title: m.title,
        status: i === 0 ? 'InProgress' : 'Pending',
        checkpoints: m.checkpointDescriptions.map((description) => ({
          description,
          isRequested: false,
          isCompleted: false,
        })),
      })),
      transactions: [
        { sender: shipper, receiver: '', amount: totalPayoutValue.toString(), txType: 'AgreementCreation', timestamp: nowSeconds() },
      ],
    };
    agreement.transactions[0].receiver = agreement.address; // escrow == the agreement itself in the mock

    const all = loadAgreements();
    all.push(agreement);
    saveAgreements(all);
    return agreement.address;
  }

  // Demo-only helper: the connected wallet is both parties so one account can
  // exercise the existing carrier and shipper methods in the mock.
  async createRefundDemoAgreement() {
    const account = await this.#address();
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 1);
    const deadlineSeconds = Math.floor(deadline.getTime() / 1000);
    const amount = ethers.parseEther('1').toString();
    const agreement = {
      address: `refund-demo-${crypto.randomUUID()}`,
      shipper: account,
      carrier: account,
      totalPayoutValue: amount,
      payoutRemaining: amount,
      duration: 86400,
      status: 'Activated',
      milestones: [{
        deadline: deadlineSeconds,
        payoutPercent: 100,
        title: 'Refund Demo Delivery',
        status: 'InProgress',
        checkpoints: [
          { description: 'Pickup confirmed', isRequested: false, isCompleted: false },
          { description: 'Delivered to recipient', isRequested: false, isCompleted: false },
        ],
      }],
      transactions: [{
        sender: account,
        receiver: `refund-demo-escrow-${crypto.randomUUID()}`,
        amount,
        txType: 'AgreementCreation',
        timestamp: nowSeconds(),
      }],
    };
    const demoAddress = localStorage.getItem(REFUND_DEMO_KEY);
    const all = loadAgreements().filter((item) => item.address !== demoAddress);
    all.push(agreement);
    saveAgreements(all);
    localStorage.setItem(REFUND_DEMO_KEY, agreement.address);
    return agreement.address;
  }

  async listMyAgreements() {
    const address = await this.#address();
    return loadAgreements()
      .filter((a) => a.shipper === address || a.carrier === address)
      .map((a) => a.address);
  }

  async getAgreementDetails(agreementAddress) {
    const { agreement } = this.#find(agreementAddress);
    return {
      address: agreement.address,
      shipper: agreement.shipper,
      carrier: agreement.carrier,
      totalPayoutValue: BigInt(agreement.totalPayoutValue),
      payoutRemaining: BigInt(agreement.payoutRemaining),
      duration: agreement.duration,
      status: agreement.status,
      milestones: agreement.milestones,
    };
  }

  async terminateAgreement(agreementAddress) {
    const caller = await this.#address();
    const { all, agreement } = this.#find(agreementAddress);
    if (agreement.status !== 'Activated') throw new Error('LogisticsContract: not activated');
    if (caller !== agreement.shipper) throw new Error('LogisticsContract: caller is not the shipper');
    this.#refund(agreement);
    saveAgreements(all);
  }

  async requestCheckpoint(agreementAddress, milestoneIndex, checkpointIndex) {
    const caller = await this.#address();
    const { all, agreement } = this.#find(agreementAddress);
    if (caller !== agreement.carrier) throw new Error('LogisticsContract: caller is not the carrier');
    const checkpoint = this.#inProgressCheckpoint(agreement, milestoneIndex, checkpointIndex);
    checkpoint.isRequested = true;
    saveAgreements(all);
  }

  async approveCheckpoint(agreementAddress, milestoneIndex, checkpointIndex) {
    const caller = await this.#address();
    const { all, agreement } = this.#find(agreementAddress);
    if (caller !== agreement.shipper) throw new Error('LogisticsContract: caller is not the shipper');
    const checkpoint = this.#inProgressCheckpoint(agreement, milestoneIndex, checkpointIndex);
    if (!checkpoint.isRequested) throw new Error('LogisticsContract: checkpoint not requested');
    checkpoint.isCompleted = true;
    // This mirrors LogisticsContract.sol: the final approval completes the
    // milestone immediately, releases its payout, and activates the next one.
    if (agreement.milestones[milestoneIndex].checkpoints.every((item) => item.isCompleted)) {
      this.#completeMilestone(agreement, milestoneIndex);
    }
    saveAgreements(all);
  }

  async checkDeadlines(agreementAddress) {
    const { all, agreement } = this.#find(agreementAddress);
    if (agreement.status !== 'Activated') return null;
    const milestoneIndex = agreement.milestones.findIndex((m) => m.status === 'InProgress');
    if (milestoneIndex === -1) return null;
    const milestone = agreement.milestones[milestoneIndex];
    if (nowSeconds() <= milestone.deadline) return null;

    let event;
    if (milestone.checkpoints.every((c) => c.isCompleted)) {
      const amount = this.#completeMilestone(agreement, milestoneIndex);
      event = {
        agreementAddress,
        milestone: milestone.title,
        amount,
        type: agreement.status === 'Completed' ? 'Completed' : 'MilestoneCompleted',
      };
    } else {
      milestone.status = 'Failed';
      const amount = this.#refund(agreement);
      event = { agreementAddress, milestone: milestone.title, amount, type: 'Terminated' };
    }
    saveAgreements(all);
    return event;
  }

  #completeMilestone(agreement, milestoneIndex) {
    const milestone = agreement.milestones[milestoneIndex];
    milestone.status = 'Completed';
    const payoutShare = (BigInt(agreement.totalPayoutValue) * BigInt(milestone.payoutPercent)) / 100n;
    agreement.payoutRemaining = (BigInt(agreement.payoutRemaining) - payoutShare).toString();
    agreement.transactions.push({
      sender: agreement.address,
      receiver: agreement.carrier,
      amount: payoutShare.toString(),
      txType: 'Payoff',
      timestamp: nowSeconds(),
    });

    const next = agreement.milestones[milestoneIndex + 1];
    if (next) next.status = 'InProgress';
    else agreement.status = 'Completed';
    return payoutShare;
  }

  async listTransactions(agreementAddress) {
    const { agreement } = this.#find(agreementAddress);
    return agreement.transactions.map((t) => ({ ...t, amount: BigInt(t.amount) }));
  }

  #inProgressCheckpoint(agreement, milestoneIndex, checkpointIndex) {
    if (agreement.status !== 'Activated') throw new Error('LogisticsContract: not activated');
    const milestone = agreement.milestones[milestoneIndex];
    if (milestone.status !== 'InProgress') throw new Error('LogisticsContract: milestone not in progress');
    const checkpoint = milestone.checkpoints[checkpointIndex];
    if (checkpoint.isCompleted) throw new Error('LogisticsContract: checkpoint already completed');
    return checkpoint;
  }

  #refund(agreement) {
    agreement.status = 'Terminated';
    const amount = BigInt(agreement.payoutRemaining);
    agreement.transactions.push({
      sender: agreement.address,
      receiver: agreement.shipper,
      amount: agreement.payoutRemaining,
      txType: 'Refund',
      timestamp: nowSeconds(),
    });
    agreement.payoutRemaining = '0';
    return amount;
  }
}
