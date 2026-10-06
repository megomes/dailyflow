# DailyFlow

App pessoal de gestão de tempo (single-user). O objeto central é o **Hoje**: plano (Baseline / Atual) × realidade (Actual).

- Spec de produto: `daily-os-product-functional-spec.md` (ainda usa o nome antigo "Daily OS" — o nome do app é **DailyFlow**)
- Ferramenta de revisão do planejamento: `review/dailyflow-review.html` (o usuário comenta, exporta em Markdown e manda de volta para atualizar a spec). Fontes em `review/src/` (`content.js` = especificação, `stages.js` = etapas de desenvolvimento e validação, `wireframes.js`/`wireframes.css` = kit de wireframes no design system); gere o arquivo com `python3 review/build.py`. Publicada em https://claude.ai/artifact/BanGnZjJgQDpsddZTaBEiX

## Documento vivo de planejamento (obrigatório manter)

A ferramenta de revisão (`review/`) e o artifact publicado (https://claude.ai/artifact/BanGnZjJgQDpsddZTaBEiX) são a fonte de verdade do plano e do progresso. Mantenha os dois sempre atualizados:

- **Plano muda → documento muda.** Qualquer mudança de escopo, ordem de etapas, funcionalidade, fluxo ou decisão entra em `review/src/` (`stages.js`, `content.js`, `wireframes.js`), é regerada com `python3 review/build.py --fragment <scratchpad>/dailyflow-review.html` e republicada **no mesmo URL** (Artifact publish com o mesmo arquivo, ou `url` numa conversa nova — ler o artifact antes).
- **Revisão por etapa.** O usuário revisa a próxima etapa antes de começá-la; não precisa revisar tudo. Não comece a desenvolver uma etapa em estado `rascunho`.
- **Aplicar revisões.** Os comentários ficam no db do artifact, coleção `reviews` (ou no Markdown exportado). Ao aplicar: ajustar o conteúdo, responder cada comentário em `CONTENT.replies[id]` (aparece como "Resposta" no item) e preservar os IDs existentes (os comentários são ligados a eles; para acrescentar entregas, adicione no fim da lista).
- **Progresso do desenvolvimento** fica no db do artifact (não precisa republicar): coleção `progress` (doc por etapa: `state` rascunho|aprovada|dev|validacao|concluida|cortada, `dates`, `feats` {p1…, f1…: todo|doing|done|cut}) e coleção `devlog` (`ts`, `stage`, `text`). Atualize com a ferramenta ArtifactData ao começar/terminar entregas, mudar de estado ou tomar decisões.
- Decisões aprovadas na revisão também devem ser aplicadas na spec (`daily-os-product-functional-spec.md`).

## App (`web/`)

- Next.js 16 (App Router; `middleware` agora é `src/proxy.ts`; leia `web/node_modules/next/dist/docs/` antes de usar APIs do Next). PWA local-first: Dexie/IndexedDB + outbox → `/api/sync` (Neon, last-writer-wins por `updatedAt`). Eventos de produto → `/api/events` (tabela `product_events`, etapa em `src/lib/config.ts` → `STAGE`). Textos da UI em inglês em `src/i18n/en.ts`.
- Produção: https://dailyflow-megomes.vercel.app · repo privado github.com/megomes/dailyflow · push na `main` = deploy de produção (Vercel, root `web`, região gru1). Autor dos commits precisa ser `matheuservilha@gmail.com` (senão a Vercel Hobby bloqueia o deploy).
- Banco: Neon `muddy-shape-19725660` (sa-east-1). Branch `main` = produção; branch `dev` = local (`web/.env.local`) e previews. Schema em `web/db/schema.sql`. Nunca rodar testes contra o `main`.
- Código de acesso: `.secrets/access-code.txt` (fora do git). Trocar: `npm run hash-code -- "<novo>"` e atualizar `ACCESS_CODE_HASH` na Vercel.
- Antes de commitar: `npm run lint`, `npm test`, `npm run build` em `web/`.

## Versão (sempre informar)

- A versão do produto é um número **1.X.X** (nunca sha/código), em `web/package.json` → `version`. Aparece ao lado de “Synced” (`SyncBadge` em `web/src/components/AppShell.tsx`, como `v1.X.X`); o sha do commit e a versão nativa do APK ficam só no tooltip.
- **Atualize a versão a cada entrega, antes de commitar:** sobe o **minor** (1.2.0 → 1.3.0) quando entrega notas/funcionalidades novas e o **patch** (1.3.0 → 1.3.1) para correção pequena de algo já entregue. Mesma versão em web, Android (OTA) e relógio: é uma só.
- **Ao terminar, diga ao usuário a versão lançada (`v1.X.X`)**, e onde chegou: web (produção), Android (OTA ou APK novo) e relógio (se instalou). Registre-a também no `deployed` da nota (`v1.X.X · production`). Sem isso a entrega não está completa.
- `mobile/app.json` → `version` é a versão **nativa** do APK (o runtime do OTA segue ela): não suba só para acompanhar o 1.X.X; só ao mudar algo nativo.
- Histórico: 1.1.0 = notas #42–#47 (widget com dia fechado, horas depois das 22h, zoom, leave empty, What changed today, relógio atrasado).
- 1.1.1 = ajuste visual: leave empty com o mesmo tracejado do Show later hours.

## App Android (`mobile/`)

- **Web e app têm SEMPRE as mesmas funcionalidades.** O app é uma casca nativa (Expo) em volta do próprio webapp numa WebView (`src/WebShell.tsx`), logada com o token do aparelho via `/api/devices/web`. Funcionalidade nova vai **no web** (com layout de celular); nunca crie telas nativas paralelas.
- O nativo só faz o que o web não faz: widgets (`src/widgets/`, desenhados a partir de `/api/snapshot`), notificação da tela de bloqueio, OTA, voltar do Android e links do widget (`dailyflow:///tasks`). O web avisa o app depois de cada sync (`postNative({type:'changed'})` em `web/src/lib/native.ts`) e o app redesenha os widgets.
- **OTA:** mudança só de JS → `cd mobile && npx -y eas-cli@latest update --channel production --environment production --platform android --message "…" --non-interactive` (o app aplica ao vir para a frente).
- **Mudança nativa** (lib nativa, permissão, plugin no `app.json`) → suba `version` no `mobile/app.json` (o runtime do OTA segue a versão; senão o APK novo baixa JS antigo), gere APK novo e publique um OTA logo em seguida.
- **APK:** em `mobile/`: `npx expo prebuild --platform android --clean --no-install`; `android/local.properties` com `sdk.dir=C\:/Users/mathe/Android/Sdk`; em `android/`: `gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a`. Se quebrar por caminho > 260 caracteres: `subst X: C:\Users\mathe\Code\dailyflow`, build em C: (gera o codegen) e repete em `X:\mobile\android`. Instalar: `adb -s <ip:porta> install -r` com o caminho Windows do APK (celular por Wi‑Fi; porta em `adb mdns services`; no Git Bash use `MSYS_NO_PATHCONV=1` para caminhos `/sdcard`).
- **Relógio (`wear/`, Kotlin):** o DailyFlow entra no relógio como **complicações** (Now, Next, Start/stop, Start next em `complications/Sources.kt`) que se plugam em qualquer mostrador; não fazemos mostrador próprio. Instalar sempre o **release** (`cd wear && ./gradlew assembleRelease`, depois `adb -s <relógio> install -r app/build/outputs/apk/release/app-release.apk` e `adb shell cmd package compile -m speed-profile -f app.dailyflow`): o debug do Compose é muito lento. Parear: `am start -n app.dailyflow/app.dailyflow.wear.MainActivity --es pair_code <código>`.
- **Nunca** navegue na interface do celular/relógio por toques simulados (`adb shell input`); peça ao usuário. Print (`screencap`) para conferir é ok.
- Pareamento sem passar pelo web: gerar código, gravar `sha256("dailyflow-pair:"+código)` em `pair_codes` (Neon `main`) e abrir `dailyflow://pair?host=…&code=…` no celular desbloqueado.

## App de desktop (`desktop/`)

- Casca Electron em volta do web (nota #20), mesma regra do Android: funcionalidade nova vai **no web**. A janelinha flutuante carrega `/mini` (`web/src/app/(mini)/mini/page.tsx`) sempre por cima, no canto; o ícone da bandeja/barra de menus mostra um anel de progresso na cor da área e o timer. Ponte: `window.dailyflowDesktop` (`desktop/preload.js` ↔ `web/src/lib/desktop.ts`).
- Testar contra o local: `cd desktop && npm run dev` (usa `http://localhost:3000`). Atalho global: Ctrl/⌘+Alt+D.
- Instalador Windows: `cd desktop && npm run dist:win` → `desktop/dist/DailyFlow Setup <versão>.exe` (sem assinatura: o SmartScreen pede “Executar assim mesmo”). Mac: rodar `npm run dist:mac` num Mac (dmg sem assinatura: abrir com botão direito › Abrir).
- Como a janela carrega a produção, mudanças no `/mini` chegam com o deploy do web; só mexer no `desktop/` exige instalador novo (suba `version` no `desktop/package.json`).

## Notas do app (página Notes) — fila de trabalho do usuário

O usuário escreve comentários sobre o app em **Notes** (`/notes`). Cada nota tem id sequencial (`#1`, `#2`…, nunca reutilizado). Quando ele pedir "faz os ids 2, 3, 4 e 5", é dessa fila que se trata. Os dados ficam no Neon **branch `main`** (produção; projeto `muddy-shape-19725660`, sem `branch_id`), tabelas `notes` e `note_log` (ver `web/db/schema.sql`). Use a ferramenta de SQL do Neon.

- **Ler:** `select id, kind, status, body, resolution, created_at from notes where id in (2,3,4,5) and not deleted;` (histórico: `select * from note_log where note_id = 2 order by ts;`)
- **Contexto para debug:** `notes.context` guarda onde a nota foi escrita: `device` (kind phone/tablet/desktop, os, browser, surface `pwa`|`browser`, layout `mobile`|`desktop`, toque, memória), `screen` (viewport, tela, dpr, orientação, tema), `network` (online, tipo, downlink, rtt), `locale`, `app` (versão/commit, etapa, tela de origem, service worker, estado do sync, mudanças pendentes, armazenamento), `server` (user agent, país/região/cidade da Vercel, build, ambiente) e `queuedOffline`. Edições e reaberturas guardam o mesmo em `note_log.detail.context`. Resumo rápido: `select id, context->'device'->>'kind', context->'device'->>'surface', context->'screen'->>'viewport', context->'network'->>'type' from notes where id = 3;`
- **Estados:** `open` (o usuário pode editar/excluir) → `discussing` → `in_progress` → `done` | `ignored` → o usuário testa: 👍 = `archived` (confirmado, log `confirmed`); 👎 = volta para `open` com comentário (log `rejected`, texto em `note_log.message`). O texto (`body`) é do usuário: nunca altere. Nunca arquive você mesmo: só o 👍 do usuário arquiva.
- **Nota reaberta com 👎:** leia o comentário antes de refazer: `select ts, message from note_log where note_id = 3 and action = 'rejected' order by ts desc limit 1;`. Ao entregar de novo, envie a lista `done` completa (a anterior + o que mudou) e explique na mensagem o que foi corrigido em resposta ao comentário.
- **Atualizar sempre via `note_claude`** (muda status, mescla a resolução e grava no histórico numa chamada só):
  - começar a discutir: `select note_claude(3, 'discussing', 'Perguntei X; aguardando decisão');`
  - começar: `select note_claude(3, 'in_progress', 'Começando: …');`
  - progresso sem mudar status: `select note_claude(3, null, 'Feito o passo X');`
  - concluir (depois do commit e do deploy): `select note_claude(3, 'done', 'Implementado e publicado', '{"summary":"…","done":["…"],"ignored":["…"],"decisions":["…"],"follow_ups":["…"],"commits":["<sha>"],"deployed":"<data · production>"}');`
  - decidir não fazer: `select note_claude(3, 'ignored', 'Motivo…', '{"summary":"…","ignored":["…"],"decisions":["…"]}');`
- A resolução é mesclada por chave (`||`): ao atualizar uma lista, envie a lista completa.
- Seja exato: o que foi feito, o que ficou de fora e por quê, decisões tomadas, commits (sha curto) e quando foi publicado. É isso que o usuário lê no app.
- Mudanças relevantes de escopo também vão para o documento vivo (diário / etapas).

## Design

Toda UI (app, protótipos, ferramentas internas, artefatos HTML) segue `design/DESIGN_SYSTEM.md` e usa os tokens de `design/tokens.css`. Dark-first; o light mode é proposta v0.1 em validação.

- Referência visual oficial (dark): `design/assets/reference-dark-ui.webp`. Antes de criar ou alterar qualquer tela, abra essa imagem e mantenha a mesma densidade, sidebar, segmented controls e event pills.
- Ícone do app: `design/assets/dailyflow-icon.webp` (PNG 1024 em `design/assets/dailyflow-icon-1024.png`).

## Idioma

Conversa e documentos de revisão em português (BR).
