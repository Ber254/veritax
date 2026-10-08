import { CML } from "@lucid-evolution/lucid";

/** A verified vkey witness packaged as a one-element witness set (CBOR hex). */
export type KeyWitness = { pkh: string; witnessSet: string };

export function txHashOf(txCbor: string): string {
  return CML.hash_transaction(CML.Transaction.from_cbor_hex(txCbor).body()).to_hex();
}

/** Key hashes listed in the tx body `required_signers` field. */
export function requiredSigners(txCbor: string): string[] {
  const list = CML.Transaction.from_cbor_hex(txCbor).body().required_signers();
  const out: string[] = [];
  for (let i = 0; list && i < list.len(); i++) out.push(list.get(i).to_hex());
  return out;
}

function hexStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") {
    if (value.length >= 64 && value.length % 2 === 0 && /^[0-9a-f]+$/i.test(value)) out.push(value);
  } else if (Array.isArray(value)) {
    for (const v of value) hexStrings(v, out);
  } else if (value && typeof value === "object") {
    for (const v of Object.values(value)) hexStrings(v, out);
  }
  return out;
}

function vkeyWitnessesOf(hex: string): CML.VkeywitnessList | undefined {
  try {
    return CML.Transaction.from_cbor_hex(hex).witness_set().vkeywitnesses();
  } catch {
    try {
      return CML.TransactionWitnessSet.from_cbor_hex(hex).vkeywitnesses();
    } catch {
      return undefined;
    }
  }
}

/**
 * Extracts every vkey witness that validly signs `txCbor` from an arbitrary
 * wallet response (e.g. a decoded GameChanger `signTxs` export, which may
 * carry signed transactions or witness-set "signature packages").
 */
export function extractKeyWitnesses(txCbor: string, response: unknown): KeyWitness[] {
  const hash = CML.TransactionHash.from_hex(txHashOf(txCbor)).to_raw_bytes();
  const found = new Map<string, KeyWitness>();
  for (const hex of hexStrings(response)) {
    const list = vkeyWitnessesOf(hex);
    for (let i = 0; list && i < list.len(); i++) {
      const w = list.get(i);
      if (!w.vkey().verify(hash, w.ed25519_signature())) continue;
      const pkh = w.vkey().hash().to_hex();
      const single = CML.VkeywitnessList.new();
      single.add(w);
      const set = CML.TransactionWitnessSet.new();
      set.set_vkeywitnesses(single);
      found.set(pkh, { pkh, witnessSet: set.to_cbor_hex() });
    }
  }
  return [...found.values()];
}
