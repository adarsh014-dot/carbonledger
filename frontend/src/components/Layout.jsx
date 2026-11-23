import { useEffect, useRef, useState } from "react";
import {
  Activity,
  Award,
  ChevronDown,
  Copy,
  ExternalLink,
  Layers,
  LayoutDashboard,
  Leaf,
  LogOut,
  Menu,
  Settings2,
  Store,
  Wallet,
  X,
} from "lucide-react";
import { formatEther } from "ethers";
import { useWallet } from "../context/WalletContext";
import { useToast } from "../context/ToastContext";
import { NETWORK, addressUrl, txUrl } from "../lib/chain";
import { formatEth, shortAddress } from "../lib/format";

const NAV = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "projects", label: "Projects", icon: Leaf },
  { key: "credits", label: "Credits", icon: Layers },
  { key: "marketplace", label: "Marketplace", icon: Store },
  { key: "certificates", label: "Certificates", icon: Award },
  { key: "activity", label: "Activity", icon: Activity },
  { key: "admin", label: "Admin", icon: Settings2 },
];

function WalletMenu() {
  const { account, balance, disconnect, chainMismatch, switchNetwork } = useWallet();
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (!account) return null;

  return (
    <div style={{ position: "relative" }} ref={ref}>
      <button
        type="button"
        className="wallet-btn connected"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="wallet-dot" />
        <span className="mono">{shortAddress(account)}</span>
        <span className="muted small" style={{ fontWeight: 500 }}>
          {formatEth(formatEther(balance), 4)} ETH
        </span>
        <ChevronDown size={14} className="muted" />
      </button>

      {open ? (
        <div className="wallet-menu" role="menu">
          <div style={{ padding: "8px 9px 10px" }}>
            <div className="small muted">Connected account</div>
            <div className="mono" style={{ fontSize: 11.5, marginTop: 3, wordBreak: "break-all" }}>
              {account}
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              style={{ marginTop: 6, paddingLeft: 0 }}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(account);
                  push({ title: "Address copied", tone: "success", duration: 2500 });
                } catch {
                  /* ignore */
                }
              }}
            >
              <Copy size={12} /> Copy address
            </button>
          </div>
          <div className="divider" />
          <div style={{ padding: "8px 9px" }} className="small">
            <div className="row between">
              <span className="muted">Network</span>
              <span className="row" style={{ gap: 5 }}>
                <span className={`network-dot ${chainMismatch ? "off" : ""}`} />
                {NETWORK.shortName}
              </span>
            </div>
          </div>
          {chainMismatch ? (
            <button
              type="button"
              className="wallet-menu-item"
              onClick={() => {
                setOpen(false);
                switchNetwork();
              }}
            >
              <Wallet size={14} /> Switch to {NETWORK.name}
            </button>
          ) : null}
          {addressUrl(account) ? (
            <a
              className="wallet-menu-item"
              href={addressUrl(account)}
              target="_blank"
              rel="noreferrer"
              onClick={() => setOpen(false)}
            >
              <ExternalLink size={14} /> View on explorer
            </a>
          ) : null}
          <button
            type="button"
            className="wallet-menu-item"
            onClick={() => {
              setOpen(false);
              disconnect();
            }}
          >
            <LogOut size={14} /> Disconnect
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function Layout({ page, onNavigate, children }) {
  const {
    account,
    connect,
    connecting,
    hasWallet,
    chainMismatch,
    switchNetwork,
    error,
    expectedNetwork,
  } = useWallet();
  const [mobileOpen, setMobileOpen] = useState(false);
  const current = NAV.find((item) => item.key === page) || NAV[0];

  const navigate = (key) => {
    onNavigate(key);
    setMobileOpen(false);
  };

  return (
    <div className="app-shell">
      {mobileOpen ? (
        <button
          type="button"
          className="scrim show"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <Leaf size={20} color="#c9f26e" />
          </span>
          <div>
            <div className="brand-name">CARBONLEDGER</div>
            <div className="brand-sub">On-chain carbon registry</div>
          </div>
          <button
            type="button"
            className="icon-btn"
            style={{ marginLeft: "auto", display: mobileOpen ? "inline-flex" : "none" }}
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <X size={16} />
          </button>
        </div>

        <div className="nav-group-label">Workspace</div>
        <nav className="nav" aria-label="Main navigation">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                className={`nav-item ${page === item.key ? "active" : ""}`}
                onClick={() => navigate(item.key)}
                aria-current={page === item.key ? "page" : undefined}
              >
                <Icon size={16} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-foot">
          <div className="network-box">
            <div className="network-row">
              <span className={`network-dot ${chainMismatch ? "off" : ""}`} />
              <span style={{ color: "#dcebe2", fontWeight: 600 }}>
                {expectedNetwork.name}
              </span>
            </div>
            <div className="sidebar-address">
              {account ? shortAddress(account, 6) : "Wallet not connected"}
            </div>
            {chainMismatch ? (
              <button
                type="button"
                className="btn btn-lime btn-xs btn-block"
                style={{ marginTop: 9 }}
                onClick={switchNetwork}
              >
                Switch network
              </button>
            ) : null}
          </div>
          <div style={{ fontSize: 10.5, color: "#5d7f6c", padding: "0 4px" }}>
            TE COMP mini-project · {new Date().getFullYear()}
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button
            type="button"
            className="mobile-toggle"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={18} />
          </button>
          <div className="topbar-title">
            <span className="topbar-crumb">CarbonLedger</span> / {current.label}
          </div>
          <div className="topbar-right">
            <span className="badge badge-gray" title="Deployment network">
              <span className={`network-dot ${chainMismatch ? "off" : ""}`} />
              {NETWORK.shortName}
            </span>
            {!account ? (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={connect}
                disabled={connecting}
              >
                <Wallet size={14} />
                {connecting ? "Connecting…" : hasWallet ? "Connect wallet" : "Install MetaMask"}
              </button>
            ) : chainMismatch ? (
              <button type="button" className="btn btn-secondary btn-sm" onClick={switchNetwork}>
                Wrong network · switch
              </button>
            ) : (
              <WalletMenu />
            )}
          </div>
        </header>

        {error ? (
          <div style={{ padding: "10px 32px 0" }}>
            <div className="role-note warn-note" role="alert">
              <Wallet size={15} />
              <div>{error}</div>
            </div>
          </div>
        ) : null}

        {!hasWallet && !account ? (
          <div style={{ padding: "10px 32px 0" }}>
            <div className="role-note">
              <Wallet size={15} />
              <div>
                MetaMask is not detected. Install it to send transactions. You can still browse
                on-chain data in read-only mode.
              </div>
            </div>
          </div>
        ) : null}

        <main className="page" key={page}>
          {children}
        </main>
      </div>
    </div>
  );
}
