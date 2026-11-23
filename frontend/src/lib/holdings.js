import { DEPLOYMENT_BLOCK } from "./chain";

/**
 * ERC-1155 has no on-chain enumeration, so we derive a holder's batch ids from
 * TransferSingle logs, then read live balances. Fine for a demo-sized registry.
 */
export async function loadHoldings(contracts, provider, account) {
  if (!account) return [];

  const [incoming, outgoing] = await Promise.all([
    contracts.token.queryFilter(
      contracts.token.filters.TransferSingle(null, null, account),
      DEPLOYMENT_BLOCK
    ),
    contracts.token.queryFilter(
      contracts.token.filters.TransferSingle(null, account, null),
      DEPLOYMENT_BLOCK
    ),
  ]);

  const ids = new Set();
  for (const log of [...incoming, ...outgoing]) {
    if (log.args?.id !== undefined) ids.add(log.args.id.toString());
  }

  const projectCache = new Map();
  const rows = [];

  for (const id of ids) {
    const balance = await contracts.token.balanceOf(account, id);
    const batch = await contracts.token.getBatch(id);

    let project = projectCache.get(batch.projectId.toString());
    if (!project) {
      try {
        project = await contracts.registry.getProject(batch.projectId);
        projectCache.set(batch.projectId.toString(), project);
      } catch {
        project = null;
      }
    }

    rows.push({
      id: BigInt(id),
      balance,
      batch,
      project,
    });
  }

  return rows.sort((a, b) => Number(b.id - a.id));
}
