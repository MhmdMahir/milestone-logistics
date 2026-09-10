import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("LogisticsModule", (m) => {
  const userRegistry = m.contract("UserRegistry");
  // ERC-20 deployment path. The shipper must approve `agreementFactory` for
  // totalPayoutValue before createAgreement (see PaymentToken.faucet() for
  // how to get test tokens on Ganache). NativeAgreementFactory/NativeEscrow
  // remain available for anyone who wants to swap back to native ETH.
  const paymentToken = m.contract("PaymentToken");
  const agreementFactory = m.contract("AgreementFactory", [paymentToken]);

  const logisticsClient = m.contract("LogisticsClient", [userRegistry, agreementFactory]);

  // One-time wiring so UserRegistry/AgreementFactory trust LogisticsClient as
  // their caller-forwarder (see the onlyClient modifiers on each).
  m.call(userRegistry, "setClient", [logisticsClient]);
  m.call(agreementFactory, "setClient", [logisticsClient]);

  return { userRegistry, paymentToken, agreementFactory, logisticsClient };
});
