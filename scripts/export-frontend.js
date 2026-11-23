const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const ARTIFACTS = path.join(ROOT, "artifacts", "contracts");
const DEPLOYMENTS = path.join(ROOT, "deployments");
const FRONTEND_CONTRACTS = path.join(ROOT, "frontend", "src", "contracts");

const CONTRACTS = [
  "ProjectRegistry",
  "CarbonCreditToken",
  "RetirementCertificate",
  "CarbonMarketplace",
];

const ZERO = "0x0000000000000000000000000000000000000000";

function findArtifact(name) {
  const candidates = fs
    .readdirSync(ARTIFACTS)
    .filter((dir) => dir.endsWith(".sol"))
    .map((dir) => path.join(ARTIFACTS, dir, `${name}.json`))
    .filter((file) => fs.existsSync(file));

  if (candidates.length === 0) {
    throw new Error(`Artifact not found for ${name}. Run "npm run compile" first.`);
  }
  return candidates[0];
}

function main() {
  if (!fs.existsSync(DEPLOYMENTS)) {
    fs.mkdirSync(DEPLOYMENTS, { recursive: true });
  }

  // Pick the best available deployment: sepolia > localhost.
  let deployment = null;
  for (const network of ["sepolia", "localhost", "hardhat"]) {
    const file = path.join(DEPLOYMENTS, `${network}.json`);
    if (fs.existsSync(file)) {
      deployment = JSON.parse(fs.readFileSync(file, "utf8"));
      break;
    }
  }

  fs.mkdirSync(path.join(FRONTEND_CONTRACTS, "abis"), { recursive: true });

  console.log("Exporting ABIs...");
  for (const name of CONTRACTS) {
    const artifact = JSON.parse(fs.readFileSync(findArtifact(name), "utf8"));
    fs.writeFileSync(
      path.join(FRONTEND_CONTRACTS, "abis", `${name}.json`),
      JSON.stringify(artifact.abi, null, 2)
    );
    console.log(`  - ${name} (${artifact.abi.length} ABI entries)`);
  }

  const addresses = {
    network: deployment ? deployment.network : "unconfigured",
    chainId: deployment ? deployment.chainId : 11155111,
    deploymentBlock: deployment ? deployment.deploymentBlock : 0,
    deployedAt: deployment ? deployment.deployedAt : null,
    ProjectRegistry: deployment ? deployment.contracts.ProjectRegistry : ZERO,
    CarbonCreditToken: deployment ? deployment.contracts.CarbonCreditToken : ZERO,
    RetirementCertificate: deployment ? deployment.contracts.RetirementCertificate : ZERO,
    CarbonMarketplace: deployment ? deployment.contracts.CarbonMarketplace : ZERO,
  };

  fs.writeFileSync(
    path.join(FRONTEND_CONTRACTS, "addresses.json"),
    JSON.stringify(addresses, null, 2)
  );

  console.log(
    deployment
      ? `\nAddresses exported from deployments/${deployment.network}.json`
      : "\nNo deployment found - exported zero addresses. Deploy, then run this script again."
  );
}

main();
