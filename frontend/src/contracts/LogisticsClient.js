// Frontend facade over UserRegistry, AgreementFactory, LogisticsContract,
// and Escrow. See ./LogisticsClient.d.ts for the type contract.

import { getContract, CHAIN_ID } from './index';

/** @typedef {import('./LogisticsClient.d.ts').LogisticsClient} LogisticsClientContract */

/** Matches the UserRole enum in contracts/interfaces/Types.sol. */
export const UserRole = {
  Shipper: 0,
  Carrier: 1,
};

/** @implements {LogisticsClientContract} */
export class LogisticsClient {
  constructor(signer) {
    this.signer = signer;
    this.contract = getContract('LogisticsClient', CHAIN_ID, signer);
  }

  async login() {
    return this.contract.login();
  }

  async register(mail, name, role) {
    const tx = await this.contract.register(mail, name, role);
    return tx.wait();
  }

  /**
   * Create and fund an agreement.
   *
   * @param {string} carrier            0x address of the carrier — NOT a name.
   * @param {bigint} totalPayoutValue   Escrow value in wei. Also sent as msg.value:
   *                                    the factory requires an exact match, so any
   *                                    display-only fees must be excluded here.
   * @param {number|bigint} duration    Agreement length in seconds.
   * @param {Array} milestones          [{ title, payoutPercent, deadline, checkpointDescriptions }]
   *                                    where deadline is a Unix timestamp in seconds,
   *                                    ascending, and inside `duration`.
   * @returns {Promise<string>} address of the deployed agreement
   */
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

  async getAgreementDetails(agreementAddress) {}

  async terminateAgreement(agreementAddress) {}

  async requestCheckpoint(agreementAddress, milestoneIndex, checkpointIndex) {}

  async approveCheckpoint(agreementAddress, milestoneIndex, checkpointIndex) {}

  async checkDeadlines(agreementAddress) {}

  async listTransactions(agreementAddress) {}
}

/**
 * Pulls a readable reason out of an ethers error.
 *
 * Every rule in LogisticsClient.sol reverts with a descriptive string, so
 * surfacing this instead of the raw error is what makes the contract's
 * validation visible to the user.
 */
export function revertReason(error) {
  return (
    error?.reason ??
    error?.data?.message ??
    error?.info?.error?.message ??
    error?.shortMessage ??
    error?.message ??
    'Transaction failed'
  );
}