import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import type { ReactNode } from "react";
import { short } from "@/lib/api";
import type { Wallet } from "@/lib/useWallet";

const NAV = [
  { href: "/", label: "Crear contrato" },
  { href: "/dispute", label: "Activar disputa" },
  { href: "/ruling", label: "Fallo del árbitro" },
];

export function Layout({ wallet, title, children }: { wallet: Wallet; title: string; children: ReactNode }) {
  const { pathname } = useRouter();
  return (
    <>
      <Head>
        <title>{`${title} · Veritax`}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Arbitraje descentralizado para escrows en Cardano" />
      </Head>
      <header className="topbar">
        <Link href="/" className="brand">
          Veritax<span className="dot">.</span>
        </Link>
        <span className="net">Preprod</span>
        <div className="wallet">
          {wallet.address ? (
            <>
              <code title={wallet.address}>{short(wallet.address)}</code>
              <button className="ghost" onClick={wallet.disconnect}>
                Salir
              </button>
            </>
          ) : (
            <button onClick={() => void wallet.connect()} disabled={!wallet.ready}>
              Conectar GameChanger Wallet
            </button>
          )}
        </div>
      </header>
      <nav className="tabs">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={pathname === n.href ? "active" : ""}>
            {n.label}
          </Link>
        ))}
      </nav>
      <main className="container">
        <h1>{title}</h1>
        {wallet.notice && <p className={`notice ${wallet.notice.kind}`}>{wallet.notice.text}</p>}
        {children}
      </main>
      <footer className="footer">
        {wallet.deployment && (
          <a href={wallet.deployment.explorer} target="_blank" rel="noreferrer">
            Contrato {short(wallet.deployment.scriptAddress)}
          </a>
        )}
        <span>Cardano Preprod · Aiken · GameChanger</span>
      </footer>
    </>
  );
}
