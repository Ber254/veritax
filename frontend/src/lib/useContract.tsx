import { useCallback, useState } from "react";
import { api, type EscrowView } from "./api";

export type Lookup =
  | { status: "idle" | "loading" }
  | { status: "live"; escrow: EscrowView; roles: string[] }
  | { status: "resolved" | "not-found" }
  | { status: "error"; message: string };

export function useContract() {
  const [lookup, setLookup] = useState<Lookup>({ status: "idle" });
  const load = useCallback(async (id: string, address: string | null) => {
    setLookup({ status: "loading" });
    try {
      const q = new URLSearchParams({ id: id.trim() });
      if (address) q.set("address", address);
      setLookup(await api<Lookup>(`/api/contract?${q}`));
    } catch (err) {
      setLookup({ status: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }, []);
  return { lookup, load };
}

export function LookupMessage({ lookup }: { lookup: Lookup }) {
  if (lookup.status === "loading") return <p className="muted">Buscando contrato en Preprod…</p>;
  if (lookup.status === "not-found")
    return <p className="notice error">No se encontró ese hash. Si lo acabás de crear, esperá ~1 minuto a que se confirme.</p>;
  if (lookup.status === "resolved")
    return <p className="notice ok">Contrato RESOLVED: los fondos ya salieron del escrow.</p>;
  if (lookup.status === "error") return <p className="notice error">{lookup.message}</p>;
  return null;
}
