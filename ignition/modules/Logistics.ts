import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("LogisticsModule", (m) => {
  const paymentToken = m.contract("PaymentToken");
  const userRegistry = m.contract("UserRegistry");
  const agreementFactory = m.contract("AgreementFactory", [paymentToken]);

  const logisticsClient = m.contract("LogisticsClient", [userRegistry, agreementFactory]);

  // One-time wiring so UserRegistry/AgreementFactory trust LogisticsClient as
  // their caller-forwarder (see the onlyClient modifiers on each).
  m.call(userRegistry, "setClient", [logisticsClient]);
  m.call(agreementFactory, "setClient", [logisticsClient]);

  return { paymentToken, userRegistry, agreementFactory, logisticsClient };
});
