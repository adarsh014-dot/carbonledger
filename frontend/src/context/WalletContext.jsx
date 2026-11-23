import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { BrowserProvider, JsonRpcProvider } from "ethers";
import { EXPECTED_CHAIN_ID, NETWORK, isCorrectChain } from "../lib/chain";
import { buildContracts } from "../lib/contracts";
import { friendlyError } from "../lib/format";

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [signer, setSigner] = useState(null);
  const [balance, setBalance] = useState(0n);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [hasWallet, setHasWallet] = useState(false);

  const readProvider = useMemo(
    () =>
      new JsonRpcProvider(NETWORK.rpcUrl, EXPECTED_CHAIN_ID, {
        staticNetwork: true,
      }),
    []
  );

  const hydrate = useCallback(async (accounts) => {
    if (!window.ethereum) return;
    try {
      const browserProvider = new BrowserProvider(window.ethereum);
      const network = await browserProvider.getNetwork();
      setChainId(Number(network.chainId));

      if (!accounts || accounts.length === 0) {
        setAccount(null);
        setSigner(null);
        setBalance(0n);
        return;
      }

      const nextSigner = await browserProvider.getSigner();
      const nextBalance = await browserProvider.getBalance(accounts[0]);
      setAccount(accounts[0]);
      setSigner(nextSigner);
      setBalance(nextBalance);
    } catch (err) {
      setError(friendlyError(err));
    }
  }, []);

  // Silent reconnect on load (never prompts).
  useEffect(() => {
    const ethereum = window.ethereum;
    setHasWallet(Boolean(ethereum));
    if (!ethereum) return undefined;

    let cancelled = false;
    (async () => {
      try {
        const accounts = await ethereum.request({ method: "eth_accounts" });
        if (!cancelled) await hydrate(accounts);
      } catch {
        /* ignore */
      }
    })();

    const onAccountsChanged = (accounts) => {
      hydrate(accounts);
    };
    const onChainChanged = async () => {
      try {
        const accounts = await ethereum.request({ method: "eth_accounts" });
        await hydrate(accounts);
      } catch {
        /* ignore */
      }
    };

    ethereum.on("accountsChanged", onAccountsChanged);
    ethereum.on("chainChanged", onChainChanged);

    return () => {
      cancelled = true;
      ethereum.removeListener("accountsChanged", onAccountsChanged);
      ethereum.removeListener("chainChanged", onChainChanged);
    };
  }, [hydrate]);

  const connect = useCallback(async () => {
    setError(null);
    if (!window.ethereum) {
      setError("MetaMask was not found. Install it from metamask.io to continue.");
      return;
    }
    setConnecting(true);
    try {
      const browserProvider = new BrowserProvider(window.ethereum);
      await browserProvider.send("eth_requestAccounts", []);
      const accounts = await browserProvider.send("eth_accounts", []);
      await hydrate(accounts);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setConnecting(false);
    }
  }, [hydrate]);

  const disconnect = useCallback(() => {
    setAccount(null);
    setSigner(null);
    setBalance(0n);
    setError(null);
  }, []);

  const switchNetwork = useCallback(async () => {
    setError(null);
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: NETWORK.hexChainId }],
      });
    } catch (err) {
      if (err?.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: NETWORK.hexChainId,
              chainName: NETWORK.name,
              nativeCurrency: NETWORK.currency,
              rpcUrls: [NETWORK.rpcUrl],
              blockExplorerUrls: NETWORK.explorer ? [NETWORK.explorer] : [],
            },
          ],
        });
      } else {
        setError(friendlyError(err));
        return;
      }
    }
    try {
      const accounts = await window.ethereum.request({ method: "eth_accounts" });
      await hydrate(accounts);
    } catch {
      /* ignore */
    }
  }, [hydrate]);

  const refreshBalance = useCallback(async () => {
    if (!window.ethereum || !account) return;
    try {
      const browserProvider = new BrowserProvider(window.ethereum);
      setBalance(await browserProvider.getBalance(account));
    } catch {
      /* ignore */
    }
  }, [account]);

  const contracts = useMemo(
    () => buildContracts(signer || readProvider),
    [signer, readProvider]
  );

  const value = useMemo(
    () => ({
      account,
      chainId,
      signer,
      balance,
      connecting,
      error,
      hasWallet,
      readProvider,
      contracts,
      connect,
      disconnect,
      switchNetwork,
      refreshBalance,
      correctChain: chainId ? isCorrectChain(chainId) : false,
      expectedNetwork: NETWORK,
      chainMismatch: Boolean(chainId) && !isCorrectChain(chainId),
    }),
    [
      account,
      chainId,
      signer,
      balance,
      connecting,
      error,
      hasWallet,
      readProvider,
      contracts,
      connect,
      disconnect,
      switchNetwork,
      refreshBalance,
    ]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) throw new Error("useWallet must be used inside WalletProvider");
  return context;
}
