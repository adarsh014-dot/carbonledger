const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const { network, run } = hre;
  const file = path.join(__dirname, "..", "deployments", `${network.name}.json`);

  if (!fs.existsSync(file)) {
    throw new Error(`No deployment file for ${network.name}. Deploy first.`);
  }

  const deployment = JSON.parse(fs.readFileSync(file, "utf8"));
  const { contracts, deployer, treasury } = deployment;

  const targets = [
    { name: "ProjectRegistry", address: contracts.ProjectRegistry, args: [deployer] },
    { name: "RetirementCertificate", address: contracts.RetirementCertificate, args: [deployer] },
    {
      name: "CarbonCreditToken",
      address: contracts.CarbonCreditToken,
      args: [deployer, contracts.ProjectRegistry],
    },
    {
      name: "CarbonMarketplace",
      address: contracts.CarbonMarketplace,
      args: [deployer, contracts.CarbonCreditToken, treasury],
    },
  ];

  for (const target of targets) {
    console.log(`\nVerifying ${target.name} at ${target.address} ...`);
    try {
      await run("verify:verify", {
        address: target.address,
        constructorArguments: target.args,
      });
      console.log(`${target.name} verified.`);
    } catch (error) {
      const message = error.message || String(error);
      if (/already verified/i.test(message)) {
        console.log(`${target.name} is already verified.`);
      } else {
        console.error(`${target.name} verification failed:`, message);
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
