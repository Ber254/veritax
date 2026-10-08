import Link from "next/link";
import { useCallback, useState, type FormEvent } from "react";
import { ContractCard, StateBadge, TxLink } from "@/components/ContractCard";
import { Layout } from "@/components/Layout";
import { LookupMessage, useContract } from "@/lib/useContract";
import { usePoll } from "@/lib/usePoll";
import { useWallet } from "@/lib/useWallet";

function defaultDeadline(): string {
  const d = new Date(Date.now() + 7 * 86_400_000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function CreatePage() {
  const wallet = useWallet();
  const { lookup, load } = useContract();
  const [partyB, setPartyB] = useState("");
  const [arbitrator, setArbitrator] = useState("");
  const [amountAda, setAmountAda] = useState("10");
  const [deadline, setDeadline] = useState(defaultDeadline);

  const createdHash = wallet.signed?.txHash ?? null;
  const refresh = useCallback(() => {
    if (createdHash) void load(createdHash, wallet.address);
  }, [createdHash, load, wallet.address]);
  usePoll(Boolean(createdHash) && lookup.status !== "live", refresh);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void wallet.buildAndSign("Crear contrato", {
      action: "create",
      partyB,
      arbitrator,
      amountAda: Number(amountAda),
      deadlineMs: new Date(deadline).getTime(),
    });
  };

  return (
    <Layout wallet={wallet} title="Crear contrato">
      <p className="lead">
        Bloqueá ADA en un escrow con una contraparte y un árbitro. Si hay conflicto, cualquiera de las partes activa la disputa y el árbitro decide cómo se reparten los fondos.
      </p>

      {createdHash ? (
        <section className="card">
          <div className="row between">
            <h2>Contrato creado</h2>
            <StateBadge state="Locked" />
          </div>
          <p>
            Hash del contrato: <TxLink hash={createdHash} />
          </p>
          <p className="muted">Compartí este hash con la contraparte y el árbitro.</p>
          <code className="block">{createdHash}</code>
          <div className="row">
            <Link className="button ghost" href={`/dispute?id=${createdHash}`}>
              Ir a disputa
            </Link>
          </div>
          {lookup.status === "live" ? (
            <ContractCard escrow={lookup.escrow} roles={lookup.roles} />
          ) : lookup.status === "error" ? (
            <LookupMessage lookup={lookup} />
          ) : (
            <p className="muted">Esperando confirmación en Preprod…</p>
          )}
        </section>
      ) : (
        <form className="card form" onSubmit={submit}>
          <label>
            Dirección party B (contraparte)
            <input value={partyB} onChange={(e) => setPartyB(e.target.value)} placeholder="addr_test1…" required />
          </label>
          <label>
            Dirección del árbitro
            <input value={arbitrator} onChange={(e) => setArbitrator(e.target.value)} placeholder="addr_test1…" required />
          </label>
          <div className="row">
            <label className="grow">
              Monto (ADA)
              <input type="number" min="2" step="0.000001" value={amountAda} onChange={(e) => setAmountAda(e.target.value)} required />
            </label>
            <label className="grow">
              Deadline
              <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} required />
            </label>
          </div>
          <p className="muted">Party A es la wallet conectada: deposita los fondos y firma la transacción.</p>
          {wallet.address ? (
            <button type="submit" disabled={wallet.busy}>
              {wallet.busy ? "Preparando…" : "Crear contrato"}
            </button>
          ) : (
            <button type="button" onClick={() => void wallet.connect()} disabled={!wallet.ready}>
              Conectar GameChanger Wallet
            </button>
          )}
        </form>
      )}
    </Layout>
  );
}
