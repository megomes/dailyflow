# E9 · Calendários — o que falta para ligar

Código na branch `feat/e9-calendars` (não mergeada). Testado com dados simulados no navegador e com payloads no formato real das APIs (Google Calendar v3 e Microsoft Graph). O que não deu para testar aqui: o OAuth de verdade e as chamadas às APIs.

## 1. Banco (Neon)

```sh
psql "$DATABASE_URL_DEV"  -f web/db/migrations/2026-10-05-e9-calendars.sql   # branch dev
psql "$DATABASE_URL_MAIN" -f web/db/migrations/2026-10-05-e9-calendars.sql   # produção, depois de testar
```

Só cria a tabela `calendar_accounts` (tokens criptografados). Calendários, eventos e exceções viajam como `sync_records`.

## 2. Google

1. Google Cloud Console → novo projeto → APIs & Services → **Enable** “Google Calendar API”.
2. OAuth consent screen → External → adicione seu e-mail como *test user* (evita a verificação do Google).
3. Credentials → Create OAuth client ID → **Web application**:
   - Authorized redirect URIs: `https://dailyflow-megomes.vercel.app/api/calendars/callback` e `http://localhost:3000/api/calendars/callback`
4. Copie Client ID e Client secret.

Escopos pedidos: `calendar.readonly`, `calendar.events` (este já para a E10), `openid`, `email`.

## 3. Microsoft 365 (trabalho)

1. portal.azure.com → Microsoft Entra ID → App registrations → New registration.
   - Supported account types: “Accounts in any organizational directory and personal Microsoft accounts” (ou só a sua organização).
   - Redirect URI (Web): `https://dailyflow-megomes.vercel.app/api/calendars/callback`
2. Certificates & secrets → New client secret.
3. API permissions → Microsoft Graph → Delegated: `Calendars.ReadWrite`, `User.Read`, `offline_access`, `openid`, `email`. Se a empresa exigir, peça *admin consent*.
4. Se a conta é só da empresa, use `MS_TENANT=<tenant id>`; senão `common`.

## 4. Variáveis na Vercel (Production e Preview) e em `web/.env.local`

```
APP_URL=https://dailyflow-megomes.vercel.app      # local: http://localhost:3000
CALENDAR_TOKEN_KEY=<openssl rand -base64 32>
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
MS_CLIENT_ID=...
MS_CLIENT_SECRET=...
MS_TENANT=common
```

## 5. Testar (roteiro)

1. Settings › Calendars → Connect Google → consentir → volta com “Calendar connected”.
2. Classificar: principal = Commitment, família = Awareness, feriados = Hidden.
3. Today: reuniões aparecem listradas na coluna Plano; reunião sobre um bloco → card “Meeting over a block” (dividir / encerrar antes / mover / manter).
4. Mover uma reunião no Google → em até 15 min (ou “Sync calendars”) vira revisão “Meeting moved” no histórico do dia.
5. Erros: revogar o acesso no Google → banner “needs reconnecting” no Today e status na página.

## Arquitetura

- `src/lib/calendar/normalize.ts` — puro: payloads → linhas por dia lógico (fuso do usuário + virada), divisão na virada, dia inteiro, recusados, “free”.
- `src/lib/calendar/server.ts` — OAuth, tokens AES-GCM, refresh, leitura paginada, escrita em `sync_records` (só muda `seq` quando o evento muda; o que sumiu vira tombstone).
- `POST /api/calendars/sync` — janela ontem → +14 dias; o cliente chama no boot, a cada 15 min e no botão.
- Cliente: `useDayEvents`, `CalendarWatcher` (mudanças → revisões), `ExternalConflictsCard`, `EventInspector` (exceção por evento, virar bloco fixo).

# E10 · Proteger o tempo (branch `feat/e10-protect`, empilhada na E9)

Não precisa de setup extra: os escopos da E9 já pedem escrita (`calendar.events`, `Calendars.ReadWrite`). Se você conectou antes desta branch com escopo só de leitura, clique em **Reconnect**.

- Inspector do bloco → **Protect this time** → escolha calendários (Google, Microsoft ou os dois) e **Busy/Free**.
- O agente de publicação (no app, a cada mudança, 2 s depois) cria/atualiza/exclui o evento. Os ids do Google são derivados do bloco e a Microsoft usa `transactionId`, então uma nova tentativa não duplica o evento.
- Mover/redimensionar/renomear o bloco atualiza o evento. Excluir pergunta: “só no DailyFlow” (o evento fica) ou “no calendário também”.
- Falhas aparecem no bloco com **Try again**; nada falha em silêncio (`publish_failed` nos eventos).
- Eventos que o próprio DailyFlow publicou não aparecem duplicados na timeline nem viram conflito.

Roteiro de teste: proteger um bloco de Work como Busy → ver no Google Calendar → arrastar o bloco → o evento move → excluir “no calendário também” → some do Google.
