import { formatEther } from "ethers";
import { DEPLOYMENT_BLOCK } from "./chain";
import { formatEth, formatNumber } from "./format";

const CHUNK_SIZE = 45_000;
const MAX_LOOKBACK = 200_000;
const blockTimeCache = new Map();

const EVENT_FILTERS = (contracts) => [
  [contracts.registry, contracts.registry.filters.ProjectRegistered()],
  [contracts.registry, contracts.registry.filters.ProjectVerified()],
  [contracts.registry, contracts.registry.filters.VerificationRevoked()],
  [contracts.token, contracts.token.filters.BatchIssued()],
  [contracts.token, contracts.token.filters.CreditsRetired()],
  [contracts.certificate, contracts.certificate.filters.CertificateMinted()],
  [contracts.marketplace, contracts.marketplace.filters.Listed()],
  [contracts.marketplace, contracts.marketplace.filters.Purchased()],
  [contracts.marketplace, contracts.marketplace.filters.ListingCancelled()],
];

async function collectLogs(contracts, provider) {
  const latest = await provider.getBlockNumber();
  // If no deployment block is configured, scan a bounded recent window instead of genesis.
  const from =
    DEPLOYMENT_BLOCK > 0
      ? Math.min(DEPLOYMENT_BLOCK, latest)
      : Math.max(0, latest - MAX_LOOKBACK);
  const logs = [];

  for (let start = from; start <= latest; start += CHUNK_SIZE) {
    const end = Math.min(start + CHUNK_SIZE - 1, latest);
    const results = await Promise.allSettled(
      EVENT_FILTERS(contracts).map(([contract, filter]) =>
        contract.queryFilter(filter, start, end)
      )
    );
    for (const result of results) {
      if (result.status === "fulfilled") logs.push(...result.value);
    }
  }

  return logs;
}

async function timestampFor(provider, blockNumber) {
  if (blockTimeCache.has(blockNumber)) return blockTimeCache.get(blockNumber);
  try {
    const block = await provider.getBlock(blockNumber);
    const timestamp = block ? block.timestamp : null;
    blockTimeCache.set(blockNumber, timestamp);
    return timestamp;
  } catch {
    return null;
  }
}

function normalise(log) {
  const name = log.fragment?.name;
  const args = log.args || {};
  const base = {
    blockNumber: log.blockNumber,
    logIndex: log.index ?? 0,
    txHash: log.transactionHash,
    contract: log.address,
  };

  switch (name) {
    case "ProjectRegistered":
      return {
        ...base,
        kind: "project",
        icon: "leaf",
        tone: "green",
        title: `Project #${args.projectId} registered`,
        detail: `${args.name}`,
        actor: args.developer,
      };
    case "ProjectVerified":
      return {
        ...base,
        kind: "verified",
        icon: "shield",
        tone: "lime",
        title: `Project #${args.projectId} verified`,
        detail: "Verification recorded on-chain",
        actor: args.verifier,
      };
    case "VerificationRevoked":
      return {
        ...base,
        kind: "verified",
        icon: "shieldOff",
        tone: "amber",
        title: `Project #${args.projectId} verification revoked`,
        detail: "Issuance disabled for this project",
        actor: args.verifier,
      };
    case "BatchIssued":
      return {
        ...base,
        kind: "batch",
        icon: "layers",
        tone: "green",
        title: `Batch #${args.batchId} issued`,
        detail: `${formatNumber(args.tonnes, 0)} tCO2e · vintage ${args.vintage}`,
        actor: args.issuer,
      };
    case "CreditsRetired":
      return {
        ...base,
        kind: "retired",
        icon: "flame",
        tone: "lime",
        title: `${formatNumber(args.tonnes, 0)} tCO2e retired`,
        detail: args.purpose,
        actor: args.beneficiary,
      };
    case "CertificateMinted":
      return {
        ...base,
        kind: "certificate",
        icon: "award",
        tone: "lime",
        title: `Certificate #${args.certificateId} minted`,
        detail: `${formatNumber(args.tonnes, 0)} tCO2e · soulbound proof`,
        actor: args.beneficiary,
      };
    case "Listed":
      return {
        ...base,
        kind: "market",
        icon: "tag",
        tone: "blue",
        title: `Listing #${args.listingId} created`,
        detail: `${formatNumber(args.amount, 0)} tCO2e at ${formatEth(formatEther(args.pricePerTonne))} ETH/t`,
        actor: args.seller,
      };
    case "Purchased":
      return {
        ...base,
        kind: "market",
        icon: "shoppingCart",
        tone: "blue",
        title: `Listing #${args.listingId} purchased`,
        detail: `${formatNumber(args.amount, 0)} tCO2e for ${formatEth(formatEther(args.totalPaid))} ETH`,
        actor: args.buyer,
      };
    case "ListingCancelled":
      return {
        ...base,
        kind: "market",
        icon: "xCircle",
        tone: "amber",
        title: `Listing #${args.listingId} cancelled`,
        detail: `${formatNumber(args.returned, 0)} tCO2e returned to seller`,
        actor: args.seller,
      };
    default:
      return null;
  }
}

export async function loadActivity(contracts, provider, { limit = 60 } = {}) {
  const logs = await collectLogs(contracts, provider);
  const seen = new Set();
  const events = [];

  for (const log of logs) {
    const key = `${log.transactionHash}-${log.index}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const event = normalise(log);
    if (event) events.push(event);
  }

  events.sort((a, b) => b.blockNumber - a.blockNumber || b.logIndex - a.logIndex);
  const sliced = events.slice(0, limit);

  const uniqueBlocks = [...new Set(sliced.map((event) => event.blockNumber))];
  const timestamps = new Map();
  await Promise.all(
    uniqueBlocks.map(async (blockNumber) => {
      timestamps.set(blockNumber, await timestampFor(provider, blockNumber));
    })
  );

  return sliced.map((event) => ({
    ...event,
    timestamp: timestamps.get(event.blockNumber) ?? null,
  }));
}
