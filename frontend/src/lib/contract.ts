import {
  getAddressDetails,
  validatorToAddress,
  validatorToScriptHash,
  type Network,
  type Script,
} from "@lucid-evolution/lucid";
import blueprint from "../../../contracts/plutus.json" with { type: "json" };

export type EscrowContract = {
  network: Network;
  script: Script;
  scriptHash: string;
  address: string;
};

export function escrowContract(network: Network): EscrowContract {
  const validator = blueprint.validators.find((v) => v.title === "escrow.escrow.spend");
  if (!validator) throw new Error("escrow validator missing from contracts/plutus.json");
  const script: Script = { type: "PlutusV3", script: validator.compiledCode };
  return {
    network,
    script,
    scriptHash: validatorToScriptHash(script),
    address: validatorToAddress(network, script),
  };
}

export function paymentKeyHash(address: string): string {
  const cred = getAddressDetails(address).paymentCredential;
  if (!cred || cred.type !== "Key") throw new Error(`${address} is not a key address`);
  return cred.hash;
}

/** Metadata label carrying the hash of the transaction that created the escrow. */
export const VERITAX_METADATA_LABEL = 8484;

/** Lovelace floor for payout outputs so they always satisfy min-UTxO. */
export const MIN_PAYOUT_LOVELACE = 1_500_000n;

export const PREPROD = { network: "Preprod" as Network, koiosUrl: "https://preprod.koios.rest/api/v1" };
