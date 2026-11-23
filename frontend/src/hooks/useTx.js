import { useCallback } from "react";
import { useToast } from "../context/ToastContext";
import { useRefresh } from "../context/RefreshContext";
import { useWallet } from "../context/WalletContext";
import { friendlyError } from "../lib/format";
import { txUrl } from "../lib/chain";

/**
 * Wraps a contract write with consistent pending/confirmed/error toasts,
 * Etherscan links and an automatic data refresh.
 */
export function useTx() {
  const { push } = useToast();
  const { refresh } = useRefresh();
  const { refreshBalance } = useWallet();

  const send = useCallback(
    async (action, { pending = "Confirm the transaction in MetaMask…", success = "Transaction confirmed" } = {}) => {
      try {
        const tx = await action();
        if (!tx || !tx.wait) return tx;

        push({
          title: pending,
          description: tx.hash,
          tone: "info",
          href: txUrl(tx.hash),
          duration: 6000,
        });

        const receipt = await tx.wait();

        push({
          title: success,
          description: `Included in block ${receipt.blockNumber}`,
          tone: "success",
          href: txUrl(tx.hash),
          duration: 8000,
        });

        refresh();
        refreshBalance();
        return receipt;
      } catch (error) {
        push({
          title: "Transaction failed",
          description: friendlyError(error),
          tone: "error",
          duration: 9000,
        });
        throw error;
      }
    },
    [push, refresh, refreshBalance]
  );

  return { send };
}
