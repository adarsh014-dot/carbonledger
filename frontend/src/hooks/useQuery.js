import { useEffect, useRef, useState } from "react";
import { useRefresh } from "../context/RefreshContext";

/**
 * Runs an async query and re-runs it whenever the global refresh key changes.
 * Keeps the previous data visible while refetching to avoid layout jumps.
 */
export function useQuery(fn, deps = [], { enabled = true } = {}) {
  const { refreshKey } = useRefresh();
  const [state, setState] = useState({ loading: enabled, data: null, error: null });
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!enabled) {
      setState({ loading: false, data: null, error: null });
      return undefined;
    }

    let alive = true;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    Promise.resolve()
      .then(() => fnRef.current())
      .then((data) => {
        if (alive) setState({ loading: false, data, error: null });
      })
      .catch((error) => {
        if (alive) setState({ loading: false, data: null, error });
      });

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, enabled, ...deps]);

  return state;
}
