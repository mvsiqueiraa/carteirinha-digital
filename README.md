# Caderninho Digital

MVP mobile-first e offline-first para controle de cobrancas de pequenos comerciantes informais.

## Stack

- React + Vite
- Tailwind CSS
- PWA com `manifest.json` e service worker
- IndexedDB com Dexie.js
- Supabase PostgreSQL + Realtime

## Estrutura

```txt
public/
  icons/
  manifest.json
  sw.js
src/
  components/
    Dashboard.jsx
  db/
    index.js
    schema.js
  lib/
    supabase.js
  services/
    charges.js
  sync/
    supabaseSync.js
  App.jsx
  main.jsx
  styles.css
supabase/
  schema.sql
```

## Rodando localmente

```bash
npm install
npm run dev
```

Copie `.env.example` para `.env` e preencha:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

## Offline-first

Toda gravacao deve passar primeiro por `saveLocal()` em `src/db/index.js`.
Essa funcao salva no IndexedDB e adiciona a mudanca em `syncQueue`.
Quando a internet volta, `syncPendingChanges()` envia a fila para o Supabase.

O saldo devedor nunca usa booleano de pago:

```txt
saldo = valor_total - soma(transacoes.valor_pago)
```

## Supabase

Execute `supabase/schema.sql` no banco do projeto. As tabelas usam IDs gerados no cliente para permitir criacao offline.
