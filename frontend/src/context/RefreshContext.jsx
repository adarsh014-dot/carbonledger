import { createContext, useCallback, useContext, useMemo, useState } from "react";

const RefreshContext = createContext({ refreshKey: 0, refresh: () => {} });

export function RefreshProvider({ children }) {
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey((key) => key + 1);
  }, []);

  const value = useMemo(() => ({ refreshKey, refresh }), [refreshKey, refresh]);

  return <RefreshContext.Provider value={value}>{children}</RefreshContext.Provider>;
}

export function useRefresh() {
  return useContext(RefreshContext);
}
