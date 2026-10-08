# Veritax

Veritax es una capa de arbitraje descentralizado para escrows en Cardano.
Dos partes bloquean ADA en un contrato Aiken y pueden liberarlo de mutuo acuerdo;
si hay conflicto, cualquiera activa una disputa y un árbitro designado decide el reparto on-chain.

- Red: **Cardano Preprod** (nunca mainnet)
- Contrato: [`addr_test1wqzr43skk9mddnfn6yvwmujm75h9xgwv4fjcq7x4z0evwys90eadx`](https://preprod.cardanoscan.io/address/addr_test1wqzr43skk9mddnfn6yvwmujm75h9xgwv4fjcq7x4z0evwys90eadx) (ver [`contracts/deployment.json`](contracts/deployment.json))
- Deploy en Vercel: https://veritax-jet.vercel.app

## Estructura

| Carpeta | Qué hay |
| --- | --- |
| `contracts/` | Validador Aiken (`validators/escrow.ak`), tests (`validators/escrow_test.ak`), `plutus.json` y `deployment.json` |
| `frontend/` | Next.js (Pages Router): pantallas `/`, `/dispute`, `/ruling` y API routes que arman las transacciones con Lucid Evolution + Koios |
| `veritax-spec.md` | Spec, checklist de tareas y estado actual (handoff Devin ↔ Claude Code) |

## Contrato

Datum: `party_a`, `party_b`, `arbitrator` (direcciones), `amount` (lovelace), `deadline` (POSIX ms), `state` (`Locked` | `Disputed` | `Resolved`).

| Redeemer | Firma | Estado requerido | Efecto |
| --- | --- | --- | --- |
| `MutualRelease { to_a, to_b }` | A **y** B | `Locked` o `Disputed` | paga `to_a` a A y `to_b` a B |
| `ActivateDispute` | A **o** B | `Locked` | el UTxO vuelve al script con `state = Disputed` |
| `ArbitratorRuling { to_a, to_b }` | árbitro | `Disputed` | paga `to_a` a A y `to_b` a B |

En toda liberación `to_a + to_b == amount`. Al liberar, el UTxO se consume (estado final `Resolved`).

## Correr localmente

Requisitos: Node ≥ 22, [Aiken](https://aiken-lang.org/installation-instructions) v1.1.23.

```bash
# contrato
cd contracts
aiken check          # tests
aiken build          # regenera plutus.json

# frontend
cd ../frontend
npm install
npm test             # flujo completo en el emulador de Lucid
npm run deploy       # recalcula contracts/deployment.json si cambió el contrato
npm run dev          # http://localhost:3000
```

No hace falta ninguna variable de entorno: el frontend usa la API pública de Koios para Preprod.

## Usarlo en Preprod

1. Instalá/abrí [GameChanger Wallet](https://wallet.gamechanger.finance) en **Preprod** y cargá tADA desde el [faucet](https://docs.cardano.org/cardano-testnets/tools/faucet). Se necesitan 3 wallets (A, B y árbitro); A paga el depósito y las otras dos solo las comisiones.
2. **Crear contrato** (`/`): conectá la wallet de A, completá la dirección de B, la del árbitro, el monto y el deadline, y firmá. Guardá el hash que aparece: es el ID del contrato.
3. **Activar disputa** (`/dispute`): con la wallet de A o de B, pegá el hash y firmá. El estado pasa a `DISPUTED`.
4. **Fallo del árbitro** (`/ruling`): con la wallet del árbitro, pegá el hash, elegí los porcentajes (suman 100%) y firmá. Los fondos se pagan a A y B.

Cómo funciona la firma: el servidor arma la transacción sin firmar, el navegador la abre en GameChanger (Universal Dapp Connector), y al volver la dapp agrega la firma y la envía a Preprod.
