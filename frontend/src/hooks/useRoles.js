import { useEffect, useState } from "react";
import { useWallet } from "../context/WalletContext";
import { useRefresh } from "../context/RefreshContext";

const EMPTY = {
  loading: false,
  admin: false,
  verifier: false,
  minter: false,
  pauser: false,
  marketAdmin: false,
  certificateAdmin: false,
};

/**
 * Reads the connected account's roles from every contract.
 * Note: this is a UX hint only - the contracts enforce permissions on-chain.
 */
export function useRoles() {
  const { account, contracts } = useWallet();
  const { refreshKey } = useRefresh();
  const [roles, setRoles] = useState({ ...EMPTY, loading: Boolean(account) });

  useEffect(() => {
    if (!account || !contracts) {
      setRoles({ ...EMPTY });
      return undefined;
    }

    let alive = true;
    setRoles((prev) => ({ ...prev, loading: true }));

    (async () => {
      try {
        const [
          defaultAdminRole,
          verifierRole,
          pauserRole,
          minterRole,
          marketAdminRole,
          certAdminRole,
        ] = await Promise.all([
          contracts.registry.DEFAULT_ADMIN_ROLE(),
          contracts.registry.VERIFIER_ROLE(),
          contracts.registry.PAUSER_ROLE(),
          contracts.token.MINTER_ROLE(),
          contracts.marketplace.DEFAULT_ADMIN_ROLE(),
          contracts.certificate.DEFAULT_ADMIN_ROLE(),
        ]);

        const [admin, verifier, pauser, minter, marketAdmin, certificateAdmin] =
          await Promise.all([
            contracts.registry.hasRole(defaultAdminRole, account),
            contracts.registry.hasRole(verifierRole, account),
            contracts.registry.hasRole(pauserRole, account),
            contracts.token.hasRole(minterRole, account),
            contracts.marketplace.hasRole(marketAdminRole, account),
            contracts.certificate.hasRole(certAdminRole, account),
          ]);

        if (alive) {
          setRoles({
            loading: false,
            admin,
            verifier,
            pauser,
            minter,
            marketAdmin,
            certificateAdmin,
          });
        }
      } catch {
        if (alive) setRoles({ ...EMPTY });
      }
    })();

    return () => {
      alive = false;
    };
  }, [account, contracts, refreshKey]);

  return roles;
}
