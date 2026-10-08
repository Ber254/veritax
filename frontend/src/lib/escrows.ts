import type { LucidEvolution, UTxO } from "@lucid-evolution/lucid";
import { VERITAX_METADATA_LABEL, type EscrowContract } from "./contract.ts";
import { decodeDatum, type EscrowDatum } from "./datum.ts";

/** A live escrow UTxO. `contractId` is the hash of the transaction that created it. */
export type Escrow = {
  contractId: string;
  utxo: UTxO;
  datum: EscrowDatum;
};

/** Returns the `origin` (creation tx hash) recorded in each tx's Veritax metadata. */
export type OriginLookup = (txHashes: string[]) => Promise<Record<string, string>>;

export function koiosOrigins(koiosUrl: string): OriginLookup {
  return async (txHashes) => {
    if (txHashes.length === 0) return {};
    const res = await fetch(`${koiosUrl}/tx_metadata`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ _tx_hashes: txHashes }),
    });
    if (!res.ok) throw new Error(`Koios tx_metadata failed: ${res.status}`);
    const rows = (await res.json()) as Array<{ tx_hash: string; metadata: Record<string, unknown> | null }>;
    const out: Record<string, string> = {};
    for (const row of rows) {
      const meta = row.metadata?.[String(VERITAX_METADATA_LABEL)] as { origin?: unknown } | undefined;
      if (typeof meta?.origin === "string") out[row.tx_hash] = meta.origin;
    }
    return out;
  };
}

export function isTxHash(s: string): boolean {
  return /^[0-9a-f]{64}$/.test(s);
}

/**
 * Finds the live UTxO of the escrow created by `contractId`: either the
 * creation output itself or a later output (e.g. after `ActivateDispute`)
 * whose tx metadata points back to it.
 */
export async function findEscrow(
  lucid: LucidEvolution,
  contract: EscrowContract,
  contractId: string,
  origins: OriginLookup,
): Promise<Escrow | null> {
  if (!isTxHash(contractId)) throw new Error("invalid contract hash");
  const utxos = (await lucid.utxosAt(contract.address)).filter((u) => u.datum);
  let match = utxos.find((u) => u.txHash === contractId);
  if (!match) {
    const others = [...new Set(utxos.map((u) => u.txHash))];
    const byTx = await origins(others);
    match = utxos.find((u) => byTx[u.txHash] === contractId);
  }
  if (!match?.datum) return null;
  return { contractId, utxo: match, datum: decodeDatum(contract.network, match.datum) };
}
