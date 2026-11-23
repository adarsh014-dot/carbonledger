export function shortAddress(address, chars = 4) {
  if (!address) return "";
  return `${address.slice(0, 2 + chars)}…${address.slice(-chars)}`;
}

export function formatNumber(value, maximumFractionDigits = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
  }).format(number);
}

export function formatTonnes(value) {
  return formatNumber(value, 0);
}

export function formatEth(value, digits = 6) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  if (number === 0) return "0";
  if (number < 0.000001) return "<0.000001";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
  }).format(number);
}

export function formatDate(timestamp) {
  if (!timestamp) return "—";
  const date = new Date(Number(timestamp) * 1000);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function timeAgo(timestamp) {
  if (!timestamp) return "";
  const seconds = Math.max(0, Math.floor(Date.now() / 1000 - Number(timestamp)));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function initials(name = "") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

export function friendlyError(error) {
  if (!error) return "Unknown error";
  const message =
    error.shortMessage ||
    error.reason ||
    error.info?.error?.message ||
    error.message ||
    String(error);

  if (/user rejected|denied transaction/i.test(message)) return "You rejected the request in MetaMask.";
  if (/insufficient funds/i.test(message)) return "Insufficient ETH to pay for gas.";
  if (/CALL_EXCEPTION/.test(message) && error.reason) return error.reason;
  return message.replace(/^execution reverted: /i, "").slice(0, 220);
}

export function percent(part, total) {
  if (!total || Number(total) === 0) return 0;
  return Math.min(100, (Number(part) / Number(total)) * 100);
}
