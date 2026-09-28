# DailyFlow — Design System

> **Status:** v0.1 — Dark definido pelo usuário · Light é proposta em validação
> **Tokens:** [`design/tokens.css`](tokens.css) (fonte da verdade para cores, espaçamento, raios)
> **Ícone do app:** [`design/assets/dailyflow-icon.webp`](assets/dailyflow-icon.webp) · PNG 1024: [`dailyflow-icon-1024.png`](assets/dailyflow-icon-1024.png)
> **Referência visual:** [`design/assets/reference-dark-ui.webp`](assets/reference-dark-ui.webp)

Todo artefato, tela, protótipo ou ferramenta interna do DailyFlow deve seguir este documento.

---

## 1. Direção

Interface de produtividade desktop-first, refinada, inspirada em apps modernos de macOS.

- Minimal · densa mas organizada · calma e profissional
- Nativa de desktop · levemente premium · **dark-first**
- Altamente estruturada · baixo ruído

Evitar: elementos gigantes, gradientes excessivos, glassmorphism, sombras pesadas, componentes decorativos.
Priorizar: densidade de informação, hierarquia e usabilidade.

Personalidade: entre um app de produtividade macOS polido, Linear, Raycast e ferramentas modernas de dev.
**Escuro, compacto, preciso, silencioso, denso, extremamente polido.**

---

## 2. Cores

### Dark (padrão)

| Token | Valor | Uso |
|---|---|---|
| `--bg-app` | `#141416` | Fundo da aplicação |
| `--bg-sidebar` | `#1C1C1E` | Sidebar (levemente mais clara) |
| `--bg-surface` | `#19191B` | Superfícies, inputs, cards |
| `--bg-surface-hover` | `#242426` | Hover |
| `--bg-surface-active` | `#343436` | Selecionado/ativo |
| `--bg-elevated` | `#29292B` | Popovers, menus |
| `--border-default` | `#303033` | Bordas padrão (1px) |
| `--border-subtle` | `#262629` | Divisões internas |
| `--border-strong` | `#3A3A3D` | Ênfase |
| `--text-primary` | `#F3F3F4` | Texto principal (off-white) |
| `--text-secondary` | `#A1A1A6` | Secundário |
| `--text-muted` | `#717176` | Metadados |
| `--text-disabled` | `#55555A` | Desabilitado |

### Light (proposta v0.1)

Princípio: **não inverter**. O light mantém a mesma lógica de superfícies quase iguais, só que com cinzas frios levemente azulados, sem branco puro no fundo da aplicação. Branco puro fica reservado para superfícies (inputs, cards, popovers) — exatamente o papel que o `--bg-surface` tem no dark.

| Token | Valor | Nota |
|---|---|---|
| `--bg-app` | `#F6F6F7` | Nunca `#FFF` no fundo |
| `--bg-sidebar` | `#EEEEF0` | Sidebar um tom abaixo do app (inverso do dark, mantém a separação) |
| `--bg-surface` | `#FFFFFF` | Superfícies |
| `--bg-surface-hover` | `#EAEAEC` | |
| `--bg-surface-active` | `#E1E1E4` | Selecionado discreto |
| `--border-default` | `#E2E2E5` | |
| `--border-strong` | `#D2D2D7` | |
| `--text-primary` | `#17171A` | Quase preto, nunca `#000` |
| `--text-secondary` | `#55555C` | |
| `--text-muted` | `#85858D` | |

Acentos no light ficam ~10% mais escuros para manter contraste AA sobre fundo claro (ver `tokens.css`).

### Acentos semânticos (usar com parcimônia)

Só quando carregam significado: Life Areas, status, eventos de calendário, tags.

| Token | Dark | Light |
|---|---|---|
| `--accent-blue` | `#248CF2` | `#1574D6` |
| `--accent-purple` | `#7557E8` | `#5F3FD0` |
| `--accent-pink` | `#DC3D92` | `#C22A7A` |
| `--accent-orange` | `#EF6B2E` | `#CF5518` |
| `--accent-green` | `#19B66A` | `#0F9254` |
| `--accent-cyan` | `#27A7DC` | `#1486B6` |
| `--accent-yellow` | `#E5BA43` | `#A67F12` |

Elementos coloridos: fundo escuro saturado + texto mais claro + borda sutil combinando (dark). No light: fundo pastel + texto escuro saturado + borda pastel.

---

## 3. Tipografia

```css
font-family: Inter, "SF Pro Display", "SF Pro Text", -apple-system, BlinkMacSystemFont, sans-serif;
```

| Papel | Tamanho | Peso | Nota |
|---|---|---|---|
| Título de página | 24–28px | 650–700 | line-height justo |
| Título de seção | 16–18px | 600–650 | |
| Item de navegação | 14–16px | 500–550 | |
| Corpo | 14px | 400–500 | |
| Secundário / metadado | 12–13px | 400–500 | cor muted |
| Rótulo de grupo da sidebar | 11–12px | 600 | UPPERCASE, muted, letter-spacing leve |

Evitar diferenças dramáticas de tamanho. Números em colunas: `font-variant-numeric: tabular-nums`.

---

## 4. Layout

Sidebar vertical persistente + conteúdo principal (breadcrumb → título → tabs/controles → conteúdo).

```
--sidebar-width: 280px;  --page-padding-x: 32px;  --page-padding-y: 28px;  --content-max-width: none;
```

O conteúdo aproveita telas grandes; não centralizar num container estreito (exceto blocos de texto corrido, ~65–75ch).

## 5. Sidebar

- Levemente mais clara que o app (dark) · altura total · borda direita fina · padding horizontal 12–16px
- Navegação agrupada em seções com rótulo UPPERCASE
- Item: `height 42px · padding 0 12px · radius 6px` → `[ícone] Rótulo ········ badge opcional`
- Inativo: texto/ícone muted, fundo transparente · Hover: fundo sutil · Selecionado: `--bg-surface-active`, texto primário. Discreto.

## 6. Ícones

Linha fina monocromática (Lucide / Phosphor / SF Symbols). `18×18px`, `stroke-width 1.5–1.75`. Não dominam o rótulo.

## 7. Controles

- Botão: `height 36–40px · padding 0 14px · radius 7px`
- Secundário (dark): `bg #28282A · border #39393C · color #E8E8EA`
- Sem botões primários gigantes flutuantes.

## 8. Inputs

`height 40px · bg --bg-input · border 1px --border-input · radius 7px · padding 0 12px` · placeholder `--text-placeholder`.
Busca: ícone à esquerda + badge de atalho à direita (`⌘K`).

## 9. Tabs / Segmented control

Container `bg --bg-segmented · border --border-default · radius 7px`. Ativo `bg #303033 / --bg-surface-active`, texto primário. Inativo `--text-muted`. **Sem sublinhados coloridos.**

## 10. Cards e containers

Nem toda seção vira card. Preferir regiões de layout, bordas, superfícies agrupadas, contraste sutil.
Card quando necessário: `bg --bg-surface · 1px --border-default · radius 10px` · sem sombra proeminente.

## 11. Calendário / dados densos

Grid estruturado (`--grid-line`), células com bordas sutis e fundo quase igual à página, tipografia pequena.

Event pills: `height 26px · padding 0 8px · radius 5px · 12px · weight 500` usando os tokens `--pill-*-bg/fg/bd`. A saturação fica **dentro** do evento, nunca no entorno.

## 12. Espaçamento

Base 4px: `4 · 8 · 12 · 16 · 20 · 24 · 32 · 40`.
Ícone→rótulo 10px · controles relacionados 8px · seções 24–32px · grupos da sidebar 24px.

## 13. Raios

`--radius-sm 5px · --radius-md 7px · --radius-lg 10px`. Nada de "bolhas".

## 14. Estados de interação

```css
transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease, opacity 120ms ease;
```

Hover muda fundo, borda ou brilho do texto. Evitar escala, bounce, glow e grandes transformações.
Foco de teclado sempre visível (outline 2px `--accent-blue`, offset 2px).

### 14.1 Exceção autorizada: transição de tema

A troca Dark ↔ Light é o **único** momento expressivo do sistema. Definida pelo usuário:

- **O claro é sempre a camada de cima**, recortada por uma máscara circular centrada no botão que foi clicado; o escuro fica por baixo.
- **Escuro → Claro:** o círculo claro **abre** a partir do botão até cobrir a tela (700 ms, `cubic-bezier(.22,.61,.36,1)`).
- **Claro → Escuro:** o círculo claro **fecha** de volta no botão, revelando o escuro (600 ms, `cubic-bezier(.65,0,.35,1)`).

Implementação de referência (View Transitions API), em `review/src/app.js` → `toggleTheme`:

- Indo para o claro: `clip-path: circle(0 → R at x y)` em `::view-transition-new(root)`, com o novo por cima.
- Indo para o escuro: `clip-path: circle(R → 0 at x y)` em `::view-transition-old(root)`, com o antigo (claro) por cima (`z-index`).
- `R` = distância do centro do botão até o canto mais distante da tela.
- Sem suporte a View Transitions ou com `prefers-reduced-motion` → troca instantânea. Cliques durante a animação são ignorados.

## 15. Responsivo

Em telas estreitas: esconder a sidebar → header compacto com menu · priorizar a página atual · empilhar controles · **manter a mesma tipografia e densidade** (nada de "cards gigantes de mobile"). Calendários/tabelas podem rolar na horizontal.

## 16. Hierarquia visual

Vem de: (1) peso tipográfico, (2) espaçamento, (3) contraste sutil de superfície, (4) muted vs primário, (5) cor seletiva.
Não depender de títulos enormes, sombras, gradientes, cards gigantes ou fundos de acento vivos.

## 17. Regras para geração por IA

- Densidade de informação > componentes grandes
- Navegação persistente sempre que a largura permitir
- Separação por borda sutil, não por excesso de cards
- Fundo de página quase preto (dark) / quase branco frio (light)
- Contraste forte no conteúdo primário
- Acento só quando carrega significado · ícones monocromáticos salvo categoria/status
- Nada de: estética SaaS genérica, gradientes, glassmorphism, sombras grandes, raios enormes, tipografia gigante
- Padrões nativos de desktop · teclado primeiro · tooltip em controles só-ícone
- Ações contextuais em vez de controles permanentes
- Consistência visual em todas as áreas do app

## 18. Marca

- Nome: **DailyFlow** (a spec antiga usa "Daily OS" — substituir)
- Ícone: blocos empilhados azul → roxo → rosa → verde conectados por um fluxo até um relógio. As 4 cores do ícone (`blue`, `purple`, `pink`, `green`) são a assinatura da marca e podem aparecer juntas **apenas** no ícone, na linha da transição de tema e em momentos de marca (splash, onboarding). Dentro do produto, cada cor pertence a uma Life Area/status.
