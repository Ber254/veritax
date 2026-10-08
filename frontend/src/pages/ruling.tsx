import { useCallback, useEffect, useState } from "react";
import { ContractCard, TxLink } from "@/components/ContractCard";
import { HashForm } from "@/components/HashForm";
import { Layout } from "@/components/Layout";
import { ada } from "@/lib/api";
import { LookupMessage, useContract } from "@/lib/useContract";
import { usePoll } from "@/lib/usePoll";
import { useWallet } from "@/lib/useWallet";

export default function RulingPage() {
  const wallet = useWallet();
  const { lookup, load } = useContract();
  const [typedId, setId] = useState<string | null>(null);
  const initialId = wallet.signed?.params.cid ?? wallet.query.id ?? "";
  const id = typedId ?? initialId;
  const [pctA, setPctA] = useState("50");
  const [pctB, setPctB] = useState("50");
  const sentHash = wallet.signed?.txHash ?? null;

  useEffect(() => {
    if (wallet.ready && initialId) void load(initialId, wallet.address);
  }, [wallet.ready, initialId, wallet.address, load]);

  const refresh = useCallback(() => {
    if (id) void load(id, wallet.address);
  }, [id, load, wallet.address]);
  usePoll(Boolean(sentHash) && lookup.status === "live", refresh);

  const live = lookup.status === "live" ? lookup : null;
  const a = Number(pctA);
  const b = Number(pctB);
  const valid = Number.isInteger(a) && Number.isInteger(b) && a >= 0 && b >= 0 && a + b === 100;
  const amount = live ? BigInt(live.escrow.datum.amount) : 0n;
  const toA = valid ? (amount * BigInt(a)) / 100n : 0n;
  const toB = valid ? amount - toA : 0n;

  return (
    <Layout wallet={wallet} title="Fallo del árbitro">
      <p className="lead">El árbitro reparte los fondos de un contrato DISPUTED entre party A y party B.</p>
      <HashForm
        key={id}
        initial={id}
        busy={lookup.status === "loading"}
        onSubmit={(v) => {
          setId(v);
          void load(v, wallet.address);
        }}
      />
      {sentHash && (
        <p className="notice ok">
          Fallo enviado: <TxLink hash={sentHash} />
          {lookup.status === "live" && " — esperando confirmación…"}
        </p>
      )}
      <LookupMessage lookup={lookup} />
      {live && (
        <>
          <ContractCard escrow={live.escrow} roles={live.roles} />
          {live.escrow.datum.state === "Locked" && <p className="notice error">El contrato está LOCKED: primero una de las partes tiene que activar la disputa.</p>}
          {live.escrow.datum.state === "Disputed" && (
            <section className="card form">
              <h2>Reparto</h2>
              <div className="row">
                <label className="grow">
                  Party A (%)
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={pctA}
                    onChange={(e) => {
                      setPctA(e.target.value);
                      if (e.target.value !== "") setPctB(String(100 - Number(e.target.value)));
                    }}
                  />
                </label>
                <label className="grow">
                  Party B (%)
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={pctB}
                    onChange={(e) => {
                      setPctB(e.target.value);
                      if (e.target.value !== "") setPctA(String(100 - Number(e.target.value)));
                    }}
                  />
                </label>
              </div>
              {valid ? (
                <p className="muted">
                  Party A recibe {ada(toA)} ADA · Party B recibe {ada(toB)} ADA
                </p>
              ) : (
                <p className="notice error">Los porcentajes tienen que ser enteros y sumar 100%.</p>
              )}
              {!wallet.address ? (
                <button onClick={() => void wallet.connect()}>Conectar GameChanger Wallet</button>
              ) : live.roles.includes("arbitrator") ? (
                <button
                  disabled={!valid || wallet.busy}
                  onClick={() => void wallet.buildAndSign("Emitir fallo", { action: "ruling", id, percentA: a }, { cid: id })}
                >
                  {wallet.busy ? "Preparando…" : "Emitir fallo"}
                </button>
              ) : (
                <p className="muted">Solo el árbitro de este contrato puede emitir el fallo.</p>
              )}
            </section>
          )}
        </>
      )}
    </Layout>
  );
}
