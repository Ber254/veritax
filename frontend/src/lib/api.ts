/** Client helpers shared by the pages. */
export type EscrowView = {
  contractId: string;
  utxoRef: string;
  lockedLovelace: string;
  datum: {
    partyA: string;
    partyB: string;
    arbitrator: string;
    amount: string;
    deadline: string;
    state: "Locked" | "Disputed" | "Resolved";
  };
};

export type ContractLookup = { status: "live"; escrow: EscrowView } | { status: "resolved" | "not-found" };

export type Deployment = { network: string; scriptAddress: string; scriptHash: string; explorer: string };

export type BuiltTx = { txCbor: string; txHash: string; needed: string[] };

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = (await res.json()) as T & { error?: string };
  if (!res.ok || body.error) throw new Error(body.error ?? res.statusText);
  return body;
}

export function postJson<T>(url: string, body: unknown): Promise<T> {
  return api<T>(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

export const ada = (lovelace: string | bigint) =>
  (Number(lovelace) / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 6 });

export const dateTime = (ms: string) => new Date(Number(ms)).toLocaleString("es-AR");

export const short = (s: string) => (s.length > 26 ? `${s.slice(0, 14)}…${s.slice(-8)}` : s);

export const STATE_LABEL: Record<string, string> = {
  Locked: "LOCKED",
  Disputed: "DISPUTED",
  Resolved: "RESOLVED",
};
