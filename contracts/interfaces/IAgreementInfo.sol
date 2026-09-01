// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

// Narrow view used by Escrow to resolve payees from its paired agreement,
// instead of trusting a caller-supplied address. ILogisticsContract already
// exposes both functions, so LogisticsContract satisfies this by ABI shape
// without needing to declare it explicitly.
interface IAgreementInfo {
  function shipper() external view returns (address);

  function carrier() external view returns (address);
}
