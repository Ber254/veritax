/**
 * "Deploys" the Veritax escrow on Cardano Preprod. The validator has no
 * parameters and Cardano scripts need no on-chain publication: escrows are
 * created by locking ADA at the script address. This writes the address and
 * hash of the current `contracts/plutus.json` build to `contracts/deployment.json`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { escrowContract, PREPROD } from "../src/lib/contract.ts";

const contract = escrowContract(PREPROD.network);
const blueprint = JSON.parse(readFileSync(fileURLToPath(new URL("../../contracts/plutus.json", import.meta.url)), "utf8"));
const deployment = {
  network: PREPROD.network,
  koiosUrl: PREPROD.koiosUrl,
  validator: "escrow.escrow.spend",
  plutusVersion: blueprint.preamble.plutusVersion,
  compiler: `${blueprint.preamble.compiler.name} ${blueprint.preamble.compiler.version}`,
  scriptHash: contract.scriptHash,
  scriptAddress: contract.address,
  explorer: `https://preprod.cardanoscan.io/address/${contract.address}`,
  deployedAt: new Date().toISOString(),
};
const file = fileURLToPath(new URL("../../contracts/deployment.json", import.meta.url));
writeFileSync(file, `${JSON.stringify(deployment, null, 2)}\n`);
console.log(`script hash    ${contract.scriptHash}`);
console.log(`script address ${contract.address}`);
console.log(`written        ${file}`);
