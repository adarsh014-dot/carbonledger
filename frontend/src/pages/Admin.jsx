import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Coins,
  PauseCircle,
  PlayCircle,
  Settings2,
  Shield,
  Users,
} from "lucide-react";
import { formatEther } from "ethers";
import { useWallet } from "../context/WalletContext";
import { useQuery } from "../hooks/useQuery";
import { useRoles } from "../hooks/useRoles";
import { useTx } from "../hooks/useTx";
import { formatEth, shortAddress } from "../lib/format";
import { CONTRACT_ADDRESSES, NETWORK, addressUrl } from "../lib/chain";
import {
  AddressChip,
  Badge,
  Button,
  Card,
  Field,
  QueryError,
  RoleNote,
} from "../components/ui";

const ROLE_OPTIONS = [
  { id: "registry:verifier", label: "ProjectRegistry · VERIFIER_ROLE", contract: "registry", getter: "VERIFIER_ROLE" },
  { id: "registry:pauser", label: "ProjectRegistry · PAUSER_ROLE", contract: "registry", getter: "PAUSER_ROLE" },
  { id: "registry:admin", label: "ProjectRegistry · DEFAULT_ADMIN_ROLE", contract: "registry", getter: "DEFAULT_ADMIN_ROLE" },
  { id: "token:minter", label: "CarbonCreditToken · MINTER_ROLE", contract: "token", getter: "MINTER_ROLE" },
  { id: "token:pauser", label: "CarbonCreditToken · PAUSER_ROLE", contract: "token", getter: "PAUSER_ROLE" },
  { id: "token:admin", label: "CarbonCreditToken · DEFAULT_ADMIN_ROLE", contract: "token", getter: "DEFAULT_ADMIN_ROLE" },
  { id: "certificate:minter", label: "RetirementCertificate · MINTER_ROLE", contract: "certificate", getter: "MINTER_ROLE" },
  { id: "market:pauser", label: "CarbonMarketplace · PAUSER_ROLE", contract: "marketplace", getter: "PAUSER_ROLE" },
  { id: "market:admin", label: "CarbonMarketplace · DEFAULT_ADMIN_ROLE", contract: "marketplace", getter: "DEFAULT_ADMIN_ROLE" },
];

function RoleManager({ contracts, canManage }) {
  const { send } = useTx();
  const [roleId, setRoleId] = useState(ROLE_OPTIONS[0].id);
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  const option = ROLE_OPTIONS.find((item) => item.id === roleId) || ROLE_OPTIONS[0];
  const validAddress = /^0x[a-fA-F0-9]{40}$/.test(address);

  useEffect(() => {
    let alive = true;
    if (!validAddress) {
      setStatus(null);
      return undefined;
    }
    (async () => {
      try {
        const hash = await contracts[option.contract][option.getter]();
        const has = await contracts[option.contract].hasRole(hash, address);
        if (alive) setStatus(has);
      } catch {
        if (alive) setStatus(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [address, option, contracts, validAddress]);

  const apply = async (grant) => {
    setBusy(true);
    try {
      const hash = await contracts[option.contract][option.getter]();
      const contract = contracts[option.contract];
      await send(
        () =>
          grant
            ? contract.grantRole(hash, address)
            : contract.revokeRole(hash, address),
        {
          pending: grant ? "Granting role…" : "Revoking role…",
          success: grant ? "Role granted" : "Role revoked",
        }
      );
      const has = await contract.hasRole(hash, address);
      setStatus(has);
    } catch {
      /* toast shown */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack" style={{ gap: 14 }}>
      <Field label="Role">
        <select className="select" value={roleId} onChange={(event) => setRoleId(event.target.value)}>
          {ROLE_OPTIONS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </Field>
      <Field
        label="Account address"
        hint={
          status === null
            ? "Enter a full address to check its current role status."
            : status
            ? "This account currently HAS the selected role."
            : "This account does NOT have the selected role."
        }
      >
        <input
          className="input mono"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          placeholder="0x…"
        />
      </Field>
      <div className="row" style={{ gap: 8 }}>
        <Button
          variant="primary"
          size="sm"
          disabled={!canManage || !validAddress || busy}
          loading={busy}
          onClick={() => apply(true)}
        >
          Grant role
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={!canManage || !validAddress || busy}
          onClick={() => apply(false)}
        >
          Revoke role
        </Button>
        {status !== null ? (
          <Badge tone={status ? "green" : "gray"}>{status ? "Has role" : "No role"}</Badge>
        ) : null}
      </div>
      {!canManage ? (
        <RoleNote warn icon={<AlertTriangle size={15} />}>
          Only the current DEFAULT_ADMIN_ROLE of a contract can grant or revoke its roles.
        </RoleNote>
      ) : null}
    </div>
  );
}

export function Admin() {
  const { contracts } = useWallet();
  const roles = useRoles();
  const { send } = useTx();
  const [feePercent, setFeePercent] = useState("2.5");
  const [treasuryInput, setTreasuryInput] = useState("");

  const query = useQuery(async () => {
    const [registryPaused, tokenPaused, marketPaused, feeBps, treasury, accruedFees] =
      await Promise.all([
        contracts.registry.paused(),
        contracts.token.paused(),
        contracts.marketplace.paused(),
        contracts.marketplace.feeBps(),
        contracts.marketplace.treasury(),
        contracts.marketplace.accruedFees(),
      ]);
    return { registryPaused, tokenPaused, marketPaused, feeBps, treasury, accruedFees };
  }, [contracts]);

  useEffect(() => {
    if (!query.data) return;
    setFeePercent(String(Number(query.data.feeBps) / 100));
    setTreasuryInput(query.data.treasury);
  }, [query.data]);

  const canPauseRegistry = roles.admin || roles.pauser;
  const canPauseMarket = roles.marketAdmin || roles.pauser;
  const canManageMarket = roles.marketAdmin;

  const togglePause = async (label, contract, isPaused) => {
    try {
      await send(() => (isPaused ? contract.unpause() : contract.pause()), {
        pending: isPaused ? `Unpausing ${label}…` : `Pausing ${label}…`,
        success: `${label} ${isPaused ? "unpaused" : "paused"}`,
      });
    } catch {
      /* toast shown */
    }
  };

  const updateFee = async () => {
    const bps = Math.round(Number(feePercent) * 100);
    if (!Number.isFinite(bps) || bps < 0 || bps > 1000) return;
    try {
      await send(() => contracts.marketplace.setFeeBps(bps), {
        pending: "Updating marketplace fee…",
        success: `Marketplace fee set to ${bps / 100}%`,
      });
    } catch {
      /* toast shown */
    }
  };

  const updateTreasury = async () => {
    if (!/^0x[a-fA-F0-9]{40}$/.test(treasuryInput)) return;
    try {
      await send(() => contracts.marketplace.setTreasury(treasuryInput), {
        pending: "Updating treasury…",
        success: "Treasury updated",
      });
    } catch {
      /* toast shown */
    }
  };

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Administration</h1>
          <p>
            Manage on-chain roles, emergency pauses and marketplace parameters. Every action here
            is enforced by OpenZeppelin AccessControl on the contracts.
          </p>
        </div>
        <div className="page-actions">
          <Badge tone={roles.admin ? "green" : "gray"} dot>
            {roles.admin ? "Admin connected" : "Read-only"}
          </Badge>
        </div>
      </div>

      {query.error ? <QueryError error={query.error} /> : null}

      {!roles.admin && !roles.marketAdmin && !roles.verifier ? (
        <RoleNote>
          Your connected account has no administrative role. You can inspect this page, but
          granting roles, pausing contracts and changing fees will revert. Use the deployer account
          (Hardhat account #0 locally, or the Sepolia deployer) to manage the system.
        </RoleNote>
      ) : null}

      <div className="split">
        <div className="stack">
          <Card>
            <div className="card-head">
              <div>
                <h3>
                  <Users size={15} style={{ verticalAlign: -2, marginRight: 6 }} />
                  Role management
                </h3>
                <div className="sub">Grant or revoke AccessControl roles on any contract</div>
              </div>
            </div>
            <div className="card-pad">
              <RoleManager contracts={contracts} canManage={roles.admin} />
            </div>
          </Card>

          <Card>
            <div className="card-head">
              <div>
                <h3>
                  <PauseCircle size={15} style={{ verticalAlign: -2, marginRight: 6 }} />
                  Emergency controls
                </h3>
                <div className="sub">Pausing blocks new issuance, transfers and trades</div>
              </div>
            </div>
            <div className="card-pad stack" style={{ gap: 12 }}>
              {query.data ? (
                [
                  {
                    label: "ProjectRegistry",
                    paused: query.data.registryPaused,
                    contract: contracts.registry,
                    allowed: canPauseRegistry,
                  },
                  {
                    label: "CarbonCreditToken",
                    paused: query.data.tokenPaused,
                    contract: contracts.token,
                    allowed: canPauseRegistry,
                  },
                  {
                    label: "CarbonMarketplace",
                    paused: query.data.marketPaused,
                    contract: contracts.marketplace,
                    allowed: canPauseMarket,
                  },
                ].map((item) => (
                  <div key={item.label} className="row between" style={{ gap: 10 }}>
                    <div>
                      <div className="small" style={{ fontWeight: 600 }}>
                        {item.label}
                      </div>
                      <div className="small muted">
                        {item.paused ? "Paused" : "Operational"}
                      </div>
                    </div>
                    <div className="row" style={{ gap: 8 }}>
                      <Badge tone={item.paused ? "amber" : "green"} dot>
                        {item.paused ? "Paused" : "Live"}
                      </Badge>
                      <Button
                        size="sm"
                        variant={item.paused ? "primary" : "secondary"}
                        disabled={!item.allowed}
                        icon={
                          item.paused ? <PlayCircle size={13} /> : <PauseCircle size={13} />
                        }
                        onClick={() => togglePause(item.label, item.contract, item.paused)}
                      >
                        {item.paused ? "Unpause" : "Pause"}
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="small muted">Loading contract state…</div>
              )}
            </div>
          </Card>
        </div>

        <div className="stack">
          <Card>
            <div className="card-head">
              <div>
                <h3>
                  <Coins size={15} style={{ verticalAlign: -2, marginRight: 6 }} />
                  Marketplace settings
                </h3>
                <div className="sub">Fee cap is hard-coded at 10%</div>
              </div>
            </div>
            <div className="card-pad stack" style={{ gap: 14 }}>
              <Field label="Platform fee (%)" hint="2.5% = 250 basis points">
                <div className="input-group">
                  <input
                    className="input"
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    value={feePercent}
                    onChange={(event) => setFeePercent(event.target.value)}
                    disabled={!canManageMarket}
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={updateFee}
                    disabled={!canManageMarket}
                  >
                    Save
                  </Button>
                </div>
              </Field>
              <Field label="Treasury address">
                <div className="input-group">
                  <input
                    className="input mono"
                    value={treasuryInput}
                    onChange={(event) => setTreasuryInput(event.target.value)}
                    disabled={!canManageMarket}
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={updateTreasury}
                    disabled={!canManageMarket}
                  >
                    Save
                  </Button>
                </div>
              </Field>
              <div className="divider" />
              <div className="row between">
                <div>
                  <div className="small muted">Accrued fees</div>
                  <div style={{ fontWeight: 600 }}>
                    {formatEth(formatEther(query.data?.accruedFees || 0n), 6)} ETH
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="primary"
                  disabled={!canManageMarket || !query.data?.accruedFees}
                  onClick={() =>
                    send(() => contracts.marketplace.withdrawFees(), {
                      pending: "Withdrawing fees…",
                      success: "Fees sent to treasury",
                    }).catch(() => {})
                  }
                >
                  Withdraw
                </Button>
              </div>
            </div>
          </Card>

          <Card>
            <div className="card-head">
              <div>
                <h3>
                  <Settings2 size={15} style={{ verticalAlign: -2, marginRight: 6 }} />
                  Deployment
                </h3>
                <div className="sub">
                  {NETWORK.name} · chain {NETWORK.chainId}
                </div>
              </div>
            </div>
            <div className="card-pad stack" style={{ gap: 10 }}>
              {Object.entries(CONTRACT_ADDRESSES).map(([name, address]) => (
                <div key={name} className="row between" style={{ gap: 10 }}>
                  <span className="small muted">{name}</span>
                  <div className="row" style={{ gap: 6 }}>
                    <AddressChip address={address} />
                    {addressUrl(address) ? (
                      <a
                        className="btn btn-ghost btn-xs"
                        href={addressUrl(address)}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`View ${name} on explorer`}
                      >
                        <Shield size={12} />
                      </a>
                    ) : null}
                  </div>
                </div>
              ))}
              <div className="small muted" style={{ marginTop: 4 }}>
                Deployer / treasury:{" "}
                <span className="mono">{shortAddress(query.data?.treasury || "")}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
