import { useMemo, useState } from "react";
import { Activity as ActivityIcon, RefreshCw } from "lucide-react";
import { useWallet } from "../context/WalletContext";
import { useQuery } from "../hooks/useQuery";
import { useRefresh } from "../context/RefreshContext";
import { loadActivity } from "../lib/events";
import { ActivityList } from "../components/ActivityList";
import { Button, Card, QueryError, Tabs } from "../components/ui";

const FILTERS = {
  all: null,
  registry: ["project", "verified"],
  credits: ["batch", "retired", "certificate"],
  market: ["market"],
};

export function ActivityPage() {
  const { contracts, readProvider } = useWallet();
  const { refresh } = useRefresh();
  const [tab, setTab] = useState("all");

  const query = useQuery(
    () => loadActivity(contracts, readProvider, { limit: 150 }),
    [contracts, readProvider]
  );

  const events = query.data || [];
  const filtered = useMemo(() => {
    const kinds = FILTERS[tab];
    if (!kinds) return events;
    return events.filter((event) => kinds.includes(event.kind));
  }, [events, tab]);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Activity</h1>
          <p>
            A transparent, append-only history reconstructed from Solidity events. Every entry is
            backed by a transaction on {readProvider ? "the connected network" : "the blockchain"}.
          </p>
        </div>
        <div className="page-actions">
          <Button
            variant="secondary"
            icon={<RefreshCw size={14} />}
            onClick={refresh}
            disabled={query.loading}
          >
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <div className="card-head">
          <Tabs
            value={tab}
            onChange={setTab}
            options={[
              { value: "all", label: "All", count: events.length },
              {
                value: "registry",
                label: "Registry",
                count: events.filter((event) => FILTERS.registry.includes(event.kind)).length,
              },
              {
                value: "credits",
                label: "Credits",
                count: events.filter((event) => FILTERS.credits.includes(event.kind)).length,
              },
              {
                value: "market",
                label: "Marketplace",
                count: events.filter((event) => FILTERS.market.includes(event.kind)).length,
              },
            ]}
          />
          <div className="card-head-actions">
            <span className="badge badge-gray">
              <ActivityIcon size={11} /> {filtered.length} events
            </span>
          </div>
        </div>
        {query.error ? (
          <div className="card-pad">
            <QueryError error={query.error} />
          </div>
        ) : (
          <ActivityList
            events={filtered}
            loading={query.loading}
            emptyText="No events match this filter yet."
          />
        )}
      </Card>
    </div>
  );
}
