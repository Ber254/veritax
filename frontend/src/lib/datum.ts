import {
  Constr,
  credentialToAddress,
  Data,
  getAddressDetails,
  type Credential,
  type Network,
} from "@lucid-evolution/lucid";

export type EscrowState = "Locked" | "Disputed" | "Resolved";

const STATES: EscrowState[] = ["Locked", "Disputed", "Resolved"];

/** Mirrors `escrow.EscrowDatum`. Addresses are bech32, amount in lovelace, deadline in POSIX ms. */
export type EscrowDatum = {
  partyA: string;
  partyB: string;
  arbitrator: string;
  amount: bigint;
  deadline: bigint;
  state: EscrowState;
};

function credentialToData(c: Credential): Constr<Data> {
  return new Constr(c.type === "Key" ? 0 : 1, [c.hash]);
}

function credentialFromData(d: Data): Credential {
  if (!(d instanceof Constr) || typeof d.fields[0] !== "string") throw new Error("invalid credential");
  return { type: d.index === 0 ? "Key" : "Script", hash: d.fields[0] };
}

/** Bech32 address → Plutus `Address` data (no pointer addresses). */
export function addressToData(address: string): Constr<Data> {
  const { paymentCredential, stakeCredential } = getAddressDetails(address);
  if (!paymentCredential) throw new Error(`${address} has no payment credential`);
  const stake = stakeCredential
    ? new Constr(0, [new Constr(0, [credentialToData(stakeCredential)])])
    : new Constr(1, []);
  return new Constr(0, [credentialToData(paymentCredential), stake]);
}

export function addressFromData(network: Network, d: Data): string {
  if (!(d instanceof Constr) || d.fields.length !== 2) throw new Error("invalid address");
  const payment = credentialFromData(d.fields[0] as Data);
  const stakeOpt = d.fields[1];
  if (!(stakeOpt instanceof Constr)) throw new Error("invalid stake credential");
  if (stakeOpt.index === 1) return credentialToAddress(network, payment);
  const referenced = stakeOpt.fields[0];
  if (!(referenced instanceof Constr) || referenced.index !== 0) throw new Error("pointer addresses are not supported");
  return credentialToAddress(network, payment, credentialFromData(referenced.fields[0] as Data));
}

export function encodeDatum(d: EscrowDatum): string {
  return Data.to(
    new Constr(0, [
      addressToData(d.partyA),
      addressToData(d.partyB),
      addressToData(d.arbitrator),
      d.amount,
      d.deadline,
      new Constr(STATES.indexOf(d.state), []),
    ]),
  );
}

function asInt(d: Data | undefined): bigint {
  if (typeof d !== "bigint") throw new Error("expected integer");
  return d;
}

export function decodeDatum(network: Network, cbor: string): EscrowDatum {
  const data = Data.from(cbor);
  if (!(data instanceof Constr) || data.index !== 0 || data.fields.length !== 6) throw new Error("not a Veritax datum");
  const [a, b, arb, amount, deadline, state] = data.fields;
  if (!(state instanceof Constr) || !STATES[state.index]) throw new Error("invalid state");
  return {
    partyA: addressFromData(network, a as Data),
    partyB: addressFromData(network, b as Data),
    arbitrator: addressFromData(network, arb as Data),
    amount: asInt(amount),
    deadline: asInt(deadline),
    state: STATES[state.index] as EscrowState,
  };
}

/** Mirrors `escrow.Action`. */
export const Redeemer = {
  mutualRelease: (toA: bigint, toB: bigint) => Data.to(new Constr(0, [toA, toB])),
  activateDispute: () => Data.to(new Constr(1, [])),
  arbitratorRuling: (toA: bigint, toB: bigint) => Data.to(new Constr(2, [toA, toB])),
};

/** Splits `amount` by a percentage for A (0–100); B gets the remainder so both add up exactly. */
export function splitByPercent(amount: bigint, percentA: number): { toA: bigint; toB: bigint } {
  if (!Number.isInteger(percentA) || percentA < 0 || percentA > 100) throw new Error("percentage must be an integer between 0 and 100");
  const toA = (amount * BigInt(percentA)) / 100n;
  return { toA, toB: amount - toA };
}
