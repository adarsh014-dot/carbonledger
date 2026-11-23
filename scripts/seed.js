const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const hash = (text) => hre.ethers.keccak256(hre.ethers.toUtf8Bytes(text));

async function main() {
  const { ethers, network } = hre;

  const file = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`No deployment found for ${network.name}. Run deploy first.`);
  }
  const deployment = JSON.parse(fs.readFileSync(file, "utf8"));
  const addresses = deployment.contracts;

  const [admin, devA, devB, buyerA, buyerB, buyerC] = await ethers.getSigners();
  if (!admin) throw new Error("No signers available.");

  const registry = await ethers.getContractAt("ProjectRegistry", addresses.ProjectRegistry);
  const token = await ethers.getContractAt("CarbonCreditToken", addresses.CarbonCreditToken);
  const certificate = await ethers.getContractAt("RetirementCertificate", addresses.RetirementCertificate);
  const marketplace = await ethers.getContractAt("CarbonMarketplace", addresses.CarbonMarketplace);

  if ((await registry.projectCount()) > 0n) {
    console.log("Registry already has projects - skipping seed to avoid duplicates.");
    return;
  }

  console.log("Seeding demo data on", network.name, "...\n");

  // ---------------------------------------------------------------- projects
  const projects = [
    {
      signer: devA || admin,
      name: "Western Ghats Reforestation",
      location: "Karnataka, India",
      methodology: "Verra VM0047 v1.0 - Afforestation",
      capacity: 12000,
      doc: "western-ghats-methodology-2025.pdf",
    },
    {
      signer: devB || admin,
      name: "Sundarbans Mangrove Restoration",
      location: "West Bengal, India",
      methodology: "Gold Standard GS4.1 - Blue Carbon",
      capacity: 8000,
      doc: "sundarbans-blue-carbon-2025.pdf",
    },
    {
      signer: admin,
      name: "Rajasthan Solar Cookstove Programme",
      location: "Rajasthan, India",
      methodology: "CDM AMS-II.G - Efficient Cookstoves",
      capacity: 5000,
      doc: "rajasthan-cookstove-2025.pdf",
    },
    {
      signer: devA || admin,
      name: "Coastal Wind Energy Cluster",
      location: "Gujarat, India",
      methodology: "Verra VCS ACM0002 - Grid-connected RE",
      capacity: 20000,
      doc: "gujarat-wind-2025.pdf",
    },
    {
      signer: devB || admin,
      name: "Himalayan Spring Water Conservation",
      location: "Uttarakhand, India",
      methodology: "Gold Standard GS5.1 - Water Benefit",
      capacity: 3000,
      doc: "himalaya-water-2025.pdf",
    },
  ];

  for (let i = 0; i < projects.length; i++) {
    const p = projects[i];
    const tx = await registry
      .connect(p.signer)
      .registerProject(p.name, p.location, p.methodology, hash(p.doc), p.capacity);
    await tx.wait();
    console.log(`Project #${i + 1} registered: ${p.name}`);
  }

  // Verify the first four, leave the fifth pending for the admin demo.
  for (let i = 1; i <= 4; i++) {
    const tx = await registry.connect(admin).verifyProject(i);
    await tx.wait();
    console.log(`Project #${i} verified`);
  }

  // ----------------------------------------------------------------- batches
  const batches = [
    { projectId: 1, vintage: 2025, tonnes: 1000, serial: "WG-2025-B001", to: buyerA },
    { projectId: 2, vintage: 2024, tonnes: 2500, serial: "SB-2024-B014", to: buyerB },
    { projectId: 3, vintage: 2025, tonnes: 800, serial: "RJ-2025-B007", to: buyerC },
    { projectId: 4, vintage: 2023, tonnes: 5000, serial: "GJ-2023-B021", to: buyerA },
  ];

  for (const b of batches) {
    const tx = await token.connect(admin).issueBatch(b.projectId, b.vintage, b.tonnes, hash(b.serial));
    await tx.wait();
    const batchId = await token.batchCount();
    if (b.to && b.to.address !== admin.address) {
      const transfer = await token
        .connect(admin)
        .safeTransferFrom(admin.address, b.to.address, batchId, b.tonnes, "0x");
      await transfer.wait();
    }
    console.log(`Batch #${batchId} issued (${b.tonnes} tCO2e, vintage ${b.vintage})`);
  }

  // --------------------------------------------------------------- retirements
  let tx = await token
    .connect(buyerA)
    .retireCredits(1, 150, buyerA.address, "Offsetting FY2024-25 business travel");
  await tx.wait();
  console.log("Retired 150 tCO2e from batch #1 -> certificate #1");

  tx = await token
    .connect(buyerB)
    .retireCredits(2, 400, buyerB.address, "Product lifecycle neutrality claim 2025");
  await tx.wait();
  console.log("Retired 400 tCO2e from batch #2 -> certificate #2");

  // ---------------------------------------------------------------- marketplace
  await (await token.connect(buyerA).setApprovalForAll(addresses.CarbonMarketplace, true)).wait();
  await (await token.connect(buyerB).setApprovalForAll(addresses.CarbonMarketplace, true)).wait();

  tx = await marketplace
    .connect(buyerA)
    .listCredits(4, 1200, ethers.parseEther("0.00035"));
  await tx.wait();
  console.log("Listed 1200 tCO2e of batch #4 at 0.00035 ETH / tonne");

  tx = await marketplace
    .connect(buyerB)
    .listCredits(2, 600, ethers.parseEther("0.00048"));
  await tx.wait();
  console.log("Listed 600 tCO2e of batch #2 at 0.00048 ETH / tonne");

  console.log("\nSeed complete.");
  console.log("Summary:");
  console.log("  projects :", (await registry.projectCount()).toString());
  console.log("  batches  :", (await token.batchCount()).toString());
  console.log("  issued   :", (await token.totalIssuedTonnes()).toString(), "tCO2e");
  console.log("  retired  :", (await token.totalRetiredTonnes()).toString(), "tCO2e");
  console.log("  certs    :", (await certificate.certificateCount()).toString());
  console.log("  listings :", (await marketplace.listingCount()).toString());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
