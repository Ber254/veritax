import { Koios, Lucid, type LucidEvolution, type Network } from "@lucid-evolution/lucid";
import { escrowContract, type EscrowContract } from "./contract";
import deploymentJson from "../../../contracts/deployment.json" with { type: "json" };

export type DeploymentFile = {
  network: Network;
  koiosUrl: string;
  scriptHash: string;
  scriptAddress: string;
  explorer: string;
  deployedAt: string;
};

export type Deployment = { file: DeploymentFile; contract: EscrowContract };

export function loadDeployment(): Deployment {
  const file = deploymentJson as DeploymentFile;
  if (file.network === "Mainnet") throw new Error("Veritax runs on Preprod only");
  const contract = escrowContract(file.network);
  if (contract.scriptHash !== file.scriptHash) throw new Error("contracts/deployment.json does not match the validator build");
  return { file, contract };
}

export async function lucidFor(d: Deployment, address?: string): Promise<LucidEvolution> {
  const lucid = await Lucid(new Koios(d.file.koiosUrl), d.file.network);
  if (address) lucid.selectWallet.fromAddress(address, await lucid.utxosAt(address));
  return lucid;
}
