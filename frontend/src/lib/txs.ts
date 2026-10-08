import type { LucidEvolution, TxBuilder, TxSignBuilder } from "@lucid-evolution/lucid";
import { MIN_PAYOUT_LOVELACE, paymentKeyHash, VERITAX_METADATA_LABEL, type EscrowContract } from "./contract.ts";
import { encodeDatum, Redeemer, type EscrowDatum } from "./datum.ts";
import type { Escrow } from "./escrows.ts";

export type CreateInput = {
  partyA: string;
  partyB: string;
  arbitrator: string;
  amountLovelace: bigint;
  deadlineMs: bigint;
};

/** Party A locks ADA at the script with state `Locked`. Signed by A (the wallet paying). */
export async function buildCreate(lucid: LucidEvolution, contract: EscrowContract, input: CreateInput): Promise<TxSignBuilder> {
  if (input.amountLovelace < MIN_PAYOUT_LOVELACE) throw new Error("amount too small");
  for (const a of [input.partyA, input.partyB, input.arbitrator]) paymentKeyHash(a);
  const datum: EscrowDatum = {
    partyA: input.partyA,
    partyB: input.partyB,
    arbitrator: input.arbitrator,
    amount: input.amountLovelace,
    deadline: input.deadlineMs,
    state: "Locked",
  };
  return lucid
    .newTx()
    .pay.ToContract(contract.address, { kind: "inline", value: encodeDatum(datum) }, { lovelace: input.amountLovelace })
    .complete();
}

function originMetadata(escrow: Escrow): { origin: string } {
  return { origin: escrow.contractId };
}

/** Party A or B moves the escrow to `Disputed`. */
export async function buildActivateDispute(
  lucid: LucidEvolution,
  contract: EscrowContract,
  escrow: Escrow,
  signer: string,
): Promise<TxSignBuilder> {
  if (escrow.datum.state !== "Locked") throw new Error("the contract is not LOCKED");
  if (signer !== escrow.datum.partyA && signer !== escrow.datum.partyB) {
    throw new Error("only party A or party B can activate the dispute");
  }
  return lucid
    .newTx()
    .collectFrom([escrow.utxo], Redeemer.activateDispute())
    .attach.SpendingValidator(contract.script)
    .pay.ToContract(
      contract.address,
      { kind: "inline", value: encodeDatum({ ...escrow.datum, state: "Disputed" }) },
      escrow.utxo.assets,
    )
    .attachMetadata(VERITAX_METADATA_LABEL, originMetadata(escrow))
    .addSignerKey(paymentKeyHash(signer))
    .complete();
}

function payShare(tx: TxBuilder, address: string, lovelace: bigint): TxBuilder {
  if (lovelace <= 0n) return tx;
  return tx.pay.ToAddress(address, { lovelace: lovelace < MIN_PAYOUT_LOVELACE ? MIN_PAYOUT_LOVELACE : lovelace });
}

function checkSplit(escrow: Escrow, toA: bigint, toB: bigint): void {
  if (toA < 0n || toB < 0n || toA + toB !== escrow.datum.amount) {
    throw new Error("to_a + to_b must equal the locked amount");
  }
}

function buildPayout(
  lucid: LucidEvolution,
  contract: EscrowContract,
  escrow: Escrow,
  redeemer: string,
  toA: bigint,
  toB: bigint,
  signers: string[],
): Promise<TxSignBuilder> {
  let tx = lucid
    .newTx()
    .collectFrom([escrow.utxo], redeemer)
    .attach.SpendingValidator(contract.script)
    .attachMetadata(VERITAX_METADATA_LABEL, originMetadata(escrow));
  if (escrow.datum.partyA === escrow.datum.partyB) {
    tx = payShare(tx, escrow.datum.partyA, toA + toB);
  } else {
    tx = payShare(tx, escrow.datum.partyA, toA);
    tx = payShare(tx, escrow.datum.partyB, toB);
  }
  for (const s of signers) tx = tx.addSignerKey(paymentKeyHash(s));
  return tx.complete();
}

/** The arbitrator splits the disputed funds. */
export async function buildArbitratorRuling(
  lucid: LucidEvolution,
  contract: EscrowContract,
  escrow: Escrow,
  toA: bigint,
  toB: bigint,
): Promise<TxSignBuilder> {
  if (escrow.datum.state !== "Disputed") throw new Error("the contract is not DISPUTED");
  checkSplit(escrow, toA, toB);
  return buildPayout(lucid, contract, escrow, Redeemer.arbitratorRuling(toA, toB), toA, toB, [escrow.datum.arbitrator]);
}

/** Both parties agree on a split (needs A's and B's signatures). */
export async function buildMutualRelease(
  lucid: LucidEvolution,
  contract: EscrowContract,
  escrow: Escrow,
  toA: bigint,
  toB: bigint,
): Promise<TxSignBuilder> {
  if (escrow.datum.state === "Resolved") throw new Error("the contract is already RESOLVED");
  checkSplit(escrow, toA, toB);
  return buildPayout(lucid, contract, escrow, Redeemer.mutualRelease(toA, toB), toA, toB, [
    escrow.datum.partyA,
    escrow.datum.partyB,
  ]);
}
