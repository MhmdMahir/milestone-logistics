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

struct UserProfile {
  address walletAddress;
  string mail;
  UserRole role;
  string name;
}

struct MilestoneCheckpoint {
  string description;
  bool isCompleted;
}

struct Milestone {
  uint256 deadline;
  uint256 payoutPercent;
  string title;
  MilestoneStatus status;
  MilestoneCheckpoint[] checkpoints;
}

struct Transaction {
  uint256 timestamp;
  string description;
  uint256 amount;
}
