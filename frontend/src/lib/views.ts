import { paymentKeyHash } from "./contract";
import type { EscrowDatum } from "./datum";
import type { Escrow } from "./escrows";

export function escrowView(e: Escrow) {
  return {
    contractId: e.contractId,
    utxoRef: `${e.utxo.txHash}#${e.utxo.outputIndex}`,
    lockedLovelace: (e.utxo.assets.lovelace ?? 0n).toString(),
    datum: { ...e.datum, amount: e.datum.amount.toString(), deadline: e.datum.deadline.toString() },
  };
}

export function rolesOf(d: EscrowDatum, pkh: string): string[] {
  const roles: string[] = [];
  if (paymentKeyHash(d.partyA) === pkh) roles.push("A");
  if (paymentKeyHash(d.partyB) === pkh) roles.push("B");
  if (paymentKeyHash(d.arbitrator) === pkh) roles.push("arbitrator");
  return roles;
}
