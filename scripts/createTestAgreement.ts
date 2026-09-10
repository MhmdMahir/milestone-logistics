import { network } from "hardhat";

const { ethers } = await network.create();

async function main() {
  const [deployer, ...signers] = await ethers.getSigners();

  // ============================================================
  // YOUR GANACHE ACCOUNTS
  // ============================================================

  const SHIPPER = "0x881E577BC144bFF49AdA3FC8382132128f2F3b9a";

  const CARRIER = "0x395A11F9981A89Dc43b0A2a1326c2326a2A84213";

  // ============================================================
  // DEPLOYED LOGISTICS CLIENT
  // ============================================================

  const LOGISTICS_CLIENT =
    "0xBa994ae6751897C7d0466314afA417aE564EbeA5";

  const PAYMENT_TOKEN =
    "0xf9FD26612b81Af7BaC7E1d8d60Ff386d0bee0eBf";

  const shipper = [deployer, ...signers].find(
    (signer) => signer.address.toLowerCase() === SHIPPER.toLowerCase()
  );

  if (!shipper) {
    throw new Error(`Ganache account ${SHIPPER} is not available to the script`);
  }

  // ============================================================
  // TEST AGREEMENT SETTINGS
  // ============================================================

  const payout = ethers.parseEther("1");

  // 1 hour from now
  const latestBlock = await ethers.provider.getBlock("latest");
  if (!latestBlock) {
    throw new Error("Unable to read the latest Ganache block");
  }
  const deadline = latestBlock.timestamp + 3600;

  const duration = 3600;

  // ============================================================
  // MILESTONE
  // ============================================================

  const milestones = [
    {
      deadline: deadline,
      payoutPercent: 100,
      title: "Test Delivery",
      checkpointDescriptions: [
        "Deliver package"
      ]
    }
  ];

  console.log("");
  console.log("==========================================");
  console.log("CREATING TEMPORARY TEST AGREEMENT");
  console.log("==========================================");

  console.log("Shipper :", SHIPPER);
  console.log("Carrier :", CARRIER);
  console.log("Client  :", LOGISTICS_CLIENT);
  console.log("Payout  :", "1 ETH");
  console.log("");

  // ============================================================
  // 1. DEPLOY LOGISTICS CONTRACT
  // ============================================================

  console.log("1. Deploying LogisticsContract...");

  const LogisticsContract =
    await ethers.getContractFactory("LogisticsContract", deployer);

  const logistics = await LogisticsContract.deploy(
    SHIPPER,
    CARRIER,
    payout,
    duration,
    milestones,
    LOGISTICS_CLIENT
  );

  await logistics.waitForDeployment();

  const agreementAddress =
    await logistics.getAddress();

  console.log("LogisticsContract:");
  console.log(agreementAddress);
  console.log("");

  // ============================================================
  // 2. DEPLOY ESCROW
  // ============================================================

  console.log("2. Deploying Escrow...");

  const Escrow =
    await ethers.getContractFactory("Escrow", deployer);

  const escrow = await Escrow.deploy(
    agreementAddress,
    PAYMENT_TOKEN
  );

  await escrow.waitForDeployment();

  const escrowAddress =
    await escrow.getAddress();

  console.log("Escrow:");
  console.log(escrowAddress);
  console.log("");

  // ============================================================
  // 3. CONNECT ESCROW TO AGREEMENT
  // ============================================================

  console.log("3. Connecting escrow...");

  let tx = await logistics.setEscrow(
    escrowAddress
  );

  await tx.wait();

  console.log("Escrow connected.");
  console.log("");

  // ============================================================
  // 4. FUND ESCROW
  // ============================================================

  console.log("4. Funding escrow with 1 PAY...");

  const token = await ethers.getContractAt("PaymentToken", PAYMENT_TOKEN, shipper);
  await (await token.faucet()).wait();
  await (await token.transfer(escrowAddress, payout)).wait();
  tx = await escrow.connect(shipper).lockFund(payout);

  await tx.wait();

  console.log("Escrow funded.");
  console.log("");

  // ============================================================
  // 5. ACTIVATE AGREEMENT
  // ============================================================

  console.log("5. Activating agreement...");

  tx = await logistics.activateContract();

  await tx.wait();

  console.log("Agreement activated.");
  console.log("");

  // ============================================================
  // 6. VERIFY
  // ============================================================

  const status = await logistics.status();

  const milestone =
    await logistics.getMilestone(0);

  console.log("==========================================");
  console.log("SUCCESS");
  console.log("==========================================");

  console.log("");
  console.log("AGREEMENT ADDRESS:");
  console.log(agreementAddress);

  console.log("");
  console.log("ESCROW ADDRESS:");
  console.log(escrowAddress);

  console.log("");
  console.log("SHIPPER:");
  console.log(SHIPPER);

  console.log("");
  console.log("CARRIER:");
  console.log(CARRIER);

  console.log("");
  console.log("MILESTONE:");
  console.log(milestone.title);

  console.log("");
  console.log("CHECKPOINT:");
  console.log(milestone.checkpoints[0].description);

  console.log("");
  console.log("CONTRACT STATUS:");
  console.log(status.toString());

  console.log("");
  console.log("==========================================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});