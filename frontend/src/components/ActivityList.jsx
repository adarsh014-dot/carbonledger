import {
  Award,
  Flame,
  Layers,
  Leaf,
  ShieldCheck,
  ShieldOff,
  ShoppingCart,
  Tag,
  XCircle,
  ExternalLink,
} from "lucide-react";
import { EmptyState, Skeleton } from "./ui";
import { timeAgo, formatDate } from "../lib/format";
import { txUrl } from "../lib/chain";

const ICONS = {
  leaf: Leaf,
  shield: ShieldCheck,
  shieldOff: ShieldOff,
  layers: Layers,
  flame: Flame,
  award: Award,
  tag: Tag,
  shoppingCart: ShoppingCart,
  xCircle: XCircle,
};

export function ActivityList({ events = [], loading = false, emptyText = "No on-chain activity yet." }) {
  if (loading && events.length === 0) {
    return (
      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="row" style={{ gap: 12 }}>
            <Skeleton height={30} width={30} style={{ borderRadius: 9 }} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              <Skeleton height={11} width="55%" />
              <Skeleton height={9} width="35%" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!events.length) {
    return <EmptyState title="Nothing here yet" description={emptyText} />;
  }

  return (
    <div className="feed">
      {events.map((event) => {
        const Icon = ICONS[event.icon] || Leaf;
        return (
          <div className="feed-item" key={`${event.txHash}-${event.logIndex}`}>
            <span className={`feed-icon ${event.tone || ""}`}>
              <Icon size={14} />
            </span>
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="feed-title">{event.title}</div>
              <div className="feed-meta">
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "38ch" }}>
                  {event.detail}
                </span>
                {event.actor ? (
                  <span className="mono" title={event.actor}>
                    {event.actor.slice(0, 6)}…{event.actor.slice(-4)}
                  </span>
                ) : null}
                {txUrl(event.txHash) ? (
                  <a
                    href={txUrl(event.txHash)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="View transaction on explorer"
                  >
                    <ExternalLink size={10} />
                  </a>
                ) : null}
              </div>
            </div>
            <span className="feed-time" title={formatDate(event.timestamp)}>
              {timeAgo(event.timestamp)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
