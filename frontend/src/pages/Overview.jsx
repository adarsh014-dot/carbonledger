import {
  ArrowRight,
  Award,
  Layers,
  Leaf,
  ShieldCheck,
  Store,
  Wallet,
  TrendingUp,
  Activity as ActivityIcon,
  FileKey2,
} from "lucide-react";
import { formatEther } from "ethers";
import { useWallet } from "../context/WalletContext";
import { useQuery } from "../hooks/useQuery";
import { useRoles } from "../hooks/useRoles";
import { loadActivity } from "../lib/events";
import { loadHoldings } from "../lib/holdings";
import { formatEth, formatNumber, formatTonnes, percent, shortAddress, timeAgo } from "../lib/format";
import { CONTRACT_ADDRESSES, NETWORK } from "../lib/chain";
import { ActivityList } from "../components/ActivityList";
import {
  AddressChip,
  Badge,
  Button,
  Card,
  Progress,
  QueryError,
  RoleNote,
  Skeleton,
  StatCard,
} from "../components/ui";

export function Overview({ onNavigate }) {
  const { contracts, readProvider, account, connect } = useWallet();
  const roles = useRoles();

  const stats = useQuery(async () => {
    const [
      projectCount,
      verifiedCount,
      issued,
      retired,
      batchCount,
      certificateCount,
      listingCount,
      activeListings,
      feeBps,
    ] = await Promise.all([
      contracts.registry.projectCount(),
      contracts.registry.getVerifiedProjectCount(),
      contracts.token.totalIssuedTonnes(),
      contracts.token.totalRetiredTonnes(),
      contracts.token.batchCount(),
      contracts.certificate.certificateCount(),
      contracts.marketplace.listingCount(),
      contracts.marketplace.activeListingCount(),
      contracts.marketplace.feeBps(),
    ]);

    return {
      projectCount,
      verifiedCount,
      issued,
      retired,
      batchCount,
      certificateCount,
      listingCount,
      activeListings,
      feeBps,
    };
  }, [contracts]);

  const position = useQuery(
    async () => {
      const [holdings, certificates, proceeds] = await Promise.all([
        loadHoldings(contracts, readProvider, account),
        contracts.certificate.getCertificatesByOwner(account),
        contracts.marketplace.proceeds(account),
      ]);
      const tonnes = holdings.reduce((sum, row) => sum + row.balance, 0n);
      return { tonnes, batchCount: holdings.length, certificates: certificates.length, proceeds };
    },
    [contracts, account, readProvider],
    { enabled: Boolean(account) }
  );

  const activity = useQuery(
    () => loadActivity(contracts, readProvider, { limit: 7 }),
    [contracts, readProvider]
  );

  const data = stats.data;
  const retirementRate = data ? percent(data.retired, data.issued) : 0;
  const verificationRate = data ? percent(data.verifiedCount, data.projectCount) : 0;
  const pending = data ? Number(data.projectCount) - Number(data.verifiedCount) : 0;

  return (
    <div className="stack">
      <section className="hero">
        <div>
          <div className="eyebrow">Verified carbon, permanently retired</div>
          <h2>Every tonne, accounted for on-chain.</h2>
          <p>
            CarbonLedger issues carbon credits as ERC-1155 batches against verified projects,
            lets companies trade them on a non-custodial marketplace, and burns them forever
            when retired - minting a soulbound certificate as proof.
          </p>
          <div className="hero-actions">
            <Button variant="lime" onClick={() => onNavigate("marketplace")} icon={<Store size={15} />}>
              Explore marketplace
            </Button>
            <Button
              variant="secondary"
              onClick={() => onNavigate("credits")}
              icon={<Layers size={15} />}
              style={{ background: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.18)", color: "#eaf5ee" }}
            >
              Retire credits
            </Button>
          </div>
        </div>

        <div className="hero-panel">
          <div className="row between">
            <span className="hero-panel-label">Retirement rate</span>
            <span className="verified-chip">
              <ShieldCheck size={12} /> on-chain
            </span>
          </div>
          <div className="hero-panel-value">
            {data ? retirementRate.toFixed(1) : "—"}
            <span>%</span>
          </div>
          <div className="hero-meter">
            <div style={{ width: `${retirementRate}%` }} />
          </div>
          <div className="hero-mini">
            <span>{data ? formatNumber(data.retired, 0) : "—"} t retired</span>
            <span>{data ? formatNumber(data.issued, 0) : "—"} t issued</span>
          </div>
        </div>
      </section>

      {stats.error ? <QueryError error={stats.error} /> : null}

      <section className="grid grid-4">
        {stats.loading && !data
          ? [0, 1, 2, 3].map((key) => (
              <Card key={key} className="stat">
                <Skeleton height={28} width={28} style={{ borderRadius: 8 }} />
                <Skeleton height={26} width="55%" />
                <Skeleton height={10} width="70%" />
              </Card>
            ))
          : data && (
              <>
                <StatCard
                  label="Verified projects"
                  value={formatNumber(data.verifiedCount, 0)}
                  unit={`of ${formatNumber(data.projectCount, 0)}`}
                  icon={<Leaf size={14} />}
                  foot={`${pending.toString()} awaiting verification`}
                />
                <StatCard
                  label="Credits issued"
                  value={formatNumber(data.issued, 0)}
                  unit="tCO2e"
                  icon={<Layers size={14} />}
                  foot={`${formatNumber(data.batchCount, 0)} batches on-chain`}
                />
                <StatCard
                  label="Permanently retired"
                  value={formatNumber(data.retired, 0)}
                  unit="tCO2e"
                  icon={<TrendingUp size={14} />}
                  foot={`${formatNumber(data.certificateCount, 0)} soulbound certificates`}
                />
                <StatCard
                  label="Active listings"
                  value={formatNumber(data.activeListings, 0)}
                  unit={`/ ${formatNumber(data.listingCount, 0)}`}
                  icon={<Store size={14} />}
                  foot={`Marketplace fee ${Number(data.feeBps) / 100}%`}
                />
              </>
            )}
      </section>

      <div className="split">
        <Card>
          <div className="card-head">
            <div>
              <h3>Recent on-chain activity</h3>
              <div className="sub">Live events from the registry, marketplace and certificates</div>
            </div>
            <div className="card-head-actions">
              <Button size="sm" variant="ghost" onClick={() => onNavigate("activity")}>
                View all <ArrowRight size={13} />
              </Button>
            </div>
          </div>
          {activity.error ? (
            <div style={{ padding: 20 }}>
              <QueryError error={activity.error} />
            </div>
          ) : (
            <ActivityList
              events={activity.data || []}
              loading={activity.loading}
              emptyText="Deploy and register a project to see the first event."
            />
          )}
        </Card>

        <div className="stack">
          <Card>
            <div className="card-head">
              <div>
                <h3>Your position</h3>
                <div className="sub">
                  {account ? shortAddress(account) : "Connect a wallet to view holdings"}
                </div>
              </div>
              {account ? <Badge tone="green" dot>{shortAddress(account, 3)}</Badge> : null}
            </div>
            <div className="card-pad stack" style={{ gap: 14 }}>
              {!account ? (
                <>
                  <p className="small muted">
                    Connect MetaMask to see the credits you hold, your retirement certificates and
                    any sale proceeds waiting to be withdrawn.
                  </p>
                  <Button variant="primary" icon={<Wallet size={15} />} onClick={connect}>
                    Connect wallet
                  </Button>
                </>
              ) : position.error ? (
                <QueryError error={position.error} />
              ) : !position.data ? (
                <div className="stack" style={{ gap: 10 }}>
                  <Skeleton height={40} />
                  <Skeleton height={40} />
                </div>
              ) : (
                <>
                  <div className="row between">
                    <span className="small muted">Credits held</span>
                    <strong className="tnum">
                      {formatTonnes(position.data.tonnes)} tCO2e
                    </strong>
                  </div>
                  <div className="row between">
                    <span className="small muted">Batches</span>
                    <strong className="tnum">{position.data.batchCount}</strong>
                  </div>
                  <div className="row between">
                    <span className="small muted">Certificates owned</span>
                    <strong className="tnum">{position.data.certificates}</strong>
                  </div>
                  <div className="row between">
                    <span className="small muted">Sale proceeds</span>
                    <strong className="tnum">
                      {formatEth(formatEther(position.data.proceeds), 5)} ETH
                    </strong>
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <Button size="sm" variant="secondary" onClick={() => onNavigate("credits")}>
                      Portfolio
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onNavigate("marketplace")}>
                      Withdraw
                    </Button>
                  </div>
                </>
              )}
            </div>
          </Card>

          <Card>
            <div className="card-head">
              <div>
                <h3>Registry health</h3>
                <div className="sub">Verification and retirement coverage</div>
              </div>
              <ActivityIcon size={16} className="muted" />
            </div>
            <div className="card-pad stack" style={{ gap: 16 }}>
              <div>
                <div className="row between small" style={{ marginBottom: 6 }}>
                  <span className="muted">Projects verified</span>
                  <strong>{verificationRate.toFixed(0)}%</strong>
                </div>
                <Progress value={verificationRate} />
              </div>
              <div>
                <div className="row between small" style={{ marginBottom: 6 }}>
                  <span className="muted">Issued credits retired</span>
                  <strong>{retirementRate.toFixed(1)}%</strong>
                </div>
                <Progress value={retirementRate} lime />
              </div>
              <div className="row-wrap row" style={{ gap: 6 }}>
                {roles.admin ? <Badge tone="green">Admin</Badge> : null}
                {roles.verifier ? <Badge tone="blue">Verifier</Badge> : null}
                {roles.minter ? <Badge tone="lime">Issuer</Badge> : null}
                {account && !roles.admin && !roles.verifier && !roles.minter ? (
                  <Badge tone="gray">Viewer</Badge>
                ) : null}
              </div>
            </div>
          </Card>

          {!roles.loading && !roles.admin && !roles.verifier && account ? (
            <RoleNote>
              You are connected as a <strong>viewer</strong>. You can hold, retire and trade
              credits. Project verification and batch issuance require an on-chain role, which an
              administrator can grant from the Admin page.
            </RoleNote>
          ) : null}
        </div>
      </div>

      <Card>
        <div className="card-head">
          <div>
            <h3>Deployment</h3>
            <div className="sub">
              {NETWORK.name} · chain {NETWORK.chainId}
            </div>
          </div>
          <div className="card-head-actions">
            <Badge tone="green" dot>Contracts live</Badge>
          </div>
        </div>
        <div className="card-pad">
          <div className="grid grid-2" style={{ gap: 12 }}>
            {Object.entries(CONTRACT_ADDRESSES).map(([name, address]) => (
              <div key={name} className="row between" style={{ gap: 10 }}>
                <span className="small muted">{name}</span>
                <AddressChip address={address} />
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
