import type { NextApiRequest, NextApiResponse } from "next";
import { paymentKeyHash } from "@/lib/contract";
import { findEscrow, isTxHash, koiosOrigins } from "@/lib/escrows";
import { sendError, sendJson } from "@/lib/json";
import { loadDeployment, lucidFor } from "@/lib/server";
import { escrowView, rolesOf } from "@/lib/views";

async function txExists(koiosUrl: string, txHash: string): Promise<boolean> {
  const res = await fetch(`${koiosUrl}/tx_info`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ _tx_hashes: [txHash] }),
  });
  if (!res.ok) throw new Error(`Koios tx_info failed: ${res.status}`);
  return ((await res.json()) as unknown[]).length > 0;
}

/** GET /api/contract?id=<creation tx hash>&address=<connected wallet> */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const id = String(req.query.id ?? "").trim().toLowerCase();
    if (!isTxHash(id)) throw new Error("Hash de contrato inválido (64 caracteres hex).");
    const d = loadDeployment();
    const lucid = await lucidFor(d);
    const escrow = await findEscrow(lucid, d.contract, id, koiosOrigins(d.file.koiosUrl));
    if (!escrow) {
      return sendJson(res, { status: (await txExists(d.file.koiosUrl, id)) ? "resolved" : "not-found" });
    }
    const address = typeof req.query.address === "string" ? req.query.address : "";
    let roles: string[] = [];
    try {
      if (address) roles = rolesOf(escrow.datum, paymentKeyHash(address));
    } catch {
      roles = [];
    }
    sendJson(res, { status: "live", escrow: escrowView(escrow), roles });
  } catch (err) {
    sendError(res, err);
  }
}
