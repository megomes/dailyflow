# E9 · Calendários — configuração

Google (pessoal) e Microsoft 365/Teams (trabalho), **só leitura**. Cada evento vira um **bloco** do dia
(fixo, com o horário do evento): aparece no Today, Now/Next, widget, relógio, notificações e estatísticas.

## Regras

- Área: conta Microsoft → Work, conta Google → Personal (mudável por conta em Settings › Calendars).
- Mudar a área de um bloco de calendário no DailyFlow vale para aquele evento e é mantido nas próximas sincronizações.
- Apagar um bloco de calendário = ignorar aquele evento (não volta).
- Ignorados: categoria **Blocker** (Teams/Outlook), recusados, cancelados e eventos de dia inteiro.
- Calendários: “As blocks” ou “Ignore” (Settings).
- Reunião dentro de um bloco da mesma área não pede decisão de sobreposição; de outra área, pede.

## Sincronização

- Automática: `/api/sync` e `/api/snapshot` (web, celular, widget, relógio) disparam `maybeSyncCalendars()` em segundo plano quando a última sincronização tem mais de 10 min (o plano Hobby da Vercel não tem cron frequente).
- O web também sincroniza ao abrir e a cada 15 min; botão **Sync now** em Settings.
- Janela: ontem → +14 dias. O fuso vem de `prefs.timeZone` (gravado pelo aparelho).

## Configurar

1. **Banco:** `web/db/migrations/2026-10-05-e9-calendars.sql` no Neon (branch `dev` e `main`).
2. **Google:** Calendar API ativa; OAuth consent screen *In production* (em *Testing* o login expira em 7 dias); OAuth client **Web** com redirect URIs
   `https://dailyflow-megomes.vercel.app/api/calendars/callback` e `http://localhost:3000/api/calendars/callback`.
3. **Microsoft (Entra):** App registration (somente esta organização), redirect Web
   `https://dailyflow-megomes.vercel.app/api/calendars/callback`, client secret, permissões delegadas `Calendars.Read`, `User.Read`, `offline_access`.
4. **Vercel (Production e Preview):** `APP_URL`, `CALENDAR_TOKEN_KEY` (32 bytes base64), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, `MS_TENANT` (id do tenant da Reasset).

## Arquitetura

- `src/lib/calendar/normalize.ts` — payloads → linhas por dia lógico (fuso + virada), categorias do Outlook.
- `src/lib/calendar/server.ts` — OAuth, tokens AES-GCM, leitura paginada, `writeBlocks` (evento → `day_block` com `calendar`), `syncAll`, `maybeSyncCalendars`.
- Blocos de calendário têm `calendar.calArea` (área dada pela conta): se o `areaId` do bloco for diferente, a escolha é sua e é preservada.
