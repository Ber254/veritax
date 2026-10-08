# Veritax — spec y progreso

Veritax es una capa de arbitraje descentralizado para escrows en Cardano: dos partes bloquean ADA en un contrato Aiken, pueden liberarlo de mutuo acuerdo o, si hay conflicto, activar una disputa que resuelve un árbitro designado. Demo para el hackathon del 12 de octubre, todo en **Cardano Preprod**.

## Arquitectura

- `contracts/` — proyecto Aiken (v1.1.23, Plutus V3). Validador en `contracts/validators/escrow.ak` (Aiken exige la carpeta `validators/`), tests en `contracts/validators/escrow_test.ak`, dirección en `contracts/deployment.json`.
- `frontend/` — Next.js (Pages Router). Las API routes arman las transacciones con Lucid Evolution + Koios (Preprod) y el navegador las firma con GameChanger Wallet (Universal Dapp Connector, redirección por URL).

### Datum

| Campo | Tipo | Descripción |
| --- | --- | --- |
| `party_a` | `Address` | quien deposita (locador/vendedor) |
| `party_b` | `Address` | contraparte (locatario/comprador) |
| `arbitrator` | `Address` | árbitro |
| `amount` | `Int` | ADA bloqueado en lovelace |
| `deadline` | `Int` | POSIX timestamp límite (ms) |
| `state` | `State` | `Locked` \| `Disputed` \| `Resolved` |

### Redeemers y validaciones

- `MutualRelease { to_a, to_b }` — firmado por `party_a` **y** `party_b`; estado `Locked` o `Disputed`.
- `ActivateDispute` — firmado por `party_a` **o** `party_b`; estado `Locked`; el UTxO vuelve al script con el mismo valor y el datum con `state = Disputed`.
- `ArbitratorRuling { to_a, to_b }` — firmado por `arbitrator`; estado `Disputed`.
- En las liberaciones: `to_a >= 0`, `to_b >= 0`, `to_a + to_b == amount`, y las salidas pagan al menos `to_a` a `party_a` y `to_b` a `party_b` (direcciones completas). Una sola entrada del script por transacción (evita doble satisfacción).
- `Resolved` es el estado conceptual final: al liberar, el UTxO se consume y los fondos salen del contrato.
- `deadline` se guarda en el datum pero el spec no define validaciones sobre él (no se usa on-chain).

## Tareas

- [x] 1. Setup del repositorio (`/contracts` Aiken, `/frontend` Next.js)
- [x] 1b. Deploy automático en Vercel conectado al repo (lo importa Bernardo desde la UI de Vercel)
- [x] 2. Smart contract en Aiken (`escrow.ak`)
- [x] 3. Tests del contrato (casos felices + negativos de los tres redeemers)
- [x] 4. Deploy del contrato en Preprod (`contracts/deployment.json`)
- [x] 5a. Frontend: integración GameChanger Wallet
- [x] 5b. Pantalla 1 — Crear contrato (`/`)
- [x] 5c. Pantalla 2 — Activar disputa (`/dispute`)
- [x] 5d. Pantalla 3 — Fallo del árbitro (`/ruling`)
- [x] 6. README.md
- [ ] 7. Demo del flujo completo en Preprod

## Reglas de trabajo

- Commit inmediato después de cada tarea: `[done] nombre-de-la-tarea` (o `[wip] ...` si queda a medias).
- Después de cada commit, marcar la tarea `[x]` acá; si no se puede, `[~]` con nota.
- Al cerrar cada sesión, actualizar `## Estado actual` (última tarea, próxima, blockers) y commitear.
- Siempre Cardano Preprod, nunca mainnet.

## Estado actual

_Actualizado: 2026-10-08 (Devin)_

- Hecho: contrato Aiken (23 tests OK), dirección Preprod en `contracts/deployment.json`, frontend Next.js con las 3 pantallas + GameChanger (lint, typecheck, 9 tests de flujo en emulador y build OK), README.
- Verificado contra Preprod real: `/api/config`, `/api/contract` y `/api/build` (arma una tx de creación válida usando Koios).
- Pendiente:
  - [x] 1b. Vercel: https://veritax-jet.vercel.app (Root Directory = `frontend`, auto-deploy desde `main`). `deployment.json` se importa estático para que quede empaquetado en las API routes.
  - [ ] 7. Demo end-to-end en Preprod con 3 wallets GameChanger fondeadas (crear → disputa → fallo).
- Notas: `deadline` se guarda en el datum pero no se valida on-chain (el spec no define su efecto). El ID del contrato es el hash de la tx de creación; las transiciones posteriores lo llevan en metadata label 8484 (`origin`).

### Cómo continuar (handoff para cualquier IA)

1. Leer este archivo y `README.md`. Verificar: `cd contracts && aiken check` y `cd frontend && npm install && npm test && npm run build`.
2. Producción: https://veritax-jet.vercel.app (Vercel auto-deploya cada push a `main`; Root Directory `frontend`). Chequeo rápido: `curl https://veritax-jet.vercel.app/api/config` tiene que devolver el JSON de `contracts/deployment.json`.
3. Tarea 7 (demo Preprod), en curso:
   - Wallets GameChanger en Preprod (https://wallet.gamechanger.finance/?networkTag=preprod): `A` creada; faltan `B` y `Arbitro`. Las semillas las guarda Bernardo, nunca van al repo ni al chat.
   - Fondear A desde el faucet (https://docs.cardano.org/cardano-testnets/tools/faucet, red Preprod) y desde A mandar ~20 tADA a B y al árbitro.
   - En la app: `/` con A (crear, guardar el hash) → `/dispute` con B → `/ruling` con el árbitro. Verificar cada tx en https://preprod.cardanoscan.io y anotar los hashes acá.
   - Al terminar: marcar 7 `[x]` y commitear `[done] demo-preprod`.
