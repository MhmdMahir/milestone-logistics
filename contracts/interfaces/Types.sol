// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

enum ContractStatus {
  Pending,
  Activated,
  Terminated,
  Completed
}

enum MilestoneStatus {
  Pending,
  InProgress,
  Completed,
  Failed
}

enum EscrowStatus {
  Locked,
  Released,
  Refunded
}

enum UserRole {
  Shipper,
  Carrier
}

enum TransactionType {
  AgreementCreation,
  Payoff,
  Refund
}

struct UserProfile {
  address walletAddress;
  string mail;
  UserRole role;
  string name;
}

struct MilestoneCheckpoint {
  string description;
  bool isRequested;
  bool isCompleted;
}

struct Milestone {
  uint256 deadline;
  uint256 payoutPercent;
  string title;
  MilestoneStatus status;
  MilestoneCheckpoint[] checkpoints;
}

// Creation-time input shape. Kept separate from `Milestone` because status
// and checkpoint completion state don't exist yet when an agreement is created.
struct MilestoneInput {
  uint256 deadline;
  uint256 payoutPercent;
  string title;
  string[] checkpointDescriptions;
}

struct Transaction {
  address sender;
  address receiver;
  uint256 amount;
  TransactionType txType;
  uint256 timestamp;
}
