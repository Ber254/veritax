import { useState, type FormEvent } from "react";

export function HashForm({ initial, onSubmit, busy }: { initial: string; onSubmit: (id: string) => void; busy: boolean }) {
  const [id, setId] = useState(initial);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(id.trim().toLowerCase());
  };
  return (
    <form className="card row" onSubmit={submit}>
      <label className="grow">
        Hash del contrato
        <input value={id} onChange={(e) => setId(e.target.value)} placeholder="hash de la tx que creó el contrato" required pattern="[0-9a-fA-F]{64}" />
      </label>
      <button type="submit" disabled={busy}>
        Buscar
      </button>
    </form>
  );
}
