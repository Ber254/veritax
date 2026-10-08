import { useEffect } from "react";

/** Calls `fn` now and every `ms` while `active`. */
export function usePoll(active: boolean, fn: () => void, ms = 10_000) {
  useEffect(() => {
    if (!active) return;
    fn();
    const t = setInterval(fn, ms);
    return () => clearInterval(t);
  }, [active, fn, ms]);
}
