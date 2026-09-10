import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { network } from "hardhat";

/**
 * Seeds a freshly deployed local stack with a working agreement.
 *
 *   npx hardhat run scripts/seed.ts --network ganache
 *
 * Run this after every `ignition deploy ... --reset`, since a reset wipes all
 * registrations and agreements. It exists so the demo does not start with
 * five minutes of clicking through registration forms.
 *
 * Only one private key lives in the keystore, so the carrier is generated
 * here and funded from the deployer. That keeps a second private key out of
 * the repo while still giving us two distinct wallets — which matters,
 * because the client derives identity from msg.sender.
 */

// Enum order in interfaces/Types.sol. If registration reports the wrong role
// below, these two are the first thing to check.
const ROLE_SHIPPER = 0;
const ROLE_CARRIER = 1;

const DAY = 60 * 60 * 24;

function loadDeployedAddresses(): Record<string, string> {
  const root = join(process.cwd(), "ignition", "deployments");
  const chainDirs = readdirSync(root).filter((d) => d.startsWith("chain-"));

  if (chainDirs.length === 0) {
    throw new Error("No Ignition deployment found — deploy the module first.");
  }
  if (chainDirs.length > 1) {
    console.log(`Multiple deployments found (${chainDirs.join(", ")}), using ${chainDirs[0]}`);
  }

  return JSON.parse(readFileSync(join(root, chainDirs[0], "deployed_addresses.json"), "utf8"));
}

async function main() {
  const { ethers } = await network.connect();

  const addresses = loadDeployedAddresses();
  const clientAddress = addresses["LogisticsModule#LogisticsClient"];
  const registryAddress = addresses["LogisticsModule#UserRegistry"];

  if (!clientAddress) {
    throw new Error(`LogisticsClient address not found. Keys present: ${Object.keys(addresses)}`);
  }

  const [shipper] = await ethers.getSigners();
  const provider = shipper.provider;

  // Second wallet, funded from the deployer.
  const carrier = ethers.Wallet.createRandom().connect(provider);
  await (await shipper.sendTransaction({ to: carrier.address, value: ethers.parseEther("1") })).wait();

  console.log("Shipper:", shipper.address);
  console.log("Carrier:", carrier.address);

  const client = await ethers.getContractAt("LogisticsClient", clientAddress);
  const registry = await ethers.getContractAt("UserRegistry", registryAddress);

  // ---- Registration ------------------------------------------------
  await (await client.connect(shipper).register("shipper@demo.test", "Demo Shipper", ROLE_SHIPPER)).wait();
  await (await client.connect(carrier).register("carrier@demo.test", "Demo Carrier", ROLE_CARRIER)).wait();

  const shipperProfile = await registry.getUser(shipper.address);
  const carrierProfile = await registry.getUser(carrier.address);
  console.log(`Registered ${shipperProfile.name} (role ${shipperProfile.role})`);
  console.log(`Registered ${carrierProfile.name} (role ${carrierProfile.role})`);

  if (shipperProfile.role === carrierProfile.role) {
    throw new Error("Both wallets got the same role — ROLE_SHIPPER / ROLE_CARRIER are likely swapped.");
  }

  // ---- Create a funded agreement -----------------------------------
  const now = (await provider.getBlock("latest"))!.timestamp;
  const duration = 30 * DAY;
  const totalPayoutValue = ethers.parseEther("3.0");

  const milestones = [
    {
      deadline: now + 10 * DAY,
      payoutPercent: 30,
      title: "Pickup confirmed",
      checkpointDescriptions: ["Cargo collected", "Seal photographed"],
    },
    {
      deadline: now + 25 * DAY,
      payoutPercent: 70,
      title: "Final delivery",
      checkpointDescriptions: ["Delivered", "POD signed"],
    },
  ];

  const tx = await client
    .connect(shipper)
    .createAgreement(carrier.address, totalPayoutValue, duration, milestones, { value: totalPayoutValue });
  await tx.wait();

  const mine = await client.connect(shipper).listMyAgreements();
  console.log(`\nAgreement deployed at: ${mine[mine.length - 1]}`);
  console.log(`Funded with ${ethers.formatEther(totalPayoutValue)} ETH, split 30 / 70`);

  // ---- Prove the validation actually rejects bad input --------------
  // Each of these should revert. A silent success means a rule is missing.
  const checks: Array<[string, () => Promise<unknown>]> = [
    [
      "unregistered carrier",
      () =>
        client.connect(shipper).createAgreement(
          ethers.Wallet.createRandom().address,
          totalPayoutValue,
          duration,
          milestones,
          { value: totalPayoutValue }
        ),
    ],
    [
      "deadline in the past",
      () =>
        client.connect(shipper).createAgreement(
          carrier.address,
          totalPayoutValue,
          duration,
          [{ ...milestones[0], deadline: now - DAY }, milestones[1]],
          { value: totalPayoutValue }
        ),
    ],
    [
      "duration beyond 90 days",
      () =>
        client
          .connect(shipper)
          .createAgreement(carrier.address, totalPayoutValue, 120 * DAY, milestones, { value: totalPayoutValue }),
    ],
    [
      "carrier same as shipper",
      () =>
        client
          .connect(shipper)
          .createAgreement(shipper.address, totalPayoutValue, duration, milestones, { value: totalPayoutValue }),
    ],
  ];

  console.log("\nValidation checks (all of these should be rejected):");
  for (const [label, attempt] of checks) {
    try {
      await attempt();
      console.log(`  NOT REJECTED — ${label}`);
    } catch (error: any) {
      const reason = error?.shortMessage ?? error?.reason ?? "reverted";
      console.log(`  rejected — ${label}: ${reason}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
