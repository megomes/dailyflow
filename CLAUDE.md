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

## Design

Toda UI (app, protótipos, ferramentas internas, artefatos HTML) segue `design/DESIGN_SYSTEM.md` e usa os tokens de `design/tokens.css`. Dark-first; o light mode é proposta v0.1 em validação.

- Referência visual oficial (dark): `design/assets/reference-dark-ui.webp`. Antes de criar ou alterar qualquer tela, abra essa imagem e mantenha a mesma densidade, sidebar, segmented controls e event pills.
- Ícone do app: `design/assets/dailyflow-icon.webp` (PNG 1024 em `design/assets/dailyflow-icon-1024.png`).

## Idioma

Conversa e documentos de revisão em português (BR).
