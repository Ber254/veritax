import type { NextApiRequest, NextApiResponse } from "next";
import { sendError, sendJson } from "@/lib/json";
import { loadDeployment, lucidFor } from "@/lib/server";
import { extractKeyWitnesses, txHashOf } from "@/lib/witnesses";

/**
 * POST /api/submit { txCbor, needed, response } — adds the signatures found in
 * the decoded GameChanger response and submits the tx to Preprod.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return sendError(res, new Error("POST only"), 405);
  try {
    const { txCbor, needed, response } = req.body as { txCbor: string; needed: string[]; response: unknown };
    const witnesses = extractKeyWitnesses(txCbor, response);
    const missing = (needed ?? []).filter((pkh) => !witnesses.some((w) => w.pkh === pkh));
    if (witnesses.length === 0 || missing.length > 0) {
      throw new Error("La respuesta de GameChanger no trae la firma de la wallet requerida.");
    }
    const lucid = await lucidFor(loadDeployment());
    const signed = await lucid
      .fromTx(txCbor)
      .assemble(witnesses.map((w) => w.witnessSet))
      .complete();
    const submitted = await signed.submit();
    sendJson(res, { txHash: submitted || txHashOf(txCbor) });
  } catch (err) {
    sendError(res, err);
  }
}
