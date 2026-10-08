import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
  Emulator,
  generateEmulatorAccount,
  Lucid,
  walletFromSeed,
  type EmulatorAccount,
  type LucidEvolution,
  type TxSignBuilder,
} from "@lucid-evolution/lucid";
import { escrowContract, type EscrowContract } from "./contract.ts";
import { decodeDatum, encodeDatum, splitByPercent, type EscrowDatum } from "./datum.ts";
import { findEscrow, type Escrow, type OriginLookup } from "./escrows.ts";
import { extractKeyWitnesses, requiredSigners } from "./witnesses.ts";
import { buildActivateDispute, buildArbitratorRuling, buildCreate, buildMutualRelease } from "./txs.ts";

const ADA = 1_000_000n;
const AMOUNT = 100n * ADA;

let emulator: Emulator;
let lucid: LucidEvolution;
let contract: EscrowContract;
let A: EmulatorAccount;
let B: EmulatorAccount;
let arb: EmulatorAccount;
let other: EmulatorAccount;
const origins = new Map<string, string>();
const lookup: OriginLookup = async (hashes) =>
  Object.fromEntries(hashes.flatMap((h) => (origins.has(h) ? [[h, origins.get(h) as string]] : [])));

function key(acc: EmulatorAccount): string {
  return walletFromSeed(acc.seedPhrase, { network: "Custom" }).paymentKey;
}

async function submit(tx: TxSignBuilder, ...signers: EmulatorAccount[]): Promise<string> {
  const witnesses = await Promise.all(signers.map((s) => tx.partialSign.withPrivateKey(key(s))));
  const hash = await (await tx.assemble(witnesses).complete()).submit();
  emulator.awaitBlock(1);
  return hash;
}

async function balance(address: string): Promise<bigint> {
  return (await lucid.utxosAt(address)).reduce((s, u) => s + (u.assets.lovelace ?? 0n), 0n);
}

async function create(): Promise<Escrow> {
  lucid.selectWallet.fromSeed(A.seedPhrase);
  const id = await submit(
    await buildCreate(lucid, contract, {
      partyA: A.address,
      partyB: B.address,
      arbitrator: arb.address,
      amountLovelace: AMOUNT,
      deadlineMs: BigInt(emulator.now() + 86_400_000),
    }),
    A,
  );
  const escrow = await findEscrow(lucid, contract, id, lookup);
  assert.ok(escrow);
  return escrow;
}

async function dispute(escrow: Escrow, by: EmulatorAccount): Promise<Escrow> {
  lucid.selectWallet.fromSeed(by.seedPhrase);
  const hash = await submit(await buildActivateDispute(lucid, contract, escrow, by.address), by);
  origins.set(hash, escrow.contractId);
  const next = await findEscrow(lucid, contract, escrow.contractId, lookup);
  assert.ok(next);
  return next;
}

beforeEach(async () => {
  A = generateEmulatorAccount({ lovelace: 1_000n * ADA });
  B = generateEmulatorAccount({ lovelace: 100n * ADA });
  arb = generateEmulatorAccount({ lovelace: 100n * ADA });
  other = generateEmulatorAccount({ lovelace: 100n * ADA });
  emulator = new Emulator([A, B, arb, other]);
  lucid = await Lucid(emulator, "Custom");
  contract = escrowContract("Custom");
  origins.clear();
});

describe("datum", () => {
  it("round-trips base addresses", () => {
    const d: EscrowDatum = {
      partyA: A.address,
      partyB: B.address,
      arbitrator: arb.address,
      amount: AMOUNT,
      deadline: 1_800_000_000_000n,
      state: "Disputed",
    };
    assert.deepEqual(decodeDatum("Custom", encodeDatum(d)), d);
  });

  it("splits by percentage without losing lovelace", () => {
    assert.deepEqual(splitByPercent(100_000_001n, 33), { toA: 33_000_000n, toB: 67_000_001n });
    assert.throws(() => splitByPercent(AMOUNT, 101));
  });
});

describe("escrow flow", () => {
  it("create locks the amount with state Locked", async () => {
    const escrow = await create();
    assert.equal(escrow.datum.state, "Locked");
    assert.equal(escrow.utxo.assets.lovelace, AMOUNT);
    assert.equal(escrow.datum.arbitrator, arb.address);
  });

  it("LOCKED → DISPUTED → arbitrator ruling pays 30/70", async () => {
    const disputed = await dispute(await create(), B);
    assert.equal(disputed.datum.state, "Disputed");
    const [beforeA, beforeB] = [await balance(A.address), await balance(B.address)];
    const { toA, toB } = splitByPercent(disputed.datum.amount, 30);
    lucid.selectWallet.fromSeed(arb.seedPhrase);
    await submit(await buildArbitratorRuling(lucid, contract, disputed, toA, toB), arb);
    assert.equal((await balance(A.address)) - beforeA, 30n * ADA);
    assert.equal((await balance(B.address)) - beforeB, 70n * ADA);
    assert.equal(await findEscrow(lucid, contract, disputed.contractId, lookup), null);
  });

  it("party A can activate the dispute too", async () => {
    const disputed = await dispute(await create(), A);
    assert.equal(disputed.datum.state, "Disputed");
  });

  it("an outsider cannot activate the dispute", async () => {
    const escrow = await create();
    lucid.selectWallet.fromSeed(other.seedPhrase);
    await assert.rejects(buildActivateDispute(lucid, contract, escrow, other.address));
  });

  it("the ruling cannot be signed by someone other than the arbitrator", async () => {
    const disputed = await dispute(await create(), A);
    lucid.selectWallet.fromSeed(arb.seedPhrase);
    const tx = await buildArbitratorRuling(lucid, contract, disputed, 50n * ADA, 50n * ADA);
    await assert.rejects(tx.assemble([await tx.partialSign.withPrivateKey(key(A))]).complete().then((s) => s.submit()));
  });

  it("the arbitrator cannot rule while LOCKED", async () => {
    const escrow = await create();
    lucid.selectWallet.fromSeed(arb.seedPhrase);
    await assert.rejects(buildArbitratorRuling(lucid, contract, escrow, 50n * ADA, 50n * ADA));
  });

  it("mutual release needs A + B and pays the agreed split", async () => {
    const escrow = await create();
    lucid.selectWallet.fromSeed(B.seedPhrase);
    const beforeB = await balance(B.address);
    const tx = await buildMutualRelease(lucid, contract, escrow, 40n * ADA, 60n * ADA);
    assert.equal(requiredSigners(tx.toCBOR()).length, 2);
    const witnessA = await tx.partialSign.withPrivateKey(key(A));
    assert.equal(extractKeyWitnesses(tx.toCBOR(), { sig: witnessA }).length, 1);
    await submit(tx, A, B);
    assert.ok((await balance(B.address)) - beforeB > 59n * ADA);
  });
});
