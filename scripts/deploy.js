const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const { ethers, network } = hre;
  const [deployer] = await ethers.getSigners();

  if (!deployer) {
    throw new Error(
      "No signer available. For Sepolia set PRIVATE_KEY in .env (see .env.example)."
    );
  }

  const treasury = process.env.TREASURY_ADDRESS || deployer.address;
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log("\n=== CarbonLedger deployment ===");
  console.log("Network     :", network.name, `(chainId ${network.config.chainId})`);
  console.log("Deployer    :", deployer.address);
  console.log("Balance     :", ethers.formatEther(balance), "ETH");
  console.log("Treasury    :", treasury);
  console.log("");

  if (balance === 0n) {
    throw new Error("Deployer has zero balance. Fund the account with Sepolia ETH first.");
  }

  const Registry = await ethers.getContractFactory("ProjectRegistry");
  const registry = await Registry.deploy(deployer.address);
  await registry.waitForDeployment();
  console.log("ProjectRegistry       :", await registry.getAddress());

  const Certificate = await ethers.getContractFactory("RetirementCertificate");
  const certificate = await Certificate.deploy(deployer.address);
  await certificate.waitForDeployment();
  console.log("RetirementCertificate :", await certificate.getAddress());

  const Token = await ethers.getContractFactory("CarbonCreditToken");
  const token = await Token.deploy(deployer.address, await registry.getAddress());
  await token.waitForDeployment();
  console.log("CarbonCreditToken     :", await token.getAddress());

  const Marketplace = await ethers.getContractFactory("CarbonMarketplace");
  const marketplace = await Marketplace.deploy(
    deployer.address,
    await token.getAddress(),
    treasury
  );
  await marketplace.waitForDeployment();
  console.log("CarbonMarketplace     :", await marketplace.getAddress());

  console.log("\nWiring roles and contracts...");

  const registryAddress = await registry.getAddress();
  const tokenAddress = await token.getAddress();
  const certificateAddress = await certificate.getAddress();

  let tx = await registry.grantRole(await registry.CREDIT_TOKEN_ROLE(), tokenAddress);
  await tx.wait();
  console.log("- registry.CREDIT_TOKEN_ROLE -> token");

  tx = await certificate.grantRole(await certificate.MINTER_ROLE(), tokenAddress);
  await tx.wait();
  console.log("- certificate.MINTER_ROLE -> token");

  tx = await token.setCertificateContract(certificateAddress);
  await tx.wait();
  console.log("- token.certificateContract -> certificate");

  // The deployer keeps MINTER_ROLE so the demo can issue batches immediately.
  // A dedicated issuer can be authorised with: token.grantRole(MINTER_ROLE, issuer).
  if (process.env.ISSUER_ADDRESS) {
    tx = await token.grantRole(await token.MINTER_ROLE(), process.env.ISSUER_ADDRESS);
    await tx.wait();
    console.log("- token.MINTER_ROLE ->", process.env.ISSUER_ADDRESS);
  }

  const blockNumber = await ethers.provider.getBlockNumber();

  const deployment = {
    network: network.name,
    chainId: Number(network.config.chainId),
    deployer: deployer.address,
    treasury,
    deployedAt: new Date().toISOString(),
    deploymentBlock: blockNumber,
    contracts: {
      ProjectRegistry: registryAddress,
      RetirementCertificate: certificateAddress,
      CarbonCreditToken: tokenAddress,
      CarbonMarketplace: await marketplace.getAddress(),
    },
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(deploymentsDir, { recursive: true });
  const file = path.join(deploymentsDir, `${network.name}.json`);
  fs.writeFileSync(file, JSON.stringify(deployment, null, 2));

  console.log("\nDeployment saved to", file);
  console.log("Next: npm run export   (copies ABIs + addresses into the frontend)\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
