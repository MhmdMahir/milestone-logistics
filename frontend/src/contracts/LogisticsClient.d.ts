// Type contract for the frontend facade over UserRegistry, AgreementFactory,
// LogisticsContract and Escrow. No method takes a signer/account param -
// an implementation binds one wallet (the connected MetaMask signer) at
// construction, so every call goes out as that same account.

export type UserRole = "Shipper" | "Carrier";
export type ContractStatus = "Pending" | "Activated" | "Terminated" | "Completed";
export type MilestoneStatus = "Pending" | "InProgress" | "Completed" | "Failed";
export type TransactionType = "AgreementCreation" | "Payoff" | "Refund";

export interface UserProfile {
  walletAddress: string;
  mail: string;
  role: UserRole;
  name: string;
}

export interface MilestoneCheckpoint {
  description: string;
  isRequested: boolean;
  isCompleted: boolean;
}

export interface Milestone {
  deadline: number; // unix seconds
  payoutPercent: number;
  title: string;
  status: MilestoneStatus;
  checkpoints: MilestoneCheckpoint[];
}

export interface MilestoneInput {
  deadline: number; // unix seconds
  payoutPercent: number;
  title: string;
  checkpointDescriptions: string[];
}

export interface Transaction {
  sender: string;
  receiver: string;
  amount: bigint; // wei
  txType: TransactionType;
  timestamp: number; // unix seconds
}

export interface DeadlineEvent {
  agreementAddress: string;
  milestone: string;
  amount: bigint; // wei
  type: "Terminated" | "MilestoneCompleted" | "Completed";
}

export interface AgreementDetails {
  address: string;
  shipper: string;
  carrier: string;
  totalPayoutValue: bigint; // wei
  payoutRemaining: bigint; // wei
  duration: number; // seconds
  status: ContractStatus;
  milestones: Milestone[];
}

export interface LogisticsClient {
  // USER
  login(): Promise<UserProfile>;
  register(mail: string, name: string, role: UserRole): Promise<void>;
  // Empty name (unregistered address) means "escrow", not a user - see impl.
  getUserName(address: string): Promise<string>;

  // AGREEMENT
  createAgreement(
    carrier: string,
    totalPayoutValue: bigint,
    duration: number,
    milestones: MilestoneInput[],
  ): Promise<string>;
  listMyAgreements(): Promise<string[]>;
  getAgreementDetails(agreementAddress: string): Promise<AgreementDetails>;
  terminateAgreement(agreementAddress: string): Promise<void>;

  // MILESTONE / CHECKPOINT
  requestCheckpoint(agreementAddress: string, milestoneIndex: number, checkpointIndex: number): Promise<void>;
  approveCheckpoint(agreementAddress: string, milestoneIndex: number, checkpointIndex: number): Promise<void>;
  // DEMO-ONLY: evaluates against FloatAction's "Sim Date" (localStorage
  // "simDate"), not the real clock, so the deadline-failure path can be
  // demoed without waiting real time. Never do this in a production client.
  checkDeadlines(agreementAddress: string): Promise<DeadlineEvent | null>;

  // TRANSACTIONS
  listTransactions(agreementAddress: string): Promise<Transaction[]>;
}
