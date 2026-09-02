// Frontend facade over UserRegistry, AgreementFactory, LogisticsContract,
// and Escrow. See ./LogisticsClient.d.ts for the type contract.

/** @typedef {import('./LogisticsClient.d.ts').LogisticsClient} LogisticsClientContract */

/** @implements {LogisticsClientContract} */
export class LogisticsClient {
  constructor(signer) {
    this.signer = signer;
  }

  async login() {}

  async register(mail, name, role) {}

  async createAgreement(carrier, totalPayoutValue, duration, milestones) {}

  async listMyAgreements() {}

  async getAgreementDetails(agreementAddress) {}

  async terminateAgreement(agreementAddress) {}

  async requestCheckpoint(agreementAddress, milestoneIndex, checkpointIndex) {}

  async approveCheckpoint(agreementAddress, milestoneIndex, checkpointIndex) {}

  async checkDeadlines(agreementAddress) {}

  async listTransactions(agreementAddress) {}
}
