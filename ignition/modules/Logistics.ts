import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("LogisticsModule", (m) => {
  const userRegistry = m.contract("UserRegistry");
  // Native ETH deployment path. The ERC-20 AgreementFactory and PaymentToken
  // contracts remain available through their own deployment configuration.
  const agreementFactory = m.contract("NativeAgreementFactory");

  const logisticsClient = m.contract("LogisticsClient", [userRegistry, agreementFactory]);

  // One-time wiring so UserRegistry/AgreementFactory trust LogisticsClient as
  // their caller-forwarder (see the onlyClient modifiers on each).
  m.call(userRegistry, "setClient", [logisticsClient]);
  m.call(agreementFactory, "setClient", [logisticsClient]);

  return { userRegistry, agreementFactory, logisticsClient };
});
