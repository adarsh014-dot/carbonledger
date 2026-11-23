/**
 * Generates single-file, dependency-free versions of each contract for Remix IDE.
 *
 * Remix does not always resolve bare npm imports such as
 *   import {AccessControl} from "@openzeppelin/contracts/...";
 * so we flatten everything into remix/*.sol. Paste each file into Remix in the
 * order documented in README.md (Remix section).
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "remix");

const FILES = [
  "ProjectRegistry",
  "RetirementCertificate",
  "CarbonCreditToken",
  "CarbonMarketplace",
];

fs.mkdirSync(OUT, { recursive: true });

for (const name of FILES) {
  const output = execSync(
    `npx hardhat flatten contracts/${name}.sol`,
    { cwd: ROOT, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 }
  );

  const clean = output.replace(/\/\/ SPDX-License-Identifier:.*\n/g, "");
  const header =
    "// SPDX-License-Identifier: MIT\n" +
    `// Flattened by scripts/flatten.js for Remix IDE - contract: ${name}\n` +
    "// Compile with Solidity 0.8.24, EVM version: cancun, optimizer ON (200 runs)\n\n";

  fs.writeFileSync(path.join(OUT, `${name}.sol`), header + clean);
  console.log(`remix/${name}.sol`);
}

console.log("\nFlattened Remix contracts written to remix/");
