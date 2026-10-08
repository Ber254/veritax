import { useCallback, useEffect, useState } from "react";
import { ContractCard, TxLink } from "@/components/ContractCard";
import { HashForm } from "@/components/HashForm";
import { Layout } from "@/components/Layout";
import { LookupMessage, useContract } from "@/lib/useContract";
import { usePoll } from "@/lib/usePoll";
import { useWallet } from "@/lib/useWallet";

export default function DisputePage() {
  const wallet = useWallet();
  const { lookup, load } = useContract();
  const [typedId, setId] = useState<string | null>(null);
  const initialId = wallet.signed?.params.cid ?? wallet.query.id ?? "";
  const id = typedId ?? initialId;
  const sentHash = wallet.signed?.txHash ?? null;

  useEffect(() => {
    if (wallet.ready && initialId) void load(initialId, wallet.address);
  }, [wallet.ready, initialId, wallet.address, load]);

  const refresh = useCallback(() => {
    if (id) void load(id, wallet.address);
  }, [id, load, wallet.address]);
  const waiting = Boolean(sentHash) && !(lookup.status === "live" && lookup.escrow.datum.state === "Disputed");
  usePoll(waiting, refresh);

  const live = lookup.status === "live" ? lookup : null;
  const isParty = live ? live.roles.includes("A") || live.roles.includes("B") : false;

  return (
    <Layout wallet={wallet} title="Activar disputa">
      <p className="lead">Party A o party B pueden pasar un contrato LOCKED a DISPUTED. Desde ahí, solo el árbitro puede liberar los fondos.</p>
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
          Disputa enviada: <TxLink hash={sentHash} />
          {waiting && " — esperando confirmación…"}
        </p>
      )}
      <LookupMessage lookup={lookup} />
      {live && (
        <>
          <ContractCard escrow={live.escrow} roles={live.roles} />
          {live.escrow.datum.state === "Locked" && (
            <section className="card">
              {!wallet.address ? (
                <button onClick={() => void wallet.connect()}>Conectar GameChanger Wallet</button>
              ) : isParty ? (
                <button
                  className="danger"
                  disabled={wallet.busy}
                  onClick={() => void wallet.buildAndSign("Activar disputa", { action: "dispute", id }, { cid: id })}
                >
                  {wallet.busy ? "Preparando…" : "Activar disputa"}
                </button>
              ) : (
                <p className="muted">La wallet conectada no es party A ni party B de este contrato.</p>
              )}
            </section>
          )}
          {live.escrow.datum.state === "Disputed" && <p className="notice ok">Contrato en disputa: esperando el fallo del árbitro.</p>}
        </>
      )}
    </Layout>
  );
}
