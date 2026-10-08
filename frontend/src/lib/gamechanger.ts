/**
 * GameChanger Wallet Universal Dapp Connector (UDC) helpers.
 *
 * The dapp packs a GCScript (JSON) into a wallet URL, the user approves it in
 * the wallet, and the wallet redirects back to `returnURLPattern` with the
 * packed result. Message format: "1-" + base64url(gzip(JSON)).
 * https://gamechangerfinance.github.io/gamechanger.wallet/docs/universal-dapp-connector/overview.html
 */

export const GC_WALLET_URL = "https://wallet.gamechanger.finance/api/2/run/";

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pipe(bytes: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const body = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(body).arrayBuffer());
}

export async function encodeMessage(obj: unknown): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(obj));
  return `1-${toBase64Url(await pipe(json, new CompressionStream("gzip")))}`;
}

export async function decodeMessage(msg: string): Promise<unknown> {
  if (msg.startsWith("1-")) {
    const bytes = await pipe(fromBase64Url(msg.slice(2)), new DecompressionStream("gzip"));
    return JSON.parse(new TextDecoder().decode(bytes));
  }
  if (msg.startsWith("0-")) return JSON.parse(new TextDecoder().decode(fromBase64Url(msg.slice(2))));
  throw new Error("unsupported GameChanger message encoding");
}

export type GCNetwork = "preprod" | "mainnet";

export async function walletUrl(script: object, network: GCNetwork): Promise<string> {
  const url = new URL(GC_WALLET_URL + (await encodeMessage(script)));
  url.searchParams.set("networkTag", network);
  return url.toString();
}

/**
 * Return URL: `{result}` is replaced in-wallet by the packed result. GameChanger
 * rejects `&` in this pattern, so `result` is the only query param; any other
 * context travels through localStorage (see useWallet).
 */
export function returnUrl(): string {
  return `${window.location.origin}${window.location.pathname}?result={result}`;
}

export function connectScript(ret: string): object {
  return {
    type: "script",
    title: "Conectar con Veritax",
    description: "Compartí tu dirección con Veritax",
    exportAs: "connect",
    returnURLPattern: ret,
    run: { address: { type: "getCurrentAddress" } },
  };
}

export function signScript(title: string, txCbor: string, ret: string): object {
  return {
    type: "script",
    title,
    description: "Firmá la transacción de Veritax. La dapp la envía a Cardano Preprod.",
    exportAs: "sign",
    returnURLPattern: ret,
    run: {
      sign: {
        type: "signTxs",
        namePattern: `Veritax ${title}`,
        detailedPermissions: false,
        extras: true,
        txs: [txCbor],
      },
    },
  };
}

/** Finds the first Cardano address in a decoded wallet response. */
export function findAddress(value: unknown): string | null {
  if (typeof value === "string") return /^addr(_test)?1[0-9a-z]+$/.test(value) ? value : null;
  if (value && typeof value === "object") {
    for (const v of Object.values(value)) {
      const found = findAddress(v);
      if (found) return found;
    }
  }
  return null;
}
