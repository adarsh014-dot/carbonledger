const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const hash = (text) => hre.ethers.keccak256(hre.ethers.toUtf8Bytes(text));

// A neutral demo beneficiary for one certificate (no private key needed).
const DEMO_BENEFICIARY = "0x2222222222222222222222222222222222222222";

async function main() {
  const { ethers, network } = hre;

  const file = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`No deployment found for ${network.name}. Run deploy first.`);
  }
  const deployment = JSON.parse(fs.readFileSync(file, "utf8"));
  const addresses = deployment.contracts;

  const signers = await ethers.getSigners();
  if (!signers.length) throw new Error("No signer available. Check PRIVATE_KEY in .env.");
  const admin = signers[0];

  const registry = await ethers.getContractAt("ProjectRegistry", addresses.ProjectRegistry, admin);
  const token = await ethers.getContractAt("CarbonCreditToken", addresses.CarbonCreditToken, admin);
  const certificate = await ethers.getContractAt(
    "RetirementCertificate",
    addresses.RetirementCertificate,
    admin
  );
  const marketplace = await ethers.getContractAt(
    "CarbonMarketplace",
    addresses.CarbonMarketplace,
    admin
  );

  console.log(`Seeding demo data on ${network.name} as ${admin.address}\n`);

  // ------------------------------------------------------------- projects
  const projectCount = await registry.projectCount();
  if (projectCount === 0n) {
    const projects = [
      [
        "Western Ghats Reforestation",
        "Karnataka, India",
        "Verra VM0047 v1.0 - Afforestation",
        12000,
        "western-ghats-methodology-2025.pdf",
      ],
      [
        "Sundarbans Mangrove Restoration",
        "West Bengal, India",
        "Gold Standard GS4.1 - Blue Carbon",
        8000,
        "sundarbans-blue-carbon-2025.pdf",
      ],
      [
        "Rajasthan Solar Cookstove Programme",
        "Rajasthan, India",
        "CDM AMS-II.G - Efficient Cookstoves",
        5000,
        "rajasthan-cookstove-2025.pdf",
      ],
      [
        "Coastal Wind Energy Cluster",
        "Gujarat, India",
        "Verra VCS ACM0002 - Grid-connected RE",
        20000,
        "gujarat-wind-2025.pdf",
      ],
      [
        "Himalayan Spring Water Conservation",
        "Uttarakhand, India",
        "Gold Standard GS5.1 - Water Benefit",
        3000,
        "himalaya-water-2025.pdf",
      ],
    ];

    for (let i = 0; i < projects.length; i++) {
      const [name, location, methodology, capacity, doc] = projects[i];
      const tx = await registry.registerProject(
        name,
        location,
        methodology,
        hash(doc),
        capacity
      );
      await tx.wait();
      console.log(`Project #${i + 1} registered: ${name}`);
    }

    for (let id = 1; id <= 4; id++) {
      const tx = await registry.verifyProject(id);
      await tx.wait();
      console.log(`Project #${id} verified`);
    }
  } else {
    console.log(`Projects already seeded (${projectCount}). Skipping registration.`);
  }

  // --------------------------------------------------------------- batches
  const batchCount = await token.batchCount();
  if (batchCount === 0n) {
    const batches = [
      { projectId: 1, vintage: 2025, tonnes: 1000, serial: "WG-2025-B001" },
      { projectId: 2, vintage: 2024, tonnes: 2500, serial: "SB-2024-B014" },
      { projectId: 3, vintage: 2025, tonnes: 800, serial: "RJ-2025-B007" },
      { projectId: 4, vintage: 2023, tonnes: 5000, serial: "GJ-2023-B021" },
    ];

    let nextId = 0n;
    for (const batch of batches) {
      nextId += 1n;
      const tx = await token.issueBatch(
        batch.projectId,
        batch.vintage,
        batch.tonnes,
        hash(batch.serial)
      );
      await tx.wait();
      console.log(`Batch #${nextId} issued (${batch.tonnes} tCO2e, vintage ${batch.vintage})`);
    }
  } else {
    console.log(`Batches already seeded (${batchCount}). Skipping issuance.`);
  }

  // ------------------------------------------------------------ retirements
  const retired = await token.totalRetiredTonnes();
  if (retired === 0n) {
    let tx = await token.retireCredits(
      1,
      150,
      admin.address,
      "Offsetting FY2024-25 business travel"
    );
    await tx.wait();
    console.log("Retired 150 tCO2e -> certificate for the deployer");

    tx = await token.retireCredits(
      2,
      400,
      DEMO_BENEFICIARY,
      "Product lifecycle neutrality claim 2025"
    );
    await tx.wait();
    console.log("Retired 400 tCO2e -> certificate for the demo beneficiary");
  } else {
    console.log(`Retirements already seeded (${retired} tCO2e). Skipping.`);
  }

  // ------------------------------------------------------------- marketplace
  const listingCount = await marketplace.listingCount();
  if (listingCount === 0n) {
    const approved = await token.isApprovedForAll(admin.address, addresses.CarbonMarketplace);
    if (!approved) {
      const tx = await token.setApprovalForAll(addresses.CarbonMarketplace, true);
      await tx.wait();
      console.log("Marketplace approved to escrow credits");
    }

    let tx = await marketplace.listCredits(4, 1200, ethers.parseEther("0.00035"));
    await tx.wait();
    console.log("Listed 1200 tCO2e of batch #4 at 0.00035 ETH / tonne");

    tx = await marketplace.listCredits(2, 600, ethers.parseEther("0.00048"));
    await tx.wait();
    console.log("Listed 600 tCO2e of batch #2 at 0.00048 ETH / tonne");
  } else {
    console.log(`Listings already seeded (${listingCount}). Skipping.`);
  }

  console.log("\nSeed complete. Summary:");
  console.log("  projects :", (await registry.projectCount()).toString());
  console.log("  batches  :", (await token.batchCount()).toString());
  console.log("  issued   :", (await token.totalIssuedTonnes()).toString(), "tCO2e");
  console.log("  retired  :", (await token.totalRetiredTonnes()).toString(), "tCO2e");
  console.log("  certs    :", (await certificate.certificateCount()).toString());
  console.log("  listings :", (await marketplace.listingCount()).toString());
  console.log("  admin    :", admin.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
