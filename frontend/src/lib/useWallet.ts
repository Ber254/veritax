import { useCallback, useEffect, useState } from "react";
import { api, postJson, type BuiltTx, type Deployment } from "./api";
import { connectScript, decodeMessage, findAddress, returnUrl, signScript, walletUrl } from "./gamechanger";

const ADDRESS_KEY = "veritax.address";
const txKey = (id: string) => `veritax.tx.${id}`;
const RETURN_KEY = "veritax.return";

type ReturnContext = Record<string, string> & { op: "connect" | "sign" };

function expectReturn(ctx: ReturnContext): string {
  window.localStorage.setItem(RETURN_KEY, JSON.stringify(ctx));
  return returnUrl();
}

export type Notice = { kind: "ok" | "error"; text: string } | null;

export type SignReturn = { txHash: string; params: Record<string, string> };

/**
 * GameChanger connection + signing. The wallet redirects back to the page with
 * `?result=...`; the pending op and unsigned tx wait in localStorage meanwhile.
 */
export function useWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [deployment, setDeployment] = useState<Deployment | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [signed, setSigned] = useState<SignReturn | null>(null);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState<Record<string, string>>({});

  const fail = useCallback((err: unknown) => {
    setNotice({ kind: "error", text: err instanceof Error ? err.message : String(err) });
    setBusy(false);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("result");
    const stash = result ? window.localStorage.getItem(RETURN_KEY) : null;
    window.localStorage.removeItem(RETURN_KEY);
    const ctx: Record<string, string> = stash ? (JSON.parse(stash) as Record<string, string>) : {};
    const op = ctx.op ?? null;
    const initial: Record<string, string> = {};
    params.forEach((v, k) => {
      if (k !== "result") initial[k] = v;
    });
    window.history.replaceState(null, "", window.location.pathname);
    void (async () => {
      let addr = window.localStorage.getItem(ADDRESS_KEY);
      try {
        setDeployment(await api<Deployment>("/api/config"));
        if (op === "connect" && result) {
          addr = findAddress(await decodeMessage(result));
          if (!addr) throw new Error("GameChanger no devolvió una dirección.");
          if (!addr.startsWith("addr_test1")) throw new Error("Conectá GameChanger en Preprod (dirección addr_test1…).");
          window.localStorage.setItem(ADDRESS_KEY, addr);
          setNotice({ kind: "ok", text: "Wallet conectada." });
        }
        const id = ctx.id;
        if (op === "sign" && id && result) {
          const stored = window.localStorage.getItem(txKey(id));
          if (!stored) throw new Error("No se encontró la transacción pendiente en este navegador.");
          const tx = JSON.parse(stored) as BuiltTx;
          setBusy(true);
          const out = await postJson<{ txHash: string }>("/api/submit", {
            txCbor: tx.txCbor,
            needed: tx.needed,
            response: await decodeMessage(result),
          });
          window.localStorage.removeItem(txKey(id));
          const rest: Record<string, string> = {};
          for (const [k, v] of Object.entries(ctx)) if (!["op", "id"].includes(k)) rest[k] = v;
          setSigned({ txHash: out.txHash, params: rest });
          setNotice({ kind: "ok", text: "Transacción enviada a Cardano Preprod." });
          setBusy(false);
        }
      } catch (err) {
        fail(err);
      }
      setAddress(addr);
      setQuery(initial);
      setReady(true);
    })();
  }, [fail]);

  const connect = useCallback(async () => {
    window.location.assign(await walletUrl(connectScript(expectReturn({ op: "connect" })), "preprod"));
  }, []);

  const disconnect = useCallback(() => {
    window.localStorage.removeItem(ADDRESS_KEY);
    setAddress(null);
  }, []);

  /** Builds the tx on the server and sends the user to GameChanger to sign it. */
  const buildAndSign = useCallback(
    async (title: string, body: Record<string, unknown>, extra: Record<string, string> = {}) => {
      if (!address) return;
      setBusy(true);
      setNotice(null);
      try {
        const tx = await postJson<BuiltTx>("/api/build", { ...body, address });
        window.localStorage.setItem(txKey(tx.txHash), JSON.stringify(tx));
        window.location.assign(await walletUrl(signScript(title, tx.txCbor, expectReturn({ ...extra, op: "sign", id: tx.txHash })), "preprod"));
      } catch (err) {
        fail(err);
      }
    },
    [address, fail],
  );

  return { address, deployment, query, notice, setNotice, busy, signed, ready, connect, disconnect, buildAndSign, fail };
}

export type Wallet = ReturnType<typeof useWallet>;
