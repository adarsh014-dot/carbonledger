import { useMemo, useState } from "react";
import {
  ArrowRight,
  Coins,
  MapPin,
  ShoppingBag,
  Store,
  Tag,
  Wallet,
  XCircle,
} from "lucide-react";
import { formatEther } from "ethers";
import { useWallet } from "../context/WalletContext";
import { useQuery } from "../hooks/useQuery";
import { useTx } from "../hooks/useTx";
import { formatEth, formatNumber, shortAddress } from "../lib/format";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Modal,
  QueryError,
  RoleNote,
  Skeleton,
  Tabs,
} from "../components/ui";

export function Marketplace() {
  const { contracts, account, connect } = useWallet();
  const { send } = useTx();

  const [tab, setTab] = useState("all");
  const [buying, setBuying] = useState(null);
  const [amount, setAmount] = useState("");

  const query = useQuery(async () => {
    const [
      [listings],
      projectList,
      [batchList],
      feeBps,
      treasury,
      proceeds,
    ] = await Promise.all([
      contracts.marketplace.getListings(0, 500),
      contracts.registry.getProjects(0, 500).then((result) => result[0]),
      contracts.token.getBatches(0, 500),
      contracts.marketplace.feeBps(),
      contracts.marketplace.treasury(),
      account ? contracts.marketplace.proceeds(account) : Promise.resolve(0n),
    ]);

    const batchesById = new Map();
    batchList.forEach((batch) => batchesById.set(batch.id.toString(), batch));

    return {
      listings: [...listings].reverse(),
      projects: projectList,
      batchesById,
      feeBps,
      treasury,
      proceeds,
    };
  }, [contracts, account]);

  const projectsById = useMemo(() => {
    const map = new Map();
    (query.data?.projects || []).forEach((project) => map.set(project.id.toString(), project));
    return map;
  }, [query.data]);

  const activeListings = (query.data?.listings || []).filter((listing) => listing.active);
  const myListings = activeListings.filter(
    (listing) => account && listing.seller.toLowerCase() === account.toLowerCase()
  );
  const shown = tab === "mine" ? myListings : activeListings;

  const feeBps = query.data ? Number(query.data.feeBps) : 250;

  const buyingTotal =
    buying && Number(amount) > 0 ? buying.pricePerTonne * BigInt(Math.floor(Number(amount))) : 0n;
  const buyingValid =
    buying && Number(amount) > 0 && Number(amount) <= Number(buying.remaining);

  const openBuy = (listing) => {
    setBuying(listing);
    setAmount(listing.remaining.toString());
  };

  const buy = async () => {
    try {
      await send(
        () =>
          contracts.marketplace.buyCredits(
            buying.id,
            BigInt(Math.floor(Number(amount))),
            { value: buyingTotal }
          ),
        {
          pending: "Confirm purchase in MetaMask…",
          success: "Purchase confirmed - credits transferred to your wallet",
        }
      );
      setBuying(null);
    } catch {
      /* toast shown */
    }
  };

  const cancel = async (listing) => {
    try {
      await send(() => contracts.marketplace.cancelListing(listing.id), {
        pending: "Cancelling listing…",
        success: "Listing cancelled and credits returned",
      });
    } catch {
      /* toast shown */
    }
  };

  const withdraw = async () => {
    try {
      await send(() => contracts.marketplace.withdrawProceeds(), {
        pending: "Withdrawing proceeds…",
        success: "Proceeds withdrawn to your wallet",
      });
    } catch {
      /* toast shown */
    }
  };

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Marketplace</h1>
          <p>
            Fixed-price carbon credits settled in ETH. Credits are escrowed in the smart contract
            until sold, and proceeds are withdrawn using a pull-payment pattern.
          </p>
        </div>
        <div className="page-actions">
          {!account ? (
            <Button variant="primary" icon={<Wallet size={15} />} onClick={connect}>
              Connect wallet
            </Button>
          ) : query.data && query.data.proceeds > 0n ? (
            <Button variant="primary" icon={<Coins size={15} />} onClick={withdraw}>
              Withdraw {formatEth(formatEther(query.data.proceeds), 5)} ETH
            </Button>
          ) : (
            <Badge tone="gray">No proceeds to withdraw</Badge>
          )}
        </div>
      </div>

      {query.error ? <QueryError error={query.error} /> : null}

      <div className="grid grid-3">
        <Card className="stat">
          <div className="stat-top">
            <span className="stat-icon">
              <Store size={14} />
            </span>
            Active listings
          </div>
          <div className="stat-value">
            {formatNumber(activeListings.length, 0)}
            <small>offers</small>
          </div>
          <div className="stat-foot">{formatNumber(query.data?.listings.length || 0, 0)} created in total</div>
        </Card>
        <Card className="stat">
          <div className="stat-top">
            <span className="stat-icon">
              <Tag size={14} />
            </span>
            Credits for sale
          </div>
          <div className="stat-value">
            {formatNumber(
              activeListings.reduce((sum, listing) => sum + Number(listing.remaining), 0),
              0
            )}
            <small>tCO2e</small>
          </div>
          <div className="stat-foot">Escrowed in the marketplace contract</div>
        </Card>
        <Card className="stat">
          <div className="stat-top">
            <span className="stat-icon">
              <Coins size={14} />
            </span>
            Your proceeds
          </div>
          <div className="stat-value">
            {formatEth(formatEther(query.data?.proceeds || 0n), 5)}
            <small>ETH</small>
          </div>
          <div className="stat-foot">Platform fee {feeBps / 100}%</div>
        </Card>
      </div>

      <Card>
        <div className="card-head">
          <Tabs
            value={tab}
            onChange={setTab}
            options={[
              { value: "all", label: "All listings", count: activeListings.length },
              { value: "mine", label: "My listings", count: myListings.length },
            ]}
          />
          <div className="card-head-actions">
            <Badge tone="green" dot>
              Live on-chain
            </Badge>
          </div>
        </div>

        {query.loading && !query.data ? (
          <div className="card-pad grid grid-3">
            {[0, 1, 2].map((key) => (
              <Card key={key} className="card-pad stack" style={{ gap: 12 }}>
                <Skeleton height={26} width="55%" />
                <Skeleton height={12} width="80%" />
                <Skeleton height={8} />
              </Card>
            ))}
          </div>
        ) : shown.length === 0 ? (
          <EmptyState
            icon={<ShoppingBag size={20} />}
            title={tab === "mine" ? "You have no active listings" : "No credits for sale yet"}
            description={
              tab === "mine"
                ? "Open your portfolio on the Credits page and choose Sell on any batch you hold."
                : "Be the first to list credits: open the Credits page, pick a batch and set a price per tonne."
            }
          />
        ) : (
          <div className="card-pad grid grid-3">
            {shown.map((listing) => {
              const batch = query.data?.batchesById?.get(listing.batchId.toString());
              const project = batch
                ? projectsById.get(batch.projectId.toString()) || null
                : null;
              return (
                <ListingCard
                  key={listing.id.toString()}
                  listing={listing}
                  project={project}
                  batch={batch}
                  isMine={account && listing.seller.toLowerCase() === account.toLowerCase()}
                  onBuy={() => openBuy(listing)}
                  onCancel={() => cancel(listing)}
                  account={account}
                  feeBps={feeBps}
                />
              );
            })}
          </div>
        )}
      </Card>

      <RoleNote>
        Prices are set by sellers and paid in Sepolia ETH. The marketplace keeps a{" "}
        {feeBps / 100}% fee on each sale; sellers withdraw proceeds whenever they like.
      </RoleNote>

      <Modal
        open={Boolean(buying)}
        onClose={() => setBuying(null)}
        title="Buy carbon credits"
        subtitle="Credits are transferred from escrow the moment your payment confirms."
        footer={
          <>
            <Button variant="ghost" onClick={() => setBuying(null)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={!buyingValid} onClick={buy}>
              Pay {buyingTotal ? formatEth(formatEther(buyingTotal), 6) : "0"} ETH
            </Button>
          </>
        }
      >
        {buying ? (
          <div className="form-grid">
            <div className="full">
              <div className="hero-strip">
                <Tag size={14} />
                Listing #{buying.id.toString()} · {formatNumber(buying.remaining, 0)} tCO2e
                available · {formatEth(formatEther(buying.pricePerTonne), 6)} ETH per tonne
              </div>
            </div>
            <div className="full">
              <Field
                label="Amount to buy (tCO2e)"
                hint={`Maximum ${formatNumber(buying.remaining, 0)} tonnes`}
              >
                <input
                  className="input"
                  type="number"
                  min="1"
                  max={Number(buying.remaining)}
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </Field>
            </div>
            <div className="full">
              <div className="kv">
                <dt>Credits</dt>
                <dd>{formatNumber(amount || 0, 0)} tCO2e</dd>
              </div>
              <div className="kv">
                <dt>Total cost</dt>
                <dd>{formatEth(formatEther(buyingTotal), 6)} ETH</dd>
              </div>
              <div className="kv">
                <dt>Seller receives</dt>
                <dd>
                  {formatEth(
                    formatEther((buyingTotal * BigInt(10000 - feeBps)) / 10000n),
                    6
                  )}{" "}
                  ETH
                </dd>
              </div>
              <div className="kv">
                <dt>Platform fee</dt>
                <dd>{feeBps / 100}%</dd>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function ListingCard({ listing, project, batch, isMine, onBuy, onCancel, account, feeBps }) {
  const total = listing.pricePerTonne * listing.remaining;

  return (
    <Card className="listing-card">
      <div className="listing-band">
        <div>
          <div className="listing-price">{formatEth(formatEther(listing.pricePerTonne), 6)}</div>
          <small>ETH per tCO2e</small>
        </div>
        <Badge tone="lime">Batch #{listing.batchId.toString()}</Badge>
      </div>
      <div className="listing-body">
        <div>
          <div className="listing-title">{project?.name || "Verified project"}</div>
          <div className="loc small muted" style={{ marginTop: 4 }}>
            <MapPin size={11} /> {project?.location || "On-chain registry"}
          </div>
        </div>
        <div className="listing-meta">
          {project ? <Badge tone="green">Vintage {batch?.vintage?.toString() || "—"}</Badge> : null}
          <Badge tone="gray">Seller {shortAddress(listing.seller)}</Badge>
        </div>
        <div>
          <div className="row between small muted" style={{ marginBottom: 5 }}>
            <span>{formatNumber(listing.remaining, 0)} t available</span>
            <span>{formatEth(formatEther(total), 4)} ETH total</span>
          </div>
          <div className="progress">
            <div style={{ width: "100%" }} />
          </div>
        </div>
        <div className="listing-foot">
          {isMine ? (
            <Button size="sm" variant="secondary" icon={<XCircle size={13} />} onClick={onCancel}>
              Cancel listing
            </Button>
          ) : (
            <Button
              size="sm"
              variant="primary"
              icon={<ShoppingBag size={13} />}
              onClick={onBuy}
              disabled={!account}
              title={!account ? "Connect a wallet to buy" : undefined}
            >
              {account ? "Buy credits" : "Connect to buy"}
            </Button>
          )}
          <span className="small muted">Fee {feeBps / 100}%</span>
        </div>
      </div>
    </Card>
  );
}
