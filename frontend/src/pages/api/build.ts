import type { NextApiRequest, NextApiResponse } from "next";
import type { TxSignBuilder } from "@lucid-evolution/lucid";
import { paymentKeyHash } from "@/lib/contract";
import { splitByPercent } from "@/lib/datum";
import { findEscrow, koiosOrigins } from "@/lib/escrows";
import { sendError, sendJson } from "@/lib/json";
import { loadDeployment, lucidFor } from "@/lib/server";
import { buildActivateDispute, buildArbitratorRuling, buildCreate } from "@/lib/txs";
import { requiredSigners, txHashOf } from "@/lib/witnesses";

export type BuildRequest =
  | { action: "create"; address: string; partyB: string; arbitrator: string; amountAda: number; deadlineMs: number }
  | { action: "dispute"; address: string; id: string }
  | { action: "ruling"; address: string; id: string; percentA: number };

function lovelace(ada: number): bigint {
  if (!Number.isFinite(ada) || ada <= 0) throw new Error("Monto en ADA inválido.");
  return BigInt(Math.round(ada * 1_000_000));
}

/** POST /api/build → unsigned tx (CBOR) for the connected wallet to sign with GameChanger. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return sendError(res, new Error("POST only"), 405);
  try {
    const body = req.body as BuildRequest;
    const d = loadDeployment();
    const lucid = await lucidFor(d, body.address);
    let tx: TxSignBuilder;
    if (body.action === "create") {
      if (!Number.isFinite(body.deadlineMs) || body.deadlineMs <= Date.now()) throw new Error("El deadline debe ser futuro.");
      tx = await buildCreate(lucid, d.contract, {
        partyA: body.address,
        partyB: body.partyB.trim(),
        arbitrator: body.arbitrator.trim(),
        amountLovelace: lovelace(body.amountAda),
        deadlineMs: BigInt(Math.floor(body.deadlineMs)),
      });
    } else {
      const escrow = await findEscrow(lucid, d.contract, body.id.trim().toLowerCase(), koiosOrigins(d.file.koiosUrl));
      if (!escrow) throw new Error("No hay un contrato activo con ese hash.");
      if (body.action === "dispute") {
        const me = paymentKeyHash(body.address);
        const signer = [escrow.datum.partyA, escrow.datum.partyB].find((a) => paymentKeyHash(a) === me);
        if (!signer) throw new Error("Solo party A o party B pueden activar la disputa.");
        tx = await buildActivateDispute(lucid, d.contract, escrow, signer);
      } else {
        if (paymentKeyHash(escrow.datum.arbitrator) !== paymentKeyHash(body.address)) {
          throw new Error("Solo el árbitro puede emitir el fallo.");
        }
        const { toA, toB } = splitByPercent(escrow.datum.amount, body.percentA);
        tx = await buildArbitratorRuling(lucid, d.contract, escrow, toA, toB);
      }
    }
    const txCbor = tx.toCBOR();
    sendJson(res, {
      txCbor,
      txHash: txHashOf(txCbor),
      needed: [...new Set([...requiredSigners(txCbor), paymentKeyHash(body.address)])],
    });
  } catch (err) {
    sendError(res, err);
  }
}
