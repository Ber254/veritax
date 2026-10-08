import { ada, dateTime, short, STATE_LABEL, type EscrowView } from "@/lib/api";

export function TxLink({ hash }: { hash: string }) {
  return (
    <a href={`https://preprod.cardanoscan.io/transaction/${hash}`} target="_blank" rel="noreferrer">
      <code>{short(hash)}</code>
    </a>
  );
}

export function StateBadge({ state }: { state: string }) {
  return <span className={`badge ${state.toLowerCase()}`}>{STATE_LABEL[state] ?? state}</span>;
}

export function ContractCard({ escrow, roles }: { escrow: EscrowView; roles: string[] }) {
  const d = escrow.datum;
  const mismatch = escrow.lockedLovelace !== d.amount;
  return (
    <section className="card">
      <div className="row between">
        <h2>Contrato</h2>
        <StateBadge state={d.state} />
      </div>
      <dl className="grid">
        <dt>Hash</dt>
        <dd>
          <TxLink hash={escrow.contractId} />
        </dd>
        <dt>Party A</dt>
        <dd>
          <code title={d.partyA}>{short(d.partyA)}</code> {roles.includes("A") && <em>(vos)</em>}
        </dd>
        <dt>Party B</dt>
        <dd>
          <code title={d.partyB}>{short(d.partyB)}</code> {roles.includes("B") && <em>(vos)</em>}
        </dd>
        <dt>Árbitro</dt>
        <dd>
          <code title={d.arbitrator}>{short(d.arbitrator)}</code> {roles.includes("arbitrator") && <em>(vos)</em>}
        </dd>
        <dt>Monto</dt>
        <dd>{ada(d.amount)} ADA</dd>
        <dt>Deadline</dt>
        <dd>{dateTime(d.deadline)}</dd>
        <dt>UTxO</dt>
        <dd>
          <TxLink hash={escrow.utxoRef.split("#")[0] ?? ""} />
        </dd>
      </dl>
      {mismatch && <p className="notice error">El UTxO tiene {ada(escrow.lockedLovelace)} ADA y el datum dice {ada(d.amount)} ADA.</p>}
    </section>
  );
}
