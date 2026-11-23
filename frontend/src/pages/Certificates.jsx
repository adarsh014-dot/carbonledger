import { useMemo, useState } from "react";
import {
  Award,
  ExternalLink,
  Flame,
  ShieldCheck,
  Sprout,
  Wallet,
} from "lucide-react";
import { useWallet } from "../context/WalletContext";
import { useQuery } from "../hooks/useQuery";
import {
  formatDate,
  formatNumber,
  shortAddress,
} from "../lib/format";
import { NETWORK } from "../lib/chain";
import {
  AddressChip,
  Badge,
  Button,
  Card,
  CopyButton,
  EmptyState,
  Modal,
  QueryError,
  Skeleton,
  Tabs,
} from "../components/ui";

const metadataCache = new Map();

function decodeBase64Json(dataUri) {
  const base64 = dataUri.split(",")[1];
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

async function loadMetadata(certificate, id) {
  const key = id.toString();
  if (metadataCache.has(key)) return metadataCache.get(key);
  try {
    const uri = await certificate.tokenURI(id);
    const metadata = decodeBase64Json(uri);
    metadataCache.set(key, metadata);
    return metadata;
  } catch {
    metadataCache.set(key, null);
    return null;
  }
}

export function Certificates() {
  const { contracts, account, connect } = useWallet();
  const [tab, setTab] = useState("all");
  const [selected, setSelected] = useState(null);

  const query = useQuery(async () => {
    const [[certificates], projectList, ownIds] = await Promise.all([
      contracts.certificate.getCertificates(0, 300),
      contracts.registry.getProjects(0, 500).then((result) => result[0]),
      account ? contracts.certificate.getCertificatesByOwner(account) : Promise.resolve([]),
    ]);

    const projectsById = new Map();
    projectList.forEach((project) => projectsById.set(project.id.toString(), project));

    const ownSet = new Set(ownIds.map((id) => id.toString()));
    const list = [...certificates].reverse();

    const enriched = await Promise.all(
      list.map(async (certificate) => {
        const [metadata, owner] = await Promise.all([
          loadMetadata(contracts.certificate, certificate.id),
          contracts.certificate.ownerOf(certificate.id).catch(() => null),
        ]);
        return {
          id: certificate.id,
          batchId: certificate.batchId,
          projectId: certificate.projectId,
          tonnes: certificate.tonnes,
          beneficiary: certificate.beneficiary,
          purpose: certificate.purpose,
          retiredAt: certificate.retiredAt,
          metadata,
          owner,
          mine: ownSet.has(certificate.id.toString()),
          project: projectsById.get(certificate.projectId.toString()) || null,
        };
      })
    );

    return { list: enriched, projectsById };
  }, [contracts, account]);

  const all = query.data?.list || [];
  const shown = tab === "mine" ? all.filter((certificate) => certificate.mine) : all;
  const totalTonnes = all.reduce((sum, certificate) => sum + Number(certificate.tonnes || 0), 0);

  const badgeTone = useMemo(() => (all.length ? "green" : "gray"), [all.length]);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Retirement certificates</h1>
          <p>
            Each retirement mints a soulbound ERC-721 certificate. Its artwork and metadata are
            generated fully on-chain, so the proof can never be edited or transferred.
          </p>
        </div>
        <div className="page-actions">
          <Badge tone={badgeTone} dot>
            {NETWORK.name}
          </Badge>
        </div>
      </div>

      <div className="grid grid-3">
        <Card className="stat">
          <div className="stat-top">
            <span className="stat-icon">
              <Award size={14} />
            </span>
            Certificates minted
          </div>
          <div className="stat-value">
            {formatNumber(all.length, 0)}
            <small>soulbound</small>
          </div>
          <div className="stat-foot">Non-transferable by contract design</div>
        </Card>
        <Card className="stat">
          <div className="stat-top">
            <span className="stat-icon">
              <Flame size={14} />
            </span>
            Tonnes certified
          </div>
          <div className="stat-value">
            {formatNumber(totalTonnes, 0)}
            <small>tCO2e</small>
          </div>
          <div className="stat-foot">Sum of every retirement certificate</div>
        </Card>
        <Card className="stat">
          <div className="stat-top">
            <span className="stat-icon">
              <Sprout size={14} />
            </span>
            Yours
          </div>
          <div className="stat-value">
            {formatNumber(all.filter((certificate) => certificate.mine).length, 0)}
            <small>certificates</small>
          </div>
          <div className="stat-foot">{account ? shortAddress(account) : "Connect to check"}</div>
        </Card>
      </div>

      <Card>
        <div className="card-head">
          <Tabs
            value={tab}
            onChange={setTab}
            options={[
              { value: "all", label: "All certificates", count: all.length },
              {
                value: "mine",
                label: "Mine",
                count: all.filter((certificate) => certificate.mine).length,
              },
            ]}
          />
          <div className="card-head-actions">
            <Badge tone="green">
              <ShieldCheck size={11} /> On-chain metadata
            </Badge>
          </div>
        </div>

        {query.error ? (
          <div className="card-pad">
            <QueryError error={query.error} />
          </div>
        ) : query.loading && !query.data ? (
          <div className="card-pad cert-grid">
            {[0, 1, 2].map((key) => (
              <Card key={key} style={{ overflow: "hidden" }}>
                <Skeleton height={180} style={{ borderRadius: 0 }} />
                <div className="cert-body stack" style={{ gap: 8 }}>
                  <Skeleton height={20} width="45%" />
                  <Skeleton height={10} width="80%" />
                </div>
              </Card>
            ))}
          </div>
        ) : shown.length === 0 ? (
          <EmptyState
            icon={tab === "mine" ? <Wallet size={20} /> : <Award size={20} />}
            title={tab === "mine" ? "No certificates yet" : "No retirements yet"}
            description={
              tab === "mine"
                ? "Retire credits from your portfolio and a soulbound certificate will be minted to the beneficiary."
                : "Certificates appear here as soon as credits are retired on-chain."
            }
            action={
              tab === "mine" && !account ? (
                <Button variant="primary" size="sm" onClick={connect}>
                  Connect wallet
                </Button>
              ) : null
            }
          />
        ) : (
          <div className="card-pad cert-grid">
            {shown.map((certificate) => (
              <Card
                key={certificate.id.toString()}
                className="cert-card"
                role="button"
                tabIndex={0}
                onClick={() => setSelected(certificate)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelected(certificate);
                  }
                }}
                aria-label={`Open certificate ${certificate.id}`}
              >
                {certificate.metadata?.image ? (
                  <img
                    className="cert-image"
                    src={certificate.metadata.image}
                    alt={`Carbon retirement certificate ${certificate.id}`}
                  />
                ) : (
                  <div className="cert-image" style={{ background: "#0b2a1f" }} />
                )}
                <div className="cert-body">
                  <div className="row between">
                    <span className="cert-tonnes">{formatNumber(certificate.tonnes, 0)} tCO2e</span>
                    {certificate.mine ? <Badge tone="lime">Yours</Badge> : null}
                  </div>
                  <div className="cert-purpose">
                    {certificate.purpose || "Permanent carbon retirement"}
                  </div>
                  <div className="row between small muted" style={{ marginTop: 8 }}>
                    <span>Certificate #{certificate.id.toString()}</span>
                    <span>{formatDate(certificate.retiredAt)}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={`Retirement certificate #${selected?.id ?? ""}`}
        subtitle="Soulbound ERC-721 · metadata and artwork generated on-chain"
        large
        footer={
          <>
            <Button variant="ghost" onClick={() => setSelected(null)}>
              Close
            </Button>
            {selected?.metadata ? (
              <CopyButton text={JSON.stringify(selected.metadata, null, 2)} label="Copy metadata" />
            ) : null}
            {NETWORK.explorer && selected ? (
              <a
                className="btn btn-secondary"
                href={`${NETWORK.explorer}/token/${contracts.certificate.target}?a=${selected.id}`}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={14} /> Explorer
              </a>
            ) : null}
          </>
        }
      >
        {selected ? (
          <>
            {selected.metadata?.image ? (
              <img
                src={selected.metadata.image}
                alt={`Certificate ${selected.id}`}
                style={{ width: "100%", borderRadius: 14, display: "block" }}
              />
            ) : null}
            <div>
              <div className="kv">
                <dt>Beneficiary</dt>
                <dd>
                  {selected.owner ? <AddressChip address={selected.owner} /> : "—"}
                </dd>
              </div>
              <div className="kv">
                <dt>Project</dt>
                <dd>{selected.project?.name || `Project #${selected.projectId}`}</dd>
              </div>
              <div className="kv">
                <dt>Batch</dt>
                <dd>#{selected.batchId.toString()}</dd>
              </div>
              <div className="kv">
                <dt>Tonnage</dt>
                <dd>{formatNumber(selected.tonnes, 0)} tCO2e</dd>
              </div>
              <div className="kv">
                <dt>Retired on</dt>
                <dd>{formatDate(selected.retiredAt)}</dd>
              </div>
              <div className="kv">
                <dt>Purpose</dt>
                <dd>{selected.purpose}</dd>
              </div>
              <div className="kv">
                <dt>Contract</dt>
                <dd>
                  <AddressChip address={contracts.certificate.target} />
                </dd>
              </div>
            </div>
          </>
        ) : null}
      </Modal>
    </div>
  );
}
