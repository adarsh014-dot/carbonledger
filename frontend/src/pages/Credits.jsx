import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Flame,
  Layers,
  Plus,
  Tag,
  Wallet,
} from "lucide-react";
import { keccak256, parseEther, toUtf8Bytes } from "ethers";
import { useWallet } from "../context/WalletContext";
import { useQuery } from "../hooks/useQuery";
import { useRoles } from "../hooks/useRoles";
import { useTx } from "../hooks/useTx";
import { loadHoldings } from "../lib/holdings";
import { formatNumber, shortAddress } from "../lib/format";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Modal,
  Progress,
  QueryError,
  RoleNote,
  Skeleton,
  Tabs,
} from "../components/ui";

const currentYear = new Date().getFullYear();

export function Credits({ prefillProjectId, clearPrefill }) {
  const { contracts, readProvider, account, connect } = useWallet();
  const roles = useRoles();
  const { send } = useTx();

  const [tab, setTab] = useState("portfolio");
  const [issueOpen, setIssueOpen] = useState(false);
  const [retireRow, setRetireRow] = useState(null);
  const [sellRow, setSellRow] = useState(null);

  const projectsQuery = useQuery(async () => {
    const [list] = await contracts.registry.getProjects(0, 500);
    return list;
  }, [contracts]);

  const batchesQuery = useQuery(async () => {
    const [list] = await contracts.token.getBatches(0, 500);
    return [...list].reverse();
  }, [contracts]);

  const holdingsQuery = useQuery(
    () => loadHoldings(contracts, readProvider, account),
    [contracts, readProvider, account],
    { enabled: Boolean(account) }
  );

  const projectsById = useMemo(() => {
    const map = new Map();
    (projectsQuery.data || []).forEach((project) => map.set(project.id.toString(), project));
    return map;
  }, [projectsQuery.data]);

  const verifiedProjects = (projectsQuery.data || []).filter((project) => project.verified);

  // ------------------------------------------------------------ issue form
  const [issue, setIssue] = useState({
    projectId: "",
    vintage: String(currentYear),
    tonnes: "",
    serial: "",
  });
  const [issueBusy, setIssueBusy] = useState(false);

  useEffect(() => {
    if (!prefillProjectId) return;
    setIssue((prev) => ({ ...prev, projectId: prefillProjectId }));
    setIssueOpen(true);
    clearPrefill?.();
  }, [prefillProjectId, clearPrefill]);

  const issueProject = issue.projectId ? projectsById.get(issue.projectId) : null;
  const issueRemaining = issueProject
    ? Number(issueProject.annualCapacityTonnes) - Number(issueProject.issuedTonnes)
    : 0;
  const issueHash = issue.serial ? keccak256(toUtf8Bytes(issue.serial)) : "";
  const issueValid =
    Boolean(issue.projectId) &&
    Number(issue.vintage) >= 1990 &&
    Number(issue.vintage) <= 2100 &&
    Number(issue.tonnes) > 0 &&
    Number(issue.tonnes) <= issueRemaining &&
    Boolean(issue.serial) &&
    !issueBusy;

  const issueCredits = async () => {
    setIssueBusy(true);
    try {
      await send(
        () =>
          contracts.token.issueBatch(
            BigInt(issue.projectId),
            Number(issue.vintage),
            BigInt(Math.floor(Number(issue.tonnes))),
            issueHash
          ),
        {
          pending: "Issuing credit batch…",
          success: "Batch issued and credited to your wallet",
        }
      );
      setIssueOpen(false);
      setIssue({ projectId: "", vintage: String(currentYear), tonnes: "", serial: "" });
    } catch {
      /* toast shown */
    } finally {
      setIssueBusy(false);
    }
  };

  // ----------------------------------------------------------- retire form
  const [retire, setRetire] = useState({ tonnes: "", beneficiary: "", purpose: "" });
  const [retireBusy, setRetireBusy] = useState(false);

  useEffect(() => {
    if (!retireRow) return;
    setRetire({ tonnes: "", beneficiary: account || "", purpose: "" });
  }, [retireRow, account]);

  const retireValid =
    retireRow &&
    Number(retire.tonnes) > 0 &&
    Number(retire.tonnes) <= Number(retireRow.balance) &&
    /^0x[a-fA-F0-9]{40}$/.test(retire.beneficiary) &&
    retire.purpose.trim().length >= 3 &&
    !retireBusy;

  const retireCredits = async () => {
    setRetireBusy(true);
    try {
      await send(
        () =>
          contracts.token.retireCredits(
            retireRow.id,
            BigInt(Math.floor(Number(retire.tonnes))),
            retire.beneficiary,
            retire.purpose.trim()
          ),
        {
          pending: "Retiring credits (burning)…",
          success: "Credits retired - soulbound certificate minted",
        }
      );
      setRetireRow(null);
    } catch {
      /* toast shown */
    } finally {
      setRetireBusy(false);
    }
  };

  // ------------------------------------------------------------- sell form
  const [sell, setSell] = useState({ amount: "", price: "" });
  const [sellBusy, setSellBusy] = useState(false);

  useEffect(() => {
    if (sellRow) setSell({ amount: "", price: "" });
  }, [sellRow]);

  const sellTotal =
    Number(sell.amount) > 0 && Number(sell.price) > 0
      ? (Number(sell.amount) * Number(sell.price)).toFixed(6)
      : "0";

  const sellValid =
    sellRow &&
    Number(sell.amount) > 0 &&
    Number(sell.amount) <= Number(sellRow.balance) &&
    Number(sell.price) > 0 &&
    !sellBusy;

  const listCredits = async () => {
    setSellBusy(true);
    try {
      const marketplaceAddress = contracts.marketplace.target;
      const approved = await contracts.token.isApprovedForAll(account, marketplaceAddress);
      if (!approved) {
        await send(
          () => contracts.token.setApprovalForAll(marketplaceAddress, true),
          {
            pending: "Approving marketplace to move credits…",
            success: "Marketplace approved",
          }
        );
      }
      await send(
        () =>
          contracts.marketplace.listCredits(
            sellRow.id,
            BigInt(Math.floor(Number(sell.amount))),
            parseEther(sell.price)
          ),
        {
          pending: "Escrowing credits and creating listing…",
          success: "Credits listed on the marketplace",
        }
      );
      setSellRow(null);
    } catch {
      /* toast shown */
    } finally {
      setSellBusy(false);
    }
  };

  const rows = holdingsQuery.data || [];
  const totalHeld = rows.reduce((sum, row) => sum + row.balance, 0n);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Credits</h1>
          <p>
            Credits are ERC-1155 batches measured in tonnes of CO2e. Retiring burns them
            permanently and mints a non-transferable certificate.
          </p>
        </div>
        <div className="page-actions">
          {roles.minter ? (
            <Button variant="primary" icon={<Plus size={15} />} onClick={() => setIssueOpen(true)}>
              Issue batch
            </Button>
          ) : (
            <Badge tone="gray">Issuer role required to mint</Badge>
          )}
        </div>
      </div>

      <div className="grid grid-3">
        <Card className="stat">
          <div className="stat-top">
            <span className="stat-icon">
              <Layers size={14} />
            </span>
            Your balance
          </div>
          <div className="stat-value">
            {formatNumber(totalHeld, 0)}
            <small>tCO2e</small>
          </div>
          <div className="stat-foot">{rows.length} batch{rows.length === 1 ? "" : "es"} held</div>
        </Card>
        <Card className="stat">
          <div className="stat-top">
            <span className="stat-icon">
              <Flame size={14} />
            </span>
            Retired by you
          </div>
          <div className="stat-value">
            {formatNumber(
              rows.reduce((sum, row) => sum + row.batch.retiredTonnes, 0n),
              0
            )}
            <small>tCO2e</small>
          </div>
          <div className="stat-foot">Across your current batches</div>
        </Card>
        <Card className="stat">
          <div className="stat-top">
            <span className="stat-icon">
              <Tag size={14} />
            </span>
            Batches circulating
          </div>
          <div className="stat-value">
            {formatNumber(batchesQuery.data?.length || 0, 0)}
            <small>batches</small>
          </div>
          <div className="stat-foot">Public registry supply</div>
        </Card>
      </div>

      <Card>
        <div className="card-head">
          <Tabs
            value={tab}
            onChange={setTab}
            options={[
              { value: "portfolio", label: "My portfolio", count: rows.length },
              { value: "all", label: "All batches", count: batchesQuery.data?.length || 0 },
            ]}
          />
        </div>

        {tab === "portfolio" ? (
          !account ? (
            <div className="card-pad">
              <EmptyState
                icon={<Wallet size={20} />}
                title="Connect your wallet"
                description="Your credit holdings are derived from on-chain transfers and read directly from the contract."
                action={
                  <Button variant="primary" size="sm" onClick={connect}>
                    Connect wallet
                  </Button>
                }
              />
            </div>
          ) : holdingsQuery.error ? (
            <div className="card-pad">
              <QueryError error={holdingsQuery.error} />
            </div>
          ) : holdingsQuery.loading && !holdingsQuery.data ? (
            <div className="card-pad stack" style={{ gap: 10 }}>
              <Skeleton height={38} />
              <Skeleton height={38} />
              <Skeleton height={38} />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<Layers size={20} />}
              title="No credits yet"
              description="Buy credits from the marketplace to build a portfolio you can retire or resell."
              action={
                <Button size="sm" variant="primary" onClick={() => setTab("all")}>
                  Browse all batches
                </Button>
              }
            />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Batch</th>
                    <th>Project</th>
                    <th>Vintage</th>
                    <th className="td-right">Balance</th>
                    <th className="td-right">Batch retired</th>
                    <th>Serial</th>
                    <th className="td-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const project = projectsById.get(row.batch.projectId.toString());
                    return (
                      <tr key={row.id.toString()}>
                        <td className="td-strong">#{row.id.toString()}</td>
                        <td>
                          <div className="td-strong">{project?.name || `Project #${row.batch.projectId}`}</div>
                          <div className="small muted">
                            {project?.location || "—"}
                          </div>
                        </td>
                        <td>{row.batch.vintage.toString()}</td>
                        <td className="td-right td-strong tnum">
                          {formatNumber(row.balance, 0)} t
                        </td>
                        <td className="td-right tnum">
                          {formatNumber(row.batch.retiredTonnes, 0)} t
                        </td>
                        <td>
                          <span className="mono small" title={row.batch.serialHash}>
                            {shortAddress(row.batch.serialHash, 6)}
                          </span>
                        </td>
                        <td className="td-right">
                          <div className="row" style={{ justifyContent: "flex-end", gap: 6 }}>
                            <Button
                              size="xs"
                              variant="secondary"
                              icon={<Flame size={12} />}
                              onClick={() => setRetireRow(row)}
                            >
                              Retire
                            </Button>
                            <Button
                              size="xs"
                              variant="ghost"
                              icon={<Tag size={12} />}
                              onClick={() => setSellRow(row)}
                            >
                              Sell
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : batchesQuery.error ? (
          <div className="card-pad">
            <QueryError error={batchesQuery.error} />
          </div>
        ) : batchesQuery.loading && !batchesQuery.data ? (
          <div className="card-pad stack" style={{ gap: 10 }}>
            <Skeleton height={38} />
            <Skeleton height={38} />
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>Project</th>
                  <th>Vintage</th>
                  <th className="td-right">Issued</th>
                  <th className="td-right">Retired</th>
                  <th>Issuer</th>
                  <th>Progress</th>
                </tr>
              </thead>
              <tbody>
                {(batchesQuery.data || []).map((batch) => {
                  const project = projectsById.get(batch.projectId.toString());
                  const retiredPercent = Number(batch.tonnes)
                    ? (Number(batch.retiredTonnes) / Number(batch.tonnes)) * 100
                    : 0;
                  return (
                    <tr key={batch.id.toString()}>
                      <td className="td-strong">#{batch.id.toString()}</td>
                      <td>{project?.name || `Project #${batch.projectId}`}</td>
                      <td>{batch.vintage.toString()}</td>
                      <td className="td-right tnum">{formatNumber(batch.tonnes, 0)} t</td>
                      <td className="td-right tnum">{formatNumber(batch.retiredTonnes, 0)} t</td>
                      <td className="mono small">{shortAddress(batch.issuer)}</td>
                      <td style={{ minWidth: 130 }}>
                        <Progress value={retiredPercent} lime />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {roles.minter ? (
        <RoleNote>
          As an <strong>issuer</strong>, new batches are minted to your wallet. The registry
          enforces each project's annual capacity on-chain, so over-issuance reverts automatically.
        </RoleNote>
      ) : null}

      {/* ------------------------------------------------------- issue modal */}
      <Modal
        open={issueOpen}
        onClose={() => setIssueOpen(false)}
        title="Issue a credit batch"
        subtitle="Only verified projects can issue, and never beyond their annual capacity."
        footer={
          <>
            <Button variant="ghost" onClick={() => setIssueOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={issueBusy} disabled={!issueValid} onClick={issueCredits}>
              Mint batch
            </Button>
          </>
        }
      >
        {verifiedProjects.length === 0 ? (
          <RoleNote warn icon={<AlertTriangle size={15} />}>
            No verified projects yet. Verify a project first, then come back to issue credits.
            <div style={{ marginTop: 8 }}>
              <a href="#projects" onClick={(event) => event.preventDefault()}>
                Open the Projects page from the sidebar.
              </a>
            </div>
          </RoleNote>
        ) : (
          <div className="form-grid">
            <div className="full">
              <Field
                label="Verified project"
                hint={
                  issueProject
                    ? `${formatNumber(issueRemaining, 0)} tCO2e of annual capacity remaining`
                    : "Only verified + active projects can issue credits"
                }
              >
                <select
                  className="select"
                  value={issue.projectId}
                  onChange={(event) => setIssue({ ...issue, projectId: event.target.value })}
                >
                  <option value="">Select a project…</option>
                  {verifiedProjects.map((project) => (
                    <option key={project.id.toString()} value={project.id.toString()}>
                      #{project.id.toString()} - {project.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Vintage year">
              <input
                className="input"
                type="number"
                min="1990"
                max="2100"
                value={issue.vintage}
                onChange={(event) => setIssue({ ...issue, vintage: event.target.value })}
              />
            </Field>
            <Field label="Tonnage (tCO2e)">
              <input
                className="input"
                type="number"
                min="1"
                max={issueRemaining || undefined}
                value={issue.tonnes}
                onChange={(event) => setIssue({ ...issue, tonnes: event.target.value })}
                placeholder="1000"
              />
            </Field>
            <div className="full">
              <Field
                label="Batch serial reference"
                hint={
                  issueHash
                    ? `keccak256: ${issueHash.slice(0, 18)}…${issueHash.slice(-8)}`
                    : "A unique reference for this batch (hashed before it is stored)."
                }
              >
                <input
                  className="input"
                  value={issue.serial}
                  onChange={(event) => setIssue({ ...issue, serial: event.target.value })}
                  placeholder="WG-2025-B001"
                />
              </Field>
            </div>
            {Number(issue.tonnes) > issueRemaining && issueProject ? (
              <div className="full">
                <RoleNote warn icon={<AlertTriangle size={15} />}>
                  This exceeds the project's remaining annual capacity ({formatNumber(issueRemaining, 0)} t).
                  The transaction would revert.
                </RoleNote>
              </div>
            ) : null}
          </div>
        )}
      </Modal>

      {/* ------------------------------------------------------ retire modal */}
      <Modal
        open={Boolean(retireRow)}
        onClose={() => setRetireRow(null)}
        title="Retire credits"
        subtitle="Retirement is permanent: credits are burned and cannot be re-issued or resold."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRetireRow(null)}>
              Cancel
            </Button>
            <Button variant="primary" loading={retireBusy} disabled={!retireValid} onClick={retireCredits}>
              Burn & mint certificate
            </Button>
          </>
        }
      >
        {retireRow ? (
          <div className="form-grid">
            <div className="full">
              <div className="hero-strip">
                <Layers size={14} />
                Batch #{retireRow.id.toString()} ·{" "}
                {projectsById.get(retireRow.batch.projectId.toString())?.name || "Unknown project"} ·
                available <strong>{formatNumber(retireRow.balance, 0)} tCO2e</strong>
              </div>
            </div>
            <Field label="Tonnage to retire">
              <input
                className="input"
                type="number"
                min="1"
                max={Number(retireRow.balance)}
                value={retire.tonnes}
                onChange={(event) => setRetire({ ...retire, tonnes: event.target.value })}
                placeholder="100"
              />
            </Field>
            <Field label="Beneficiary address" hint="Receives the soulbound certificate">
              <input
                className="input mono"
                value={retire.beneficiary}
                onChange={(event) => setRetire({ ...retire, beneficiary: event.target.value })}
                placeholder="0x…"
              />
            </Field>
            <div className="full">
              <Field
                label="Purpose / retirement claim"
                hint="Stored on-chain and shown on the certificate."
              >
                <textarea
                  className="textarea"
                  value={retire.purpose}
                  onChange={(event) => setRetire({ ...retire, purpose: event.target.value })}
                  placeholder="Offsetting FY2025 business travel"
                  maxLength={140}
                />
              </Field>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* -------------------------------------------------------- sell modal */}
      <Modal
        open={Boolean(sellRow)}
        onClose={() => setSellRow(null)}
        title="List credits for sale"
        subtitle="Credits move into marketplace escrow until sold or cancelled."
        footer={
          <>
            <Button variant="ghost" onClick={() => setSellRow(null)}>
              Cancel
            </Button>
            <Button variant="primary" loading={sellBusy} disabled={!sellValid} onClick={listCredits}>
              List on marketplace
            </Button>
          </>
        }
      >
        {sellRow ? (
          <div className="form-grid">
            <div className="full">
              <div className="hero-strip">
                <Tag size={14} />
                Batch #{sellRow.id.toString()} · available{" "}
                <strong>{formatNumber(sellRow.balance, 0)} tCO2e</strong>
              </div>
            </div>
            <Field label="Amount (tCO2e)">
              <input
                className="input"
                type="number"
                min="1"
                max={Number(sellRow.balance)}
                value={sell.amount}
                onChange={(event) => setSell({ ...sell, amount: event.target.value })}
                placeholder="500"
              />
            </Field>
            <Field label="Price per tonne (ETH)">
              <input
                className="input"
                type="number"
                min="0"
                step="0.000001"
                value={sell.price}
                onChange={(event) => setSell({ ...sell, price: event.target.value })}
                placeholder="0.0004"
              />
            </Field>
            <div className="full">
              <div className="kv">
                <dt>Total listing value</dt>
                <dd>{sellTotal} ETH</dd>
              </div>
              <div className="kv">
                <dt>Marketplace fee (2.5%)</dt>
                <dd>Deducted from sale proceeds</dd>
              </div>
            </div>
            {!sellValid && Number(sell.amount) > Number(sellRow.balance) ? (
              <div className="full">
                <RoleNote warn icon={<AlertTriangle size={15} />}>
                  Amount exceeds your balance for this batch.
                </RoleNote>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
