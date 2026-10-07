/* DailyFlow — wireframes de revisão.
 * Interpretação visual do que será desenvolvido; não é o layout final.
 * Tudo usa os tokens do design system, então acompanha o tema claro/escuro.
 */
function makeWireframes({ icon, esc, iconSrc }) {
  const pad = n => String(n).padStart(2, '0');
  const fmt = h => { const hh = Math.floor(h), mm = Math.round((h - hh) * 60); return `${pad(hh % 24)}:${pad(mm)}`; };
  const pin = n => `<b class="pin">${n}</b>`;
  const I = (n, c = 'xs') => icon(n, c);

  /* ── Peças ── */
  const NAV = [['hoje', 'home', 'Hoje'], ['tarefas', 'tasks', 'Tarefas', '3'], ['historico', 'history', 'Histórico'], ['insights', 'chart', 'Insights'], ['config', 'gear', 'Configurações']];
  let NAVSET = null;
  const side = active => `<div class="wf-side"><div class="b"><img src="${iconSrc}" alt="">DailyFlow</div>${NAV.filter(n => !NAVSET || NAVSET.includes(n[0])).map(([k, ic, l, n]) => `<div class="wf-nav${k === active ? ' on' : ''}">${I(ic, 'sm')}<span>${l}</span>${n ? `<em>${n}</em>` : ''}</div>`).join('')}<div class="wf-side-foot">${I('refresh')}<span>Sincronizado</span></div></div>`;
  const win = (main, { active = 'hoje', title = 'DailyFlow', noside = false, overlay = '' } = {}) =>
    `<div class="wf"><div class="wf-chrome"><i></i><i></i><i></i><span class="t">${title}</span></div><div class="wf-app${noside ? ' noside' : ''}">${noside ? '' : side(active)}<div class="wf-main">${main}</div>${overlay}</div></div>`;
  const phone = inner => `<div class="wf-phone"><div class="ph-top"><span>10:37</span><span class="notch"></span><span>${I('signal')}</span></div><div class="ph-body">${inner}</div><div class="ph-home"></div></div>`;
  const btn = (l, { ic, pri, ghost, p } = {}) => `<span class="wf-btn${pri ? ' pri' : ''}${ghost ? ' ghost' : ''}">${ic ? I(ic) : ''}${l}${p ? pin(p) : ''}</span>`;
  const seg = (items, on = 0) => `<span class="wf-seg">${items.map((x, i) => `<span${i === on ? ' class="on"' : ''}>${x}</span>`).join('')}</span>`;
  const hdr = (t, sub = '', right = '') => `<div class="wf-h"><div><div class="wf-title">${t}</div>${sub ? `<div class="wf-sub">${sub}</div>` : ''}</div><div class="wf-row">${right}</div></div>`;
  const lbl = (t, extra = '') => `<div class="wf-lbl">${t}${extra}</div>`;
  const dot = c => `<i class="wf-dot" style="background:var(--accent-${c})"></i>`;
  const task = (t, meta = '', { c = 'blue', pri = '', done = false, sel = false, drag = false, p = '' } = {}) =>
    `<div class="wf-task${sel ? ' sel' : ''}${drag ? ' drag' : ''}"><i class="cb${done ? ' on' : ''}"></i>${dot(c)}<span class="tt">${t}</span>${pri ? `<span class="wf-pri p-${pri}">${{ h: 'High', m: 'Med', l: 'Low' }[pri]}</span>` : ''}<em>${meta}</em>${p ? pin(p) : ''}</div>`;
  const STEPS = ['Contexto', 'Montar o dia', 'Conflitos', 'Iniciar'];
  const stepper = (cur, labels = STEPS) => `<div class="wf-stepper">${labels.map((l, i) => `<span class="st${i + 1 === cur ? ' on' : ''}${i + 1 < cur ? ' done' : ''}"><b>${i + 1 < cur ? I('check') : i + 1}</b>${l}</span>`).join('<i></i>')}</div>`;
  const row = (ic, t, sub, p = '') => `<div class="wf-li">${I(ic, 'sm')}<div><b>${t}</b><span>${sub}</span></div>${p ? pin(p) : ''}</div>`;
  const bar = (pct, c = 'blue') => `<span class="wf-bar"><i style="width:${pct}%;background:var(--accent-${c})"></i></span>`;

  function tl(items, { from = 6, to = 22, pph = 16, now = null, every = 2, left = 30 } = {}) {
    let g = '';
    for (let h = from; h <= to; h += every) g += `<div class="wf-hr" style="top:${(h - from) * pph}px"><span>${pad(h % 24)}</span></div>`;
    const bl = items.map(it => {
      const top = (it.a - from) * pph + 1, ht = Math.max((it.b - it.a) * pph - 2, 12);
      const cls = ['wf-blk', it.gap ? 'gap' : 'c-' + (it.c || 'gray'), it.prov && 'prov', it.sel && 'sel', it.ghost && 'ghost', it.dim && 'dim', it.warn && 'warn'].filter(Boolean).join(' ');
      const ic = (it.lock ? I('lock') : '') + (it.cal ? I('calendar') : '') + (it.shield ? I('shield') : '') + (it.check ? I('check') : '') + (it.eye ? I('eye') : '');
      const right = it.cap ? `<span class="wb-cap${it.over ? ' over' : ''}">${it.cap}</span>` : (ht >= 13 && !it.notime ? `<span class="wb-t">${fmt(it.a)}</span>` : '');
      const tasks = it.tasks && ht > 26 ? `<div class="wb-tasks">${it.tasks.map(t => `<div class="wb-task"><i class="cb${t[2] ? ' on' : ''}"></i><span>${t[0]}</span><em>${t[1] || ''}</em></div>`).join('')}</div>` : '';
      const pos = `top:${top}px;height:${ht}px;left:${it.l != null ? it.l : left + 'px'};right:${it.r != null ? it.r : '6px'}`;
      return `<div class="${cls}" style="${pos}"><div class="wb-h"><span class="wb-n">${ic}<span>${it.n}</span></span>${right}${it.p ? pin(it.p) : ''}</div>${tasks}${it.html || ''}</div>`;
    }).join('');
    const nl = now != null ? `<div class="wf-now" style="top:${(now - from) * pph}px"><span>${fmt(now)}</span></div>` : '';
    return `<div class="wf-tl" style="height:${(to - from) * pph}px">${g}${bl}${nl}</div>`;
  }

  /* ── Dados de exemplo ── */
  const TPL = [
    { a: 6, b: 9, n: 'Maker', c: 'orange' }, { a: 9, b: 10, n: 'Drive / Leo', c: 'cyan' }, { a: 10, b: 11, n: 'Work', c: 'blue' },
    { a: 11, b: 12, n: 'Music', c: 'purple' }, { a: 12, b: 14, n: 'Lunch + FlightSim', c: 'yellow' }, { a: 14, b: 17.5, n: 'Work', c: 'blue' },
    { a: 17.5, b: 18.5, n: 'Drive / Leo', c: 'cyan' }, { a: 18.5, b: 21, n: 'Family', c: 'green' }, { a: 21, b: 22, n: 'Reading', c: 'pink' },
  ];
  const MEET = [{ a: 14, b: 15, n: 'Engineering Weekly', c: 'gray', cal: true, l: '56%' }, { a: 16, b: 16.5, n: '1:1 Marcos', c: 'gray', cal: true, l: '56%' }];
  const mod = (arr, map) => arr.map((b, i) => Object.assign({}, b, typeof map === 'function' ? map(b, i) : map));
  const MAKER_TASKS = [['Fix Sortie sync', '1h30'], ['Imprimir case do MFD', '30m'], ['DCS Companion', '1h40']];

  const nowCard = ({ timer = true, p1 = '', p2 = '' } = {}) => `
    <div class="wf-card now">${lbl('Agora', p1 ? ' ' + pin(p1) : '')}
      <div class="wf-big">${dot('blue')}Work<span class="wf-sub">10:00–11:00</span></div>
      <div class="wf-row sp"><span class="wf-sub">23 min restantes</span>${bar(62)}</div>
      ${timer ? `<div class="wf-timer"><span>18:42</span><span class="wf-sub">foco 50/10 · sessão 2</span>${p2 ? pin(p2) : ''}</div>
      <div class="wf-task inset"><i class="cb"></i><span class="tt">Preparar relatório semanal</span><em>45m</em></div>
      <div class="wf-row">${btn('Pausar', { ic: 'pause' })}${btn('Parar', { ic: 'stop' })}${btn('Concluir', { ic: 'check' })}</div>`
      : `<div class="wf-row">${btn('Comecei', { ic: 'play' })}${btn('Iniciar foco', { ic: 'clock' })}</div>`}
    </div>`;
  const nextCard = (p = '') => `<div class="wf-card">${lbl('Próximo', p ? ' ' + pin(p) : '')}<div class="wf-big sm">${dot('purple')}Music<span class="wf-sub">11:00 · em 23 min</span></div></div>`;

  /* ── Telas ── */
  const W = {};

  W.onboarding = {
    t: 'Primeiro acesso', kind: 'desktop',
    notes: ['Código privado, validado no servidor. Depois disso o dispositivo fica confiável e não pede mais login.', 'Configuração inicial em 3 passos, todos puláveis. Os padrões da spec já vêm prontos.', 'As 11 áreas de vida com cor e ícone. As cores vêm dos acentos do design system.'],
    r: () => win(`<div class="wf-onb">
      <div class="wf-card center"><img class="wf-logo" src="${iconSrc}" alt=""><div class="wf-title">DailyFlow</div><div class="wf-sub">Código de acesso</div><div class="wf-input">••••••••</div>${btn('Entrar', { pri: true, p: 1 })}</div>
      <div class="wf-card">${stepper(1, ['Áreas', 'Templates', 'Calendários'])}${pin(2)}
        <div class="wf-areas">${[['Work', 'blue'], ['Maker', 'orange'], ['Music', 'purple'], ['Family', 'green'], ['FlightSim', 'yellow'], ['Physical', 'pink'], ['Commute', 'cyan'], ['Rest', 'green'], ['Leisure', 'purple'], ['Personal', 'gray'], ['Sleep', 'blue']].map(([n, c]) => `<span class="wf-chip">${dot(c === 'gray' ? 'cyan' : c)}${n}</span>`).join('')}${pin(3)}</div>
        <div class="wf-row sp">${btn('Pular', { ghost: true })}${btn('Continuar', { pri: true })}</div></div></div>`, { noside: true, title: 'DailyFlow — Boas-vindas' }),
  };

  W.unplanned = {
    t: 'Hoje · dia ainda não planejado', kind: 'desktop',
    notes: ['O app já preparou o dia sozinho: template, compromissos, awareness, tarefas para continuar, prazos e Inbox.', 'Prévia do esqueleto: blocos tracejados = provisórios, reuniões sólidas.', 'Dois caminhos: planejamento completo (~5 min) ou modo rápido (~1 min). Nenhum é obrigatório.'],
    r: () => win(`
      <div class="wf-hero"><div class="wf-sub">Bom dia</div><div class="wf-title xl">Segunda, 28 set</div><div class="wf-sub">Template Weekday · dia não iniciado</div></div>
      <div class="wf-split">
        <div class="wf-card">${lbl('Preparado para hoje', ' ' + pin(1))}
          ${row('calendar', '2 compromissos', 'Engineering Weekly 14:00 · 1:1 Marcos 16:00')}
          ${row('eye', '1 evento de awareness', 'Consulta da Ana 15:00 · não ocupa tempo')}
          ${row('history', 'Continuar de dias anteriores', 'Fix Sortie sync · 1h42 · 4 sessões')}
          ${row('flag', '1 prazo hoje', 'Enviar relatório trimestral')}
          ${row('inbox', '3 no Inbox', 'Comprar PETG · Ligar para a oficina · …')}
        </div>
        <div class="wf-col">${lbl('Esqueleto', ' ' + pin(2))}${tl([...mod(TPL, { prov: true }), ...MEET], { pph: 11, every: 4 })}</div>
      </div>
      <div class="wf-row">${btn('Planejar meu dia', { pri: true, ic: 'listChecks' })}${btn('Modo rápido', { ic: 'zap' })}${pin(3)}</div>`),
  };

  W.yesterday = {
    t: 'Hoje · ontem não foi fechado', kind: 'desktop',
    notes: ['Cartão discreto no topo. Não bloqueia o planejamento de hoje.', 'Fechar agora abre o fechamento resumido (real + tarefas). Automático devolve tarefas ao Backlog e marca o dia como “fechado automaticamente”.'],
    r: () => win(`
      <div class="wf-banner info">${I('moon', 'sm')}<div><b>Domingo não foi fechado</b><span>2 tarefas em andamento · 3h sem registro</span></div>${pin(1)}<span class="sp"></span>${btn('Fechar agora', { p: 2 })}${btn('Automático')}${btn('Depois', { ghost: true })}</div>
      <div class="wf-hero"><div class="wf-sub">Bom dia</div><div class="wf-title xl">Segunda, 28 set</div></div>
      <div class="wf-card">${row('history', 'Continuar de dias anteriores', 'Fix Sortie sync · 1h42 · 4 sessões')}${row('calendar', '2 compromissos', 'Engineering Weekly 14:00 · 1:1 Marcos 16:00')}</div>
      <div class="wf-row">${btn('Planejar meu dia', { pri: true })}${btn('Modo rápido', { ic: 'zap' })}</div>`),
  };

  W.lateStart = {
    t: 'Hoje · início tardio', kind: 'desktop',
    notes: ['Tudo antes de agora aparece esmaecido. O Baseline começa em “agora” e fica marcado como início tardio.', 'Os blocos que já passaram viram perguntas rápidas. Sem resposta, ficam para o fechamento.'],
    r: () => win(`${hdr('Segunda, 28 set', '10:40 · dia ainda não iniciado', btn('Iniciar a partir de agora', { pri: true, ic: 'play', p: 1 }))}
      <div class="wf-split r">
        ${tl(mod(TPL, b => b.b <= 10.67 ? { dim: true } : { prov: true }), { pph: 14, now: 10.67, every: 2 })}
        <div class="wf-card">${lbl('Isso aconteceu?', ' ' + pin(2))}
          ${[['Maker', '06:00–09:00', 'orange'], ['Drive / Leo', '09:00–10:00', 'cyan'], ['Work', '10:00–10:40', 'blue']].map(([n, t, c]) => `<div class="wf-q">${dot(c)}<b>${n}</b><span class="wf-sub">${t}</span><span class="sp"></span>${btn('Sim')}${btn('Não', { ghost: true })}${btn('Ajustar', { ghost: true })}</div>`).join('')}
        </div></div>`),
  };

  W.ctx = {
    t: 'Planejamento · Etapa 1 · Contexto', kind: 'desktop',
    notes: ['4 etapas, todas puláveis.', 'Commitments ocupam tempo; Awareness aparece tracejado e não ocupa. “+ Compromisso” cria um bloco Fixo aqui mesmo.', 'Tarefas iniciadas antes vêm em destaque. “Para hoje” já separa o que entra no dia antes de montar os blocos.', 'Lembrou de algo? Captura direto daqui.'],
    r: () => win(`${stepper(1)}${pin(1)}
      <div class="wf-cols3">
        <div class="wf-card">${lbl('Compromissos', ' ' + pin(2))}
          <div class="wf-ev c-gray">${I('calendar')}Engineering Weekly<em>14:00</em></div><div class="wf-ev c-pink">${I('lock')}Dentista<em>16:00</em></div>
          ${btn('+ Compromisso', { ghost: true, ic: 'plus' })}
          ${lbl('Awareness')}<div class="wf-ev aw">${I('eye')}Consulta da Ana<em>15:00</em></div></div>
        <div class="wf-card hl">${lbl('Continuar de dias anteriores', ' ' + pin(3))}
          <div class="wf-pick">${task('Fix Sortie sync', '1h42', { c: 'orange', pri: 'h' })}<span class="wf-chip on">${I('check')}Para hoje</span></div><div class="wf-sub pad">4 sessões · estimado 1h · em andamento</div>
          ${lbl('Prazos')}<div class="wf-pick">${task('Enviar relatório trimestral', 'hoje', { c: 'blue', pri: 'h' })}<span class="wf-chip on">${I('check')}Para hoje</span></div>
          ${lbl('High')}<div class="wf-pick">${task('Praticar “Numb”', '1h', { c: 'purple', pri: 'h' })}<span class="wf-chip">Para hoje</span></div></div>
        <div class="wf-card">${lbl('Inbox', ' <em class="n">3</em>')}<div class="wf-input on" style="min-width:0">+ Nova tarefa… <kbd style="margin-left:auto">N</kbd></div>${pin(4)}
          <div class="wf-pick">${task('Comprar PETG', '', { c: 'cyan' })}<span class="wf-chip">Para hoje</span></div><div class="wf-pick">${task('Ligar para a oficina', '', { c: 'cyan' })}<span class="wf-chip on">${I('check')}Para hoje</span></div>
          ${lbl('Template')}<div class="wf-sub">Weekday · 9 blocos · 06:00–22:00</div></div>
      </div>
      <div class="wf-row end"><span class="wf-sub">3 tarefas para hoje · 1 compromisso novo</span>${btn('Pular para Iniciar', { ghost: true })}${btn('Montar o dia', { pri: true, ic: 'arrowR' })}</div>`),
  };

  W.skeleton = {
    t: 'Planejamento · Etapa 2 · Montar o dia (blocos)', kind: 'desktop',
    notes: ['Blocos do template tracejados até serem aceitos. Compromissos entram sólidos.', 'Bloco selecionado: Aceitar, Fixo/Flexível, Substituir, Remover. Arrastar move; puxar a borda redimensiona.', 'O compromisso marcado no Contexto já está aqui como Fixo. O template original não muda.', 'Na mesma tela, alternar para as tarefas marcadas “Para hoje” (próxima imagem).'],
    r: () => win(`${stepper(2)}
      <div class="wf-split r">
        ${tl([...mod(TPL, (b, i) => i < 3 ? {} : { prov: true, sel: i === 3, p: i === 3 ? 2 : '' }), ...MEET.slice(0, 1), { a: 16, b: 17, n: 'Dentista', c: 'pink', lock: true, l: '56%', p: 3 }], { pph: 15 })}
        <div class="wf-col">
          <div class="wf-card">${lbl('Bloco selecionado')}<div class="wf-big sm">${dot('purple')}Music<span class="wf-sub">11:00–12:00 · Rotina</span></div>
            <div class="wf-row wrap">${btn('Aceitar', { ic: 'check' })}${seg(['Fixo', 'Flexível'], 1)}${btn('Substituir', { ghost: true })}${btn('Remover', { ghost: true, ic: 'x' })}</div></div>
          <div class="wf-card">${lbl('Legenda', ' ' + pin(1))}<div class="wf-legend"><span><i class="lg prov"></i>Provisório (template)</span><span><i class="lg acc"></i>Aceito</span><span>${I('calendar')}Externo</span><span>${I('lock')}Fixo</span></div></div>
          <div class="wf-row">${btn('Aceitar todos', { ic: 'check' })}${btn('+ Bloco', { ghost: true })}</div>
          <div class="wf-row">${seg(['Blocos', 'Tarefas · 3'], 0)}${pin(4)}</div>
        </div></div>
      <div class="wf-row end">${btn('Voltar', { ghost: true })}${btn('Continuar', { pri: true, ic: 'arrowR' })}</div>`),
  };

  W.allocate = {
    t: 'Planejamento · Etapa 2 · Montar o dia (tarefas)', kind: 'desktop',
    notes: ['As tarefas marcadas “Para hoje” primeiro; o resto do Backlog abaixo. N captura sem sair daqui.', 'Arrastando uma tarefa Work: os blocos Work se destacam e o bloco recebe a tarefa (sem duplicar).', 'O bloco mostra carga × capacidade. Estourar é só um aviso.', 'Tarefa de outra área num bloco: aviso leve com a correção pronta.'],
    r: () => win(`${stepper(2)}
      <div class="wf-alloc">
        <div class="wf-card tasks">${lbl('Tarefas', ' ' + pin(1))}<div class="wf-input" style="min-width:0">+ Nova tarefa… <kbd style="margin-left:auto">N</kbd></div>
          <div class="wf-grp">Para hoje · 3</div>${task('Fix Sortie sync', '1h30', { c: 'orange', pri: 'h' })}${task('Relatório semanal', '45m', { c: 'blue', pri: 'h', drag: true, p: 2 })}${task('Ligar para a oficina', '10m', { c: 'cyan' })}
          <div class="wf-grp">Backlog</div>${task('DCS Companion', '1h40', { c: 'orange', pri: 'm' })}${task('Praticar “Numb”', '1h', { c: 'purple', pri: 'h' })}
          <div class="wf-row"><span class="wf-chip">Área: todas</span><span class="wf-chip">Do bloco selecionado</span></div>
        </div>
        ${tl([{ a: 6, b: 9, n: 'Maker', c: 'orange', cap: '3h40 / 3h', over: true, tasks: MAKER_TASKS, p: 3 }, { a: 9, b: 10, n: 'Drive / Leo', c: 'cyan', dim: true }, { a: 10, b: 11, n: 'Work', c: 'blue', cap: '0 / 1h', sel: true, html: '<div class="wb-drop">Soltar aqui · Work</div>' }, { a: 11, b: 12, n: 'Music', c: 'purple', dim: true }, { a: 12, b: 14, n: 'Lunch + FlightSim', c: 'yellow', dim: true }], { from: 6, to: 14, pph: 30, every: 1 })}
        <div class="wf-col"><div class="wf-card">${lbl('Inspector')}<div class="wf-big sm">${dot('orange')}Maker</div><div class="wf-sub">06:00–09:00 · Flexível</div>
          <div class="wf-kv"><span>Capacidade</span><b>3h</b><span>Estimado</span><b class="warn">3h40</b><span>Tarefas</span><b>3</b></div></div>
          <div class="wf-banner info sm">${I('info')}<span>“DCS Companion” é Maker, mas foi para Work.</span>${pin(4)}</div><div class="wf-row wrap">${btn('Mover para Maker')}${btn('Manter', { ghost: true })}</div></div>
      </div>`),
  };

  W.conflicts = {
    t: 'Planejamento · Etapas 3 e 4 · Conflitos e Iniciar dia', kind: 'desktop',
    notes: ['Cada problema com a correção pronta. Manter mesmo assim é sempre uma opção.', 'INICIAR DIA salva o Baseline imutável e muda a tela para o modo execução.'],
    r: () => win(`${stepper(3)}
      <div class="wf-card">${lbl('2 pontos para revisar', ' ' + pin(1))}
        <div class="wf-issue">${I('alert', 'sm')}<div><b>Maker está 40 min acima da capacidade</b><span>3h40 estimado em 3h disponíveis</span></div><span class="sp"></span>${btn('Manter')}${btn('Mover tarefa')}${btn('Redimensionar')}${btn('Voltar ao Backlog', { ghost: true })}</div>
        <div class="wf-issue">${I('calendar', 'sm')}<div><b>Engineering Weekly sobrepõe Work</b><span>14:00–15:00 · sugestão: Work 15:00–17:30</span></div><span class="sp"></span>${btn('Aplicar sugestão', { ic: 'check' })}${btn('Manter sobreposição', { ghost: true })}</div>
      </div>
      <div class="wf-start"><div><b>Tudo pronto</b><span class="wf-sub">9 blocos · 5 tarefas alocadas · 2 compromissos</span></div><span class="sp"></span>${btn('INICIAR DIA', { pri: true, ic: 'play', p: 2 })}</div>
      <div class="wf-toast">${I('check')}Baseline salvo às 06:01 · bom dia</div>`),
  };

  W.quick = {
    t: 'Modo rápido (1 minuto)', kind: 'desktop',
    notes: ['Uma tela só: esqueleto já aceito + compromissos.', 'Três sugestões (em andamento e High). Arrastar ou “colocar no próximo bloco compatível”.', 'Conflitos aparecem inline e não bloqueiam o início.'],
    r: () => win(`${hdr('Modo rápido', 'Segunda, 28 set', btn('Planejamento completo', { ghost: true }))}
      <div class="wf-split r">
        ${tl([...TPL, ...MEET], { pph: 13, every: 4 })}${pin(1)}
        <div class="wf-col"><div class="wf-card">${lbl('Sugestões', ' ' + pin(2))}
          ${task('Fix Sortie sync', '→ Maker', { c: 'orange', pri: 'h' })}${task('Relatório semanal', '→ Work', { c: 'blue', pri: 'h' })}${task('Praticar “Numb”', '→ Music', { c: 'purple', pri: 'h' })}</div>
          <div class="wf-banner warn sm">${I('alert')}<span>Engineering Weekly sobrepõe Work</span>${pin(3)}</div>
          ${btn('INICIAR DIA', { pri: true, ic: 'play' })}</div></div>`),
  };

  W.active = {
    t: 'Hoje · dia ativo', kind: 'desktop',
    notes: ['Agora: bloco atual, tempo restante e o timer da tarefa em foco.', 'Próximo: sempre visível, sem precisar rolar.', 'A linha NOW cruza a timeline. Blocos passados com registro real ganham ✓.', 'Tarefas do dia num painel recolhível.'],
    r: () => win(`${hdr('Hoje', 'Segunda, 28 set · dia iniciado 06:01', `${seg(['Plano', 'Real', 'Comparar'])}${btn('Fechar dia', { ghost: true, ic: 'moon' })}`)}
      <div class="wf-active">
        <div class="wf-col">${nowCard({ p1: 1 })}${nextCard(2)}</div>
        <div class="wf-col">${tl(mod(TPL, b => b.b <= 10 ? { check: true, dim: false } : {}).concat(MEET).map(b => b.n === 'Work' && b.a === 10 ? Object.assign({}, b, { tasks: [['Relatório semanal', '45m']] }) : b), { pph: 16, now: 10.62 })}${pin(3)}</div>
        <div class="wf-card tasks">${lbl('Hoje', ' ' + pin(4))}${task('Fix Sortie sync', '1h42', { c: 'orange', pri: 'h' })}${task('Relatório semanal', '▶ 18:42', { c: 'blue', pri: 'h', sel: true })}${task('Praticar “Numb”', '1h', { c: 'purple' })}${task('Enviar trimestral', 'prazo', { c: 'blue', pri: 'h' })}
          <div class="wf-grp">Concluídas</div>${task('Imprimir case', '32m', { c: 'orange', done: true })}</div>
      </div>`),
  };

  W.focusEnd = {
    t: 'Timer · fim de uma sessão de foco', kind: 'desktop',
    notes: ['Som suave e quatro escolhas. Finalizar sessão não conclui a tarefa.', 'Sessões da tarefa como pontos; o tempo acumulado passa da estimativa sem alarme vermelho.'],
    r: () => win(`${hdr('Hoje', 'Segunda, 28 set')}
      <div class="wf-split">
        <div class="wf-card now">${lbl('Foco concluído')}<div class="wf-timer big"><span>25:00</span>${I('check', 'sm')}</div>
          <div class="wf-task inset"><i class="cb"></i>${dot('orange')}<span class="tt">Implementar sync de calendário</span></div>
          <div class="wf-row wrap">${btn('Iniciar pausa 5:00', { pri: true, ic: 'coffee' })}${btn('+5 min')}${btn('Finalizar sessão')}${btn('Concluir tarefa', { ic: 'check' })}${pin(1)}</div></div>
        <div class="wf-card">${lbl('Esta tarefa', ' ' + pin(2))}<div class="wf-sessions"><i class="on"></i><i class="on"></i><i class="on"></i><i></i></div>
          <div class="wf-kv"><span>Estimado</span><b>1h</b><span>Rastreado</span><b>1h15</b><span>Sessões</span><b>3</b></div>${bar(100, 'orange')}<div class="wf-sub">+15 min sobre a estimativa · continua em andamento</div></div>
      </div>`),
  };

  W.forgot = {
    t: 'Timer esquecido ligado', kind: 'desktop',
    notes: ['Ao voltar ao app, uma pergunta em vez de um registro de 3h errado.', 'Atalhos com horários prováveis (fim do bloco, última interação).'],
    r: () => win(`${hdr('Hoje', 'Segunda, 28 set · 13:52')}
      <div class="wf-dialog"><div class="wf-title">${I('clock', 'sm')} O timer está rodando há 3h12 ${pin(1)}</div><div class="wf-sub">Fix Sortie sync · iniciado às 10:40</div>
        <div class="wf-lbl">Parou quando? ${pin(2)}</div><div class="wf-row wrap"><span class="wf-chip">11:00 · fim do bloco</span><span class="wf-chip on">11:25 · última interação</span><span class="wf-chip">Agora</span><span class="wf-chip">Outro horário…</span></div>
        <div class="wf-row end">${btn('Descartar sessão', { ghost: true })}${btn('Salvar 45 min', { pri: true })}</div></div>`),
  };

  W.palette = {
    t: 'Command palette (⌘K) e captura rápida', kind: 'desktop',
    notes: ['⌘K de qualquer tela. Digitar e Enter manda para o Inbox, sem nenhum campo obrigatório.', 'Todas as ações do app com atalho, sem menus.', 'Toast com Desfazer; o foco volta para onde estava.'],
    r: () => win(`${hdr('Hoje', 'Segunda, 28 set')}<div class="wf-ghostlines"><i></i><i></i><i></i><i></i><i></i></div>`, {
      overlay: `<div class="wf-overlay"><div class="wf-palette"><div class="wf-pin-in">${I('search', 'sm')}<span>Comprar PETG</span><kbd>↵</kbd>${pin(1)}</div>
        <div class="wf-cmds">${[['inbox', 'Nova tarefa no Inbox', '“Comprar PETG”', 'N', true], ['plus', 'Adicionar bloco', '', 'B'], ['clock', 'Iniciar timer', '', ''], ['play', 'Iniciar atividade', 'fora do plano', ''], ['history', 'Registrar tempo passado', '', ''], ['refresh', 'Replanejar restante do dia', '', ''], ['moon', 'Fechar dia', '', '']].map(([ic, t, s, k, on]) => `<div class="wf-cmd${on ? ' on' : ''}">${I(ic)}<b>${t}</b><span>${s}</span>${k ? `<kbd>${k}</kbd>` : ''}</div>`).join('')}${pin(2)}</div></div>
        <div class="wf-toast">${I('check')}Adicionada ao Inbox · <u>Desfazer</u>${pin(3)}</div></div>`,
    }),
  };

  W.mobile = {
    t: 'Celular (PWA) · Hoje e captura rápida', kind: 'phone',
    notes: ['Mobile prioriza Agora, Próximo e a timeline. Nada de densidade de desktop.', '+ abre uma bottom sheet com um campo só.', 'Navegação: Hoje · Tarefas · Histórico · Mais.'],
    r: () => `<div class="wf-phones">${phone(`<div class="ph-h"><b>Hoje</b><span class="wf-sub">Seg 28 set</span></div>
        <div class="wf-card now sm">${lbl('Agora ', pin(1))}<div class="wf-big">${dot('cyan')}Drive / Leo</div><div class="wf-row sp"><span class="wf-sub">até 10:00 · 23 min</span>${bar(60, 'cyan')}</div>${btn('Comecei', { ic: 'play' })}</div>
        <div class="wf-card sm">${lbl('Próximo')}<div class="wf-big sm">${dot('blue')}Work · 10:00</div></div>
        ${tl(TPL.slice(1, 6), { from: 9, to: 15, pph: 18, now: 9.62, every: 1, left: 26 })}
        <div class="ph-tabs"><span class="on">${I('home')}Hoje</span><span>${I('tasks')}Tarefas</span><span class="fab">${I('plus')}</span><span>${I('history')}Histórico</span><span>${I('menu')}Mais</span>${pin(3)}</div>`)}
      ${phone(`<div class="ph-h"><b>Hoje</b><span class="wf-sub">Seg 28 set</span></div><div class="wf-ghostlines"><i></i><i></i><i></i><i></i></div>
        <div class="ph-sheet">${lbl('Tarefa rápida ', pin(2))}<div class="wf-input on">Comprar PETG<i class="caret"></i></div><div class="wf-row sp"><span class="wf-sub">vai para o Inbox</span>${btn('Adicionar', { pri: true })}</div><div class="ph-kb">${'qwertyuiop'.split('').map(k => `<i>${k}</i>`).join('')}</div></div>`)}</div>`,
  };

  W.conflict = {
    t: 'Conflito durante o dia', kind: 'desktop',
    notes: ['Banner inline, nunca modal. A reunião chegou pelo sync do Outlook.', 'Sobreposição destacada na timeline.', 'Prévia da opção “Mover”: Music tracejado às 13:00.', 'Cada escolha vira uma Plan Revision; o Baseline não muda.'],
    r: () => win(`<div class="wf-banner warn">${I('calendar', 'sm')}<div><b>Nova reunião: Sync com cliente 11:30–12:00</b><span>Colide com Music 11:00–12:00 · Outlook · 10:42</span></div>${pin(1)}</div>
      <div class="wf-row wrap">${btn('Manter sobreposição')}${btn('Mover Music', { pri: true, ic: 'move' })}${btn('Encurtar')}${btn('Remover')}${btn('Replanejar restante', { ghost: true, ic: 'refresh', p: 4 })}</div>
      <div class="wf-split r">
        ${tl([{ a: 10, b: 11, n: 'Work', c: 'blue', check: true }, { a: 11, b: 12, n: 'Music', c: 'purple', warn: true, p: 2 }, { a: 11.5, b: 12, n: 'Sync com cliente', c: 'gray', cal: true, l: '56%' }, { a: 12, b: 13, n: 'Lunch', c: 'yellow' }, { a: 13, b: 14, n: 'Music', c: 'purple', ghost: true, p: 3, notime: true }, { a: 14, b: 17.5, n: 'Work', c: 'blue' }], { from: 10, to: 16, pph: 30, every: 1, now: 10.7 })}
        <div class="wf-card">${lbl('Se mover')}<div class="wf-diff"><span class="old">Music 11:00–12:00</span>${I('arrowR')}<span class="new">Music 13:00–14:00</span></div><div class="wf-sub">Lunch encurta para 12:00–13:00. FlightSim sai hoje.</div></div>
      </div>`),
  };

  W.replan = {
    t: 'Replanejar restante do dia e histórico de revisões', kind: 'desktop',
    notes: ['Proposta determinística: respeita blocos Fixos, move Flexíveis para os espaços livres. Eu confirmo ou ajusto.', 'O Inspector guarda a história do dia: Baseline → R1 → R2 → R3, com horário e motivo.'],
    r: () => win(`${hdr('Replanejar restante do dia', 'a partir de 13:00 · 2 blocos fixos · 3 flexíveis')}
      <div class="wf-cols2">
        <div class="wf-card">${lbl('Atual → proposta ', pin(1))}<div class="wf-cmp">
          ${tl([{ a: 13, b: 14, n: 'FlightSim', c: 'yellow', warn: true }, { a: 14, b: 15, n: 'Eng. Weekly', c: 'gray', cal: true, lock: true }, { a: 15, b: 17.5, n: 'Work', c: 'blue' }, { a: 17.5, b: 18.5, n: 'Drive', c: 'cyan', lock: true }], { from: 13, to: 19, pph: 22, every: 1, left: 26 })}
          ${tl([{ a: 13.5, b: 14, n: 'FlightSim', c: 'yellow' }, { a: 14, b: 15, n: 'Eng. Weekly', c: 'gray', cal: true, lock: true }, { a: 15, b: 18, n: 'Work', c: 'blue' }, { a: 18, b: 19, n: 'Drive', c: 'cyan', lock: true }], { from: 13, to: 19, pph: 22, every: 1, left: 26 })}</div>
          <div class="wf-row end">${btn('Ajustar', { ghost: true })}${btn('Aplicar proposta', { pri: true })}</div></div>
        <div class="wf-card">${lbl('Histórico do dia ', pin(2))}<div class="wf-revs">
          ${[['06:01', 'Baseline', 'Plano aceito no Iniciar dia', 'gray'], ['09:10', 'Revisão 1', 'Work encurtado · reunião inesperada', 'orange'], ['11:05', 'Revisão 2', 'Music removido · buscar Leo', 'orange'], ['13:02', 'Revisão 3', 'Replanejar restante · 3 blocos', 'purple']].map(([t, n, d, c]) => `<div class="wf-rev"><i style="background:var(--accent-${c === 'gray' ? 'cyan' : c})"></i><span class="mono">${t}</span><div><b>${n}</b><span>${d}</span></div></div>`).join('')}</div></div>
      </div>`),
  };

  W.publish = {
    t: 'Proteger tempo: publicar bloco como Busy', kind: 'desktop',
    notes: ['Por bloco: Interno, Google, Microsoft ou Ambos.', 'O escudo mostra que existe um evento externo criado pelo DailyFlow. Mover o bloco move o evento.', 'Excluir pergunta onde excluir. O DailyFlow só mexe no que ele mesmo criou.'],
    r: () => win(`${hdr('Hoje', 'Segunda, 28 set')}
      <div class="wf-split r">
        ${tl([{ a: 13, b: 14, n: 'Music', c: 'purple' }, { a: 14, b: 15.5, n: 'Focus Work', c: 'blue', shield: true, sel: true, p: 2 }, { a: 15.5, b: 17.5, n: 'Work', c: 'blue' }], { from: 13, to: 18, pph: 34, every: 1 })}
        <div class="wf-col"><div class="wf-card">${lbl('Focus Work · 14:00–15:30')}
          <div class="wf-field"><span>Publicar em ${pin(1)}</span>${seg(['Interno', 'Google', 'Microsoft', 'Ambos'], 2)}</div>
          <div class="wf-field"><span>Disponibilidade</span>${seg(['Busy', 'Free'], 0)}</div>
          <div class="wf-ok">${I('shield')}Publicado no Outlook · sincronizado 13:58</div></div>
          <div class="wf-card">${lbl('Excluir bloco ', pin(3))}<div class="wf-col tight">${btn('Excluir só no DailyFlow')}${btn('Excluir aqui e no Outlook')}${btn('Cancelar', { ghost: true })}</div></div></div>
      </div>`),
  };

  W.closeRepair = {
    t: 'Fechar dia · Passo 1 · Reparar o real', kind: 'desktop',
    notes: ['Plano final (tracejado) ao lado do real (sólido). A pergunta é uma só: isso representa o que aconteceu?', 'Lacunas em hachurado, com ações de 1 clique.', 'Atalho para dias em que nada foi rastreado: o plano vira o ponto de partida do real.'],
    r: () => win(`${stepper(1, ['Real', 'Tarefas', 'Reflexão', 'Resumo'])}
      <div class="wf-close">
        <div class="wf-cmp">
          <div>${lbl('Plano final')}${tl([{ a: 10, b: 11, n: 'Work', c: 'blue' }, { a: 11.5, b: 12, n: 'Sync', c: 'gray', cal: true }, { a: 12, b: 13, n: 'Lunch', c: 'yellow' }, { a: 13, b: 14, n: 'Music', c: 'purple' }, { a: 14, b: 18, n: 'Work', c: 'blue' }].map(b => Object.assign(b, { prov: true })), { from: 10, to: 18, pph: 22, every: 1, left: 26 })}</div>
          <div>${lbl('Real ', pin(1))}${tl([{ a: 10.08, b: 11.47, n: 'Work', c: 'blue' }, { a: 11.5, b: 12, n: 'Sync', c: 'gray', cal: true }, { a: 12, b: 13.08, n: 'Sem registro', gap: true, p: 2 }, { a: 13.13, b: 13.87, n: 'Music', c: 'purple' }, { a: 14.08, b: 18, n: 'Work', c: 'blue' }], { from: 10, to: 18, pph: 22, every: 1, left: 26 })}</div>
        </div>
        <div class="wf-col">
          <div class="wf-card">${lbl('12:00–13:05 · sem registro')}<div class="wf-row wrap">${btn('Preencher: Lunch', { pri: true })}${btn('Estender anterior')}${btn('Começar Music antes')}${btn('Tempo aberto')}${btn('Ignorar', { ghost: true })}</div></div>
          <div class="wf-card">${lbl('Nada rastreado hoje?')}${btn('Aceitar plano final como real', { ic: 'copy', p: 3 })}<div class="wf-sub">Depois é só ajustar as bordas arrastando.</div></div>
          <div class="wf-row end">${btn('Continuar', { pri: true, ic: 'arrowR' })}</div>
        </div></div>`),
  };

  W.closeTasks = {
    t: 'Fechar dia · Passos 2 e 3 · Tarefas e reflexão', kind: 'desktop',
    notes: ['Não concluídas voltam ao Backlog com o histórico. Nada vai sozinho para amanhã.', 'Reflexão opcional. “Pular” está sempre ao lado.'],
    r: () => win(`${stepper(2, ['Real', 'Tarefas', 'Reflexão', 'Resumo'])}
      <div class="wf-cols3">
        <div class="wf-card">${lbl('Concluídas · 2')}${task('Relatório semanal', '52m', { c: 'blue', done: true })}${task('Imprimir case', '32m', { c: 'orange', done: true })}</div>
        <div class="wf-card">${lbl('Em andamento · 1 ', pin(1))}${task('Fix Sortie sync', '1h40', { c: 'orange', pri: 'h' })}<div class="wf-back">${I('arrowR')}Backlog · 4 sessões</div></div>
        <div class="wf-card">${lbl('Não iniciadas · 1')}${task('Praticar “Numb”', '1h', { c: 'purple' })}<div class="wf-back">${I('arrowR')}Backlog</div></div>
      </div>
      <div class="wf-card">${lbl('Reflexão · opcional ', pin(2))}<div class="wf-refl"><div class="wf-input area">Dia bom apesar do almoço atrasado…</div><div><span class="wf-sub">Energia</span><div class="wf-energy"><i class="on"></i><i class="on"></i><i class="on"></i><i class="on"></i><i></i></div></div></div>
        <div class="wf-row end">${btn('Pular', { ghost: true })}${btn('Continuar', { pri: true, ic: 'arrowR' })}</div></div>`),
  };

  W.summary = {
    t: 'Fechar dia · Passo 4 · Resumo', kind: 'desktop',
    notes: ['Números descritivos, sem nota ou pontuação.', 'Distribuição por área numa barra só.', 'Dia fechado continua editável: Reabrir. Planejar amanhã é proposta (Q-08).'],
    r: () => win(`${stepper(4, ['Real', 'Tarefas', 'Reflexão', 'Resumo'])}
      <div class="wf-stats">${[['15h00', 'Planejado'], ['14h12', 'Registrado'], ['3', 'Revisões'], ['2 / 5', 'Tarefas concluídas']].map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('')}${pin(1)}</div>
      <div class="wf-card">${lbl('Onde o tempo foi ', pin(2))}<div class="wf-stack">${[['blue', 34, 'Work 5h04'], ['green', 21, 'Family 3h08'], ['orange', 16, 'Maker 2h21'], ['cyan', 12, 'Commute 1h43'], ['yellow', 8, 'FlightSim 1h12'], ['purple', 5, 'Music 0h44'], ['pink', 4, 'Reading']].map(([c, w]) => `<i style="width:${w}%;background:var(--accent-${c})"></i>`).join('')}</div>
        <div class="wf-legend">${[['blue', 'Work 5h04'], ['green', 'Family 3h08'], ['orange', 'Maker 2h21'], ['cyan', 'Commute 1h43'], ['yellow', 'FlightSim 1h12'], ['purple', 'Music 0h44']].map(([c, l]) => `<span>${dot(c)}${l}</span>`).join('')}</div></div>
      <div class="wf-start"><div><b>${I('check')} Dia fechado</b><span class="wf-sub">Segunda, 28 set · 21:05</span></div><span class="sp"></span>${btn('Reabrir', { ghost: true })}${btn('Planejar amanhã', { p: 3 })}</div>`),
  };

  W.nextday = {
    t: 'Dia seguinte · continuar de onde parou', kind: 'desktop',
    notes: ['A tarefa não concluída aparece em destaque, com tempo e sessões. Eu decido se entra hoje.'],
    r: () => win(`${stepper(1)}
      <div class="wf-card hl">${lbl('Continuar de dias anteriores ', pin(1))}
        <div class="wf-cont">${dot('orange')}<div><b>Fix Sortie sync</b><span>1h40 rastreado · 4 sessões · estimado 1h · parado ontem 08:55</span></div><span class="sp"></span>${bar(100, 'orange')}${btn('Planejar hoje', { ic: 'plus' })}${btn('Deixar no Backlog', { ghost: true })}</div>
        <div class="wf-cont">${dot('purple')}<div><b>Praticar “Numb”</b><span>não iniciada ontem</span></div><span class="sp"></span>${btn('Planejar hoje', { ic: 'plus' })}${btn('Deixar no Backlog', { ghost: true })}</div></div>
      <div class="wf-ghostlines"><i></i><i></i><i></i></div>`),
  };

  W.history = {
    t: 'Histórico · calendário e dia', kind: 'desktop',
    notes: ['Cada dia mostra a própria “forma”: faixas coloridas por área.', 'Estado do dia: fechado, fechado automaticamente ou aberto.', 'Dia aberto em abas: Baseline, Final, Real, Tarefas, Stats, Revisões. O real é editável.'],
    r: () => {
      const days = Array.from({ length: 14 }, (_, i) => i);
      const strip = i => { const pats = [['orange', 'cyan', 'blue', 'purple', 'yellow', 'blue', 'green'], ['orange', 'cyan', 'blue', 'blue', 'yellow', 'blue', 'green'], ['green', 'green', 'yellow', 'purple', 'green', 'pink']]; const p = i % 7 >= 5 ? pats[2] : pats[i % 2]; return p.map(c => `<i style="background:var(--accent-${c})"></i>`).join(''); };
      return win(`${hdr('Histórico', 'Setembro 2026', seg(['Calendário', 'Lista']))}
        <div class="wf-hist"><div class="wf-cal">${['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map(d => `<span class="dh">${d}</span>`).join('')}${days.map(i => `<div class="wf-day${i === 8 ? ' sel' : ''}"><span>${15 + i}</span><div class="shape">${strip(i)}</div>${i === 8 ? pin(1) : ''}${i === 6 ? `<em class="auto">auto</em>` : ''}${i === 13 ? `<em class="open">aberto</em>` : ''}</div>`).join('')}</div>
        <div class="wf-card">${lbl('Terça, 23 set ', pin(2))}<div class="wf-row">${seg(['Baseline', 'Final', 'Real', 'Tarefas', 'Stats', 'Revisões'], 2)}</div>${pin(3)}
          ${tl([{ a: 18.5, b: 20, n: 'Family', c: 'green' }, { a: 20, b: 21, n: 'FlightSim', c: 'yellow', sel: true, html: '<div class="wb-edit">adicionado agora · edição histórica</div>' }, { a: 21, b: 22, n: 'Reading', c: 'pink' }], { from: 18, to: 22.5, pph: 26, every: 1 })}</div></div>`, { active: 'historico' });
    },
  };

  W.tasks = {
    t: 'Tarefas · lista, triagem e detalhe', kind: 'desktop',
    notes: ['Grupos em segmented control. Filtros compactos; o resto numa gaveta.', 'Triagem com teclado: A área, 1/2/3 prioridade, E estimativa.', 'Detalhe com revelação progressiva: título e o essencial primeiro, histórico depois.'],
    r: () => win(`${hdr('Tarefas', '', btn('+ Tarefa', { ic: 'plus' }))}
      <div class="wf-row wrap">${seg(['Inbox 7', 'Em andamento 2', 'Backlog 24', 'Concluídas'], 0)}${pin(1)}<span class="wf-chip">${I('filter')}Prioridade</span><span class="wf-chip">Área</span><span class="wf-chip">Projeto</span><span class="wf-chip">Mais filtros</span></div>
      <div class="wf-split r">
        <div class="wf-card list">${task('Comprar PETG', '', { c: 'cyan', sel: true })}
          <div class="wf-triage">${pin(2)}<span class="wf-chip"><kbd>A</kbd>${dot('orange')}Maker</span><span class="wf-chip"><kbd>1</kbd>High <kbd>2</kbd>Med <kbd>3</kbd>Low</span><span class="wf-chip"><kbd>E</kbd>15m</span><span class="sp"></span>${btn('→ Backlog')}${btn('→ Hoje')}${btn('Arquivar', { ghost: true })}</div>
          ${task('Ligar para a oficina', '', { c: 'cyan' })}${task('Ideia: widget de foco', '', { c: 'cyan' })}${task('Revisar orçamento', '', { c: 'cyan' })}${task('Pesquisar HOTAS', '', { c: 'cyan' })}</div>
        <div class="wf-card">${lbl('Detalhe ', pin(3))}<div class="wf-big sm">Fix Sortie sync</div>
          <div class="wf-kv"><span>Área</span><b>${dot('orange')}Maker</b><span>Prioridade</span><b>High</b><span>Estimativa</span><b>1h</b><span>Rastreado</span><b class="warn">1h40</b><span>Prazo</span><b>—</b></div>
          <div class="wf-more">${I('chev')}Projeto, tags, subtarefas, notas</div><div class="wf-more">${I('chev')}Histórico · 4 sessões em 2 dias</div>
          ${btn('Iniciar foco', { ic: 'play' })}</div>
      </div>`, { active: 'tarefas' }),
  };

  W.insights = {
    t: 'Insights · semana', kind: 'desktop',
    notes: ['Distribuição por área, com a semana anterior como referência apagada.', 'Planejado × real por área.', 'Calibração: quanto cada categoria costuma estourar.', 'Formato do dia: padrões que se repetem.'],
    r: () => {
      const areas = [['Work', 'blue', 88, 80], ['Family', 'green', 62, 70], ['Maker', 'orange', 40, 30], ['Commute', 'cyan', 26, 26], ['Music', 'purple', 12, 30], ['FlightSim', 'yellow', 18, 14]];
      const shape = [['S', ['orange', 'cyan', 'blue', 'purple', 'yellow', 'blue', 'cyan', 'green']], ['T', ['orange', 'cyan', 'blue', 'blue', 'yellow', 'blue', 'cyan', 'green']], ['Q', ['gray', 'cyan', 'blue', 'purple', 'yellow', 'blue', 'cyan', 'green']], ['Q', ['orange', 'cyan', 'blue', 'purple', 'yellow', 'blue', 'cyan', 'green']], ['S', ['orange', 'cyan', 'blue', 'gray', 'yellow', 'blue', 'green', 'green']]];
      return win(`${hdr('Insights', '22–28 set', seg(['Hoje', 'Semana', 'Mês', 'Período'], 1))}
        <div class="wf-cols2">
          <div class="wf-card">${lbl('Life Areas ', pin(1))}${areas.map(([n, c, v, p]) => `<div class="wf-hbar"><span>${n}</span><div><i style="width:${v}%;background:var(--accent-${c})"></i><b style="left:${p}%"></b></div></div>`).join('')}</div>
          <div class="wf-card">${lbl('Planejado × real ', pin(2))}<div class="wf-vbars">${areas.slice(0, 5).map(([n, c, v, p]) => `<div><span class="p" style="height:${p * .7}px"></span><span style="height:${v * .7}px;background:var(--accent-${c})"></span><em>${n.slice(0, 4)}</em></div>`).join('')}</div></div>
          <div class="wf-card">${lbl('Estimativas ', pin(3))}<div class="wf-mult"><b>1,5×</b><span>Desenvolvimento<br>estimado 52m · real 78m</span></div><div class="wf-mult"><b>1,1×</b><span>Música<br>estimado 45m · real 50m</span></div></div>
          <div class="wf-card">${lbl('Formato do dia ', pin(4))}<div class="wf-shape">${shape.map(([d, cs]) => `<div><span>${d}</span>${cs.map(c => `<i style="background:var(--accent-${c === 'gray' ? 'cyan' : c});${c === 'gray' ? 'opacity:.15' : ''}"></i>`).join('')}</div>`).join('')}</div></div>
        </div>`, { active: 'insights' });
    },
  };

  W.template = {
    t: 'Configurações · editar template', kind: 'desktop',
    notes: ['Mesma timeline do Hoje, agora editando o padrão.', 'Cada bloco com área, tipo (Fixo/Flexível) e duração mínima (usada no replanejamento).', 'Mudanças valem a partir do próximo dia não iniciado.'],
    r: () => win(`${hdr('Configurações', '', '')}
      <div class="wf-settings"><div class="wf-slist">${['Templates', 'Life Areas', 'Categorias', 'Presets de foco', 'Calendários', 'Notificações', 'Exibição', 'Sync', 'Exportar dados'].map((x, i) => `<span${i === 0 ? ' class="on"' : ''}>${x}</span>`).join('')}</div>
        <div class="wf-col"><div class="wf-row">${seg(['Weekday', 'Weekend'], 0)}${pin(1)}</div>
          <div class="wf-split r">${tl(mod(TPL, (b, i) => i === 3 ? { a: 7, b: 8, sel: true } : i === 0 ? { b: 7 } : {}).concat([{ a: 8, b: 9, n: 'Maker', c: 'orange' }]), { pph: 12, every: 4 })}
            <div class="wf-card">${lbl('Music ', pin(2))}<div class="wf-kv"><span>Área</span><b>${dot('purple')}Music</b><span>Tipo</span><b>Flexível</b><span>Horário</span><b>07:00–08:00</b><span>Mínimo</span><b>30m</b></div>
            <div class="wf-banner info sm">${I('info')}<span>Vale a partir de amanhã. Hoje já foi iniciado.</span>${pin(3)}</div></div></div></div></div>`, { active: 'config' }),
  };

  W.calendars = {
    t: 'Configurações · calendários (Fase 2)', kind: 'desktop',
    notes: ['Classificação padrão por calendário. Cada evento pode ter exceção.', 'Status de sincronização sempre visível, com erro claro e “Tentar de novo”.'],
    r: () => win(`${hdr('Calendários', 'Configurações', btn('+ Conectar conta', { ic: 'plus' }))}
      <div class="wf-card">${lbl('Google · pessoal@gmail.com ', pin(1))}
        ${[['Pessoal', 'Commitment', 0], ['Família (compartilhado)', 'Awareness', 1], ['Feriados', 'Oculto', 2]].map(([n, v, i]) => `<div class="wf-q">${I('calendar')}<b>${n}</b><span class="sp"></span>${seg(['Commitment', 'Awareness', 'Oculto'], i)}</div>`).join('')}
        ${lbl('Microsoft 365 · trabalho')}<div class="wf-q">${I('calendar')}<b>Trabalho</b><span class="sp"></span>${seg(['Commitment', 'Awareness', 'Oculto'], 0)}</div></div>
      <div class="wf-row wrap"><span class="wf-ok">${I('check')}Google sincronizado há 2 min</span><span class="wf-err">${I('alert')}Microsoft: token expirado</span>${btn('Reconectar')}${pin(2)}</div>`, { active: 'config' }),
  };

  W.offline = {
    t: 'Offline', kind: 'desktop',
    notes: ['Indicador discreto no topo; nenhuma tela trava esperando rede.', 'Mudanças aplicadas na hora e enfileiradas. Quando a conexão volta, a fila sobe sozinha.'],
    r: () => win(`${hdr('Hoje', 'Segunda, 28 set', `<span class="wf-chip warn">${I('cloudOff')}Offline · 4 alterações neste dispositivo</span>${pin(1)}`)}
      <div class="wf-split">
        ${tl(TPL.slice(0, 6), { from: 6, to: 14, pph: 20, every: 1, now: 10.6 })}
        <div class="wf-card">${lbl('Fila de sincronização ', pin(2))}${[['plus', 'Tarefa criada', 'Comprar PETG'], ['move', 'Bloco movido', 'Music 11:00 → 13:00'], ['clock', 'Sessão de foco', '25 min · Fix Sortie'], ['check', 'Tarefa concluída', 'Relatório semanal']].map(([ic, a, b]) => `<div class="wf-li">${I(ic, 'sm')}<div><b>${a}</b><span>${b}</span></div><em class="q">na fila</em></div>`).join('')}
          <div class="wf-ok">${I('refresh')}Conexão voltou · sincronizando…</div></div></div>`),
  };

  W.widget = {
    t: 'Widgets Android (Fase 5)', kind: 'phone',
    notes: ['Bloco atual e próximo, sem abrir o app.', 'Timeline compacta.', 'Lista de tarefas configurável (Em andamento, High, Hoje).'],
    r: () => `<div class="wf-phones">${phone(`<div class="ph-wall">
        <div class="wd big">${pin(1)}<span class="wf-lbl">Agora</span><b>${dot('blue')}Work</b><span>10:00–11:00 · 18 min</span>${bar(70)}<span class="wf-sub">Próximo: Music · 11:00</span></div>
        <div class="wd-row"><div class="wd">${pin(2)}${[['10', 'Work', 'blue'], ['11', 'Music', 'purple'], ['12', 'Lunch', 'yellow'], ['14', 'Work', 'blue'], ['18', 'Family', 'green']].map(([h, n, c]) => `<div class="wd-l"><em>${h}</em>${dot(c)}${n}</div>`).join('')}</div>
        <div class="wd">${pin(3)}<span class="wf-lbl">Tarefas</span>${['Fix Sortie', 'Praticar violão', 'Comprar PETG'].map(t => `<div class="wd-l"><i class="cb"></i>${t}</div>`).join('')}</div></div>
        <div class="ph-apps">${'<i></i>'.repeat(8)}</div></div>`)}
      ${phone(`<div class="ph-lock"><div class="lk-time">10:42</div><div class="lk-date">segunda, 28 de setembro</div><div class="wd glass"><span class="wf-lbl">DailyFlow</span><b>Work · até 11:00</b><span>Próximo: Music</span></div><div class="wf-sub center">Tela de bloqueio · a investigar</div></div>`)}</div>`,
  };

  W.midnight = {
    t: 'Dia que cruza a meia-noite', kind: 'desktop',
    notes: ['A virada do dia lógico é configurável (ex.: 04:00). Registros não são cortados à meia-noite.'],
    r: () => win(`${hdr('Hoje', 'Segunda, 28 set · 23:40')}
      ${tl([{ a: 21, b: 22, n: 'Reading', c: 'pink' }, { a: 22, b: 24.67, n: 'Filme', c: 'purple', html: '<div class="wb-edit">continua depois da meia-noite</div>' }, { a: 24.67, b: 28, n: 'Sleep', c: 'blue', prov: true }], { from: 21, to: 29, pph: 22, every: 1 })}
      <div class="wf-cut">${I('moon')}<span>Virada do dia lógico · 04:00</span>${pin(1)}</div>`),
  };

  W.cancelled = {
    t: 'Evento externo cancelado', kind: 'desktop',
    notes: ['O sync retira o evento e registra a revisão sozinho.', 'Sugestão discreta para usar o tempo liberado. Ignorar é o padrão.'],
    r: () => win(`${hdr('Hoje', 'Segunda, 28 set · 14:10')}
      <div class="wf-split r">${tl([{ a: 14, b: 15, n: 'Engineering Weekly (cancelada)', c: 'gray', ghost: true, p: 1 }, { a: 15, b: 17.5, n: 'Work', c: 'blue' }, { a: 13, b: 14, n: 'Music', c: 'purple', check: true }], { from: 13, to: 18, pph: 30, every: 1, now: 14.17 })}
        <div class="wf-col"><div class="wf-banner info">${I('calendar', 'sm')}<div><b>1h liberada às 14:00</b><span>Engineering Weekly foi cancelada no Outlook</span></div>${pin(2)}</div><div class="wf-row">${btn('Estender Work')}${btn('Mover tarefa para cá')}${btn('Deixar livre', { ghost: true })}</div></div></div>`),
  };


  /* ── Telas por etapa ── */
  const nowPlain = (p = '') => `<div class="wf-card now">${lbl('Agora', p ? ' ' + pin(p) : '')}<div class="wf-big">${dot('blue')}Work<span class="wf-sub">10:00–11:00</span></div><div class="wf-row sp"><span class="wf-sub">23 min restantes</span>${bar(62)}</div></div>`;
  const CLOSE2 = ['Real', 'Resumo'];

  W.checkin = {
    t: 'Kit de validação · check-in diário', kind: 'desktop',
    notes: ['As perguntas são as da etapa em andamento; mudam a cada etapa.', 'Respostas objetivas (escalas e opções) viram eventos validation_answered, fáceis de analisar.', 'Sempre pulável. O pulo também é registrado.'],
    r: () => win(`${hdr('Fechar dia', 'Segunda, 28 set')}<div class="wf-ghostlines"><i></i><i></i><i></i><i></i></div>`, {
      overlay: `<div class="wf-overlay"><div class="wf-dialog" style="margin-top:0"><div class="wf-row sp"><div class="wf-title">${I('help', 'sm')} Check-in · Etapa 2</div><span class="wf-chip">3 perguntas · ~20 s</span>${pin(1)}</div>
        <div class="wf-qz"><b>O real registrado hoje representa o dia?</b><div class="wf-row">${[1, 2, 3, 4, 5].map(n => `<span class="wf-chip${n === 4 ? ' on' : ''}">${n}</span>`).join('')}${pin(2)}</div></div>
        <div class="wf-qz"><b>Quanto tempo levou para fechar o dia?</b><div class="wf-row wrap">${['< 1 min', '1–3 min', '3–5 min', '> 5 min'].map((x, i) => `<span class="wf-chip${i === 1 ? ' on' : ''}">${x}</span>`).join('')}</div></div>
        <div class="wf-qz"><b>Você registrou ao vivo ou depois?</b><div class="wf-row wrap">${['Ao vivo', 'Misto', 'Tudo depois'].map((x, i) => `<span class="wf-chip${i === 1 ? ' on' : ''}">${x}</span>`).join('')}</div></div>
        <div class="wf-row end">${btn('Pular', { ghost: true, p: 3 })}${btn('Enviar', { pri: true })}</div></div></div>`,
    }),
  };

  W.logs = {
    t: 'Kit de validação · Dados de validação', kind: 'desktop',
    notes: ['Resumo do que está sendo coletado na etapa atual.', 'Cada evento com hora, nome e propriedades, do jeito que será analisado.', 'Exportar para eu analisar (ou eu leio direto do banco).'],
    r: () => win(`${hdr('Dados de validação', 'Configurações · Etapa 2 · Plano × Real', `${btn('JSON', { ic: 'download' })}${btn('CSV', { ic: 'download', p: 3 })}`)}
      <div class="wf-stats">${[['214', 'eventos hoje'], ['9', 'sessões'], ['6 / 7', 'check-ins'], ['0', 'erros']].map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('')}${pin(1)}</div>
      <div class="wf-row">${seg(['Hoje', 'Esta etapa', 'Tudo'], 0)}<span class="wf-chip">${I('filter')}Evento</span></div>
      <div class="wf-card" style="padding:0">${pin(2)}<div class="wf-log">${[
        ['21:04', 'validation_answered', 'question=E2.d1 value=4'], ['21:03', 'day_closed', 'duration_s=138 tracked_min=852 gap_min=12'], ['21:02', 'gap_filled', 'method=fill area=lunch gap_min=65'],
        ['18:31', 'block_started', 'block=family source=live delay_min=1'], ['17:29', 'block_finished', 'block=work source=live'], ['10:05', 'block_started', 'block=work source=live delay_min=5'], ['06:01', 'day_started', 'implicit=false minutes_after_first_open=3'],
      ].map(([t, e, pr]) => `<div><span class="mono">${t}</span><b class="mono">${e}</b><span class="mono">${pr}</span></div>`).join('')}</div></div>`, { active: 'config' }),
  };

  W.retro = {
    t: 'Kit de validação · retro da etapa', kind: 'desktop',
    notes: ['Critérios da etapa com o valor medido nos logs.', 'Perguntas de fim de etapa, mais longas que o check-in diário.', 'Toda etapa termina numa decisão registrada.'],
    r: () => win(`${hdr('Retro · Etapa 2 · Plano × Real', '14 dias · 22 set – 5 out')}
      <div class="wf-cols2">
        <div class="wf-card">${lbl('Critérios ', pin(1))}${[['Dias fechados', '12 / 14 · 86%', '≥ 70%', true], ['Fechamento p50', '2 min 10 s', '< 3 min', true], ['Cobertura do real', '81%', '≥ 85%', false], ['Fidelidade', '4,2', '≥ 4', true]].map(([n, v, m, ok]) => `<div class="wf-metric">${I(ok ? 'check' : 'x')}<b>${n}</b><span>${v}</span><em>meta ${m}</em></div>`).join('')}</div>
        <div class="wf-card">${lbl('Perguntas de fim de etapa ', pin(2))}<div class="wf-qz"><b>Fechar o dia virou hábito?</b><div class="wf-row">${[1, 2, 3, 4, 5].map(n => `<span class="wf-chip${n === 4 ? ' on' : ''}">${n}</span>`).join('')}</div></div>
          <div class="wf-qz"><b>O que deu mais trabalho?</b><div class="wf-row wrap">${['Lembrar de registrar', 'Corrigir horários', 'Escolher área', 'Nada'].map((x, i) => `<span class="wf-chip${i === 0 ? ' on' : ''}">${x}</span>`).join('')}</div></div></div>
      </div>
      <div class="wf-start"><div><b>Decisão</b><span class="wf-sub">cobertura abaixo da meta: lembrar de registrar é o gargalo</span></div><span class="sp"></span>${seg(['Avançar', 'Ajustar e repetir', 'Cortar'], 1)}${pin(3)}</div>`, { active: 'config' }),
  };

  W.s1Today = {
    t: 'E1 · Hoje com blocos, Agora e Próximo', kind: 'desktop',
    notes: ['Agora e Próximo: a primeira coisa que se vê.', 'Timeline do dia com a linha NOW. Nada de tarefas nem rastreio ainda.', 'Editar um bloco muda só hoje; o template continua igual.', 'Adicionar bloco: clique num horário vazio ou em + Bloco.'],
    r: () => win(`${hdr('Hoje', 'Segunda, 28 set · template Weekday', btn('+ Bloco', { ic: 'plus', p: 4 }))}
      <div class="wf-split r">
        <div class="wf-col">${nowPlain(1)}${nextCard()}
          <div class="wf-card">${lbl('Bloco selecionado ', pin(3))}<div class="wf-big sm">${dot('purple')}Music<span class="wf-sub">11:00–12:00</span></div>
            <div class="wf-row wrap">${btn('Renomear')}${btn('Área')}${btn('Excluir', { ghost: true, ic: 'x' })}</div><div class="wf-sub">Só hoje · o template Weekday não muda</div></div></div>
        <div>${tl(mod(TPL, (b, i) => i === 3 ? { sel: true } : {}), { pph: 17, now: 10.62 })}${pin(2)}</div>
      </div>`),
  };

  W.s1Mobile = {
    t: 'E1 · Celular: Agora, Próximo e timeline', kind: 'phone',
    notes: ['No celular, só o essencial para se orientar.', 'Tocar num bloco abre a edição numa bottom sheet.'],
    r: () => `<div class="wf-phones">${phone(`<div class="ph-h"><b>Hoje</b><span class="wf-sub">Seg 28 set</span></div>
      <div class="wf-card now sm">${lbl('Agora ', pin(1))}<div class="wf-big">${dot('blue')}Work</div><div class="wf-row sp"><span class="wf-sub">até 11:00 · 23 min</span>${bar(62)}</div></div>
      <div class="wf-card sm">${lbl('Próximo')}<div class="wf-big sm">${dot('purple')}Music · 11:00</div></div>
      ${tl(mod(TPL.slice(2, 8), (b, i) => i === 1 ? { sel: true, p: 2 } : {}), { from: 10, to: 19, pph: 22, now: 10.62, every: 1, left: 26 })}`)}</div>`,
  };

  W.s2Start = {
    t: 'E2 · Iniciar o dia em 1 clique', kind: 'desktop',
    notes: ['O template do dia, pronto para aceitar como está.', 'Iniciar dia salva o Baseline: é a partir daqui que plano e real se separam.', 'Ajustar antes é opcional; o planejamento guiado só chega na E5.'],
    r: () => win(`<div class="wf-hero"><div class="wf-sub">Bom dia</div><div class="wf-title xl">Segunda, 28 set</div><div class="wf-sub">Ontem: fechado · 14h12 registradas</div></div>
      <div class="wf-split">
        <div class="wf-col">${lbl('Template Weekday ', pin(1))}${tl(mod(TPL, { prov: true }), { pph: 13, every: 4 })}</div>
        <div class="wf-col"><div class="wf-card">${lbl('Pronto para começar')}<div class="wf-sub">9 blocos · 06:00–22:00 · nenhuma sobreposição</div>
          <div class="wf-row">${btn('Iniciar dia', { pri: true, ic: 'play', p: 2 })}${btn('Ajustar blocos antes', { ghost: true, p: 3 })}</div></div>
          <div class="wf-toast">${I('check')}Baseline salvo às 06:01</div></div>
      </div>`),
  };

  W.s2Active = {
    t: 'E2 · Dia ativo com Plano × Real', kind: 'desktop',
    notes: ['Comecei / Terminei: o registro ao vivo mais leve possível.', 'Troca rápida: algo fora do plano? Um toque na área.', 'Plano (tracejado) e Real (sólido) lado a lado.', 'O registro atual cresce até agora.'],
    r: () => win(`${hdr('Hoje', 'Segunda, 28 set · iniciado 06:01', seg(['Plano', 'Real', 'Plano × Real'], 2))}
      <div class="wf-split">
        <div class="wf-col"><div class="wf-card now">${lbl('Agora ', pin(1))}<div class="wf-big">${dot('blue')}Work<span class="wf-sub">plano 10:00–11:00</span></div>
            <div class="wf-live"><i></i>Registrando desde 10:05 · 32 min</div><div class="wf-row">${btn('Terminei', { pri: true, ic: 'stop' })}${btn('Pausar', { ghost: true })}</div></div>
          <div class="wf-card">${lbl('Fazendo outra coisa? ', pin(2))}<div class="wf-areas">${[['Music', 'purple'], ['Family', 'green'], ['Rest', 'green'], ['Commute', 'cyan'], ['Personal', 'pink'], ['Leisure', 'purple']].map(([n, c]) => `<span class="wf-chip">${dot(c)}${n}</span>`).join('')}</div></div>
          ${nextCard()}</div>
        <div class="wf-cmp">
          <div>${lbl('Plano ', pin(3))}${tl(mod(TPL.slice(0, 5), { prov: true }), { from: 6, to: 13, pph: 30, every: 1, left: 26 })}</div>
          <div>${lbl('Real')}${tl([{ a: 6.33, b: 8.83, n: 'Maker', c: 'orange' }, { a: 8.83, b: 10.08, n: 'Commute', c: 'cyan' }, { a: 10.08, b: 10.62, n: 'Work', c: 'blue', p: 4, html: '<div class="wb-edit">em andamento</div>' }], { from: 6, to: 13, pph: 30, every: 1, left: 26, now: 10.62 })}</div>
        </div>
      </div>`),
  };

  W.s2Close = {
    t: 'E2 · Fechar dia v1', kind: 'desktop',
    notes: ['Só dois passos nesta etapa: acertar o real e ver o resumo.', 'Lacunas com ações de 1 clique.', 'Nada rastreado? O plano vira o ponto de partida do real.', 'Resumo por área e check-in da etapa no final.'],
    r: () => win(`${stepper(1, CLOSE2)}${pin(1)}
      <div class="wf-close">
        <div class="wf-cmp">
          <div>${lbl('Plano')}${tl([{ a: 10, b: 11, n: 'Work', c: 'blue' }, { a: 11, b: 12, n: 'Music', c: 'purple' }, { a: 12, b: 14, n: 'Lunch + FlightSim', c: 'yellow' }, { a: 14, b: 17.5, n: 'Work', c: 'blue' }].map(b => Object.assign(b, { prov: true })), { from: 10, to: 17, pph: 24, every: 1, left: 26 })}</div>
          <div>${lbl('Real')}${tl([{ a: 10.08, b: 11.5, n: 'Work', c: 'blue' }, { a: 11.5, b: 12, n: 'Music', c: 'purple' }, { a: 12, b: 13.1, n: 'Sem registro', gap: true, p: 2 }, { a: 13.1, b: 14, n: 'FlightSim', c: 'yellow' }, { a: 14, b: 17, n: 'Work', c: 'blue' }], { from: 10, to: 17, pph: 24, every: 1, left: 26 })}</div>
        </div>
        <div class="wf-col">
          <div class="wf-card">${lbl('12:00–13:05 · sem registro')}<div class="wf-row wrap">${btn('Preencher: Lunch', { pri: true })}${btn('Estender anterior')}${btn('Ignorar', { ghost: true })}</div></div>
          <div class="wf-card">${btn('Aceitar plano como real', { ic: 'copy', p: 3 })}<div class="wf-sub">Depois é só ajustar as bordas.</div></div>
          <div class="wf-card">${lbl('Prévia do resumo ', pin(4))}<div class="wf-stack">${[['blue', 38], ['green', 22], ['orange', 17], ['cyan', 12], ['yellow', 7], ['purple', 4]].map(([c, w]) => `<i style="width:${w}%;background:var(--accent-${c})"></i>`).join('')}</div><div class="wf-sub">Registrado 14h12 de 15h00 planejadas</div></div>
          <div class="wf-row end">${btn('Fechar dia', { pri: true, ic: 'moon' })}</div>
        </div></div>`),
  };

  W.s3Conflict = {
    t: 'E3 · Mudar o plano com o dia em andamento', kind: 'desktop',
    notes: ['Um bloco Fixo novo (buscar o Leo) sobrepõe um Flexível.', 'Ações diretas; nenhuma é modal.', 'Motivo opcional em um toque.', 'Cada mudança vira uma revisão; o Baseline não muda.'],
    r: () => win(`<div class="wf-banner warn">${I('alert', 'sm')}<div><b>“Buscar Leo” (Fixo) sobrepõe Music</b><span>11:45–12:30 × 11:00–12:00</span></div>${pin(1)}<span class="sp"></span>${btn('Manter')}${btn('Mover Music', { p: 2 })}${btn('Encurtar')}${btn('Remover')}</div>
      <div class="wf-split r">
        ${tl([{ a: 10, b: 11, n: 'Work', c: 'blue', check: true }, { a: 11, b: 12, n: 'Music', c: 'purple', warn: true }, { a: 11.75, b: 12.5, n: 'Buscar Leo', c: 'cyan', lock: true, l: '56%' }, { a: 12.5, b: 14, n: 'Lunch + FlightSim', c: 'yellow' }, { a: 14, b: 17.5, n: 'Work', c: 'blue' }], { from: 10, to: 16, pph: 30, every: 1, now: 10.95 })}
        <div class="wf-col"><div class="wf-card">${lbl('Por que mudou? · opcional ', pin(3))}<div class="wf-areas">${['Família', 'Trabalho', 'Imprevisto', 'Energia', 'Outro'].map((x, i) => `<span class="wf-chip${i === 0 ? ' on' : ''}">${x}</span>`).join('')}</div></div>
          <div class="wf-toast">${I('history')}Revisão 2 criada · Baseline intacto${pin(4)}</div></div>
      </div>`),
  };

  W.s3Compare = {
    t: 'E3 · Comparar Baseline × Final × Real', kind: 'desktop',
    notes: ['Três colunas: o que eu queria, o que ajustei, o que aconteceu.', 'Marcas de diferença: movido, removido, novo.', 'Resumo das mudanças em linguagem neutra.'],
    r: () => win(`${hdr('Hoje', 'Segunda, 28 set', seg(['Plano', 'Real', 'Comparar'], 2))}
      <div class="wf-cmp3">
        <div>${lbl('Baseline ', pin(1))}${tl([{ a: 10, b: 11, n: 'Work', c: 'blue' }, { a: 11, b: 12, n: 'Music', c: 'purple' }, { a: 12, b: 14, n: 'Lunch + FlightSim', c: 'yellow' }, { a: 14, b: 17.5, n: 'Work', c: 'blue' }].map(b => Object.assign(b, { prov: true })), { from: 10, to: 18, pph: 24, every: 1, left: 26 })}</div>
        <div>${lbl('Final ', pin(2))}${tl([{ a: 10, b: 11, n: 'Work', c: 'blue' }, { a: 11, b: 12, n: 'Music', c: 'purple', ghost: true, html: '<span class="wb-badge">movido</span>' }, { a: 11.75, b: 12.5, n: 'Buscar Leo', c: 'cyan', lock: true, html: '<span class="wb-badge new">novo</span>' }, { a: 12.5, b: 13.5, n: 'Lunch', c: 'yellow' }, { a: 13.5, b: 14.5, n: 'Music', c: 'purple' }, { a: 14.5, b: 18, n: 'Work', c: 'blue' }], { from: 10, to: 18, pph: 24, every: 1, left: 26 })}</div>
        <div>${lbl('Real')}${tl([{ a: 10.08, b: 11.4, n: 'Work', c: 'blue' }, { a: 11.7, b: 12.6, n: 'Buscar Leo', c: 'cyan' }, { a: 12.6, b: 13.6, n: 'Lunch', c: 'yellow' }, { a: 13.7, b: 14.3, n: 'Music', c: 'purple' }, { a: 14.4, b: 18, n: 'Work', c: 'blue' }], { from: 10, to: 18, pph: 24, every: 1, left: 26 })}</div>
        <div class="wf-card">${lbl('O que mudou ', pin(3))}${[['history', '2 revisões', '10:52 e 11:03'], ['move', '1 bloco movido', 'Music 11:00 → 13:30'], ['x', '1 removido', 'FlightSim'], ['plus', '1 adicionado', 'Buscar Leo (Fixo)'], ['clock', 'Variação', 'plano × real: 1h05']].map(([ic, a, b]) => `<div class="wf-li">${I(ic, 'sm')}<div><b>${a}</b><span>${b}</span></div></div>`).join('')}</div>
      </div>`),
  };

  W.s4Today = {
    t: 'E4 · Hoje com tarefas nos blocos', kind: 'desktop',
    notes: ['O card Agora mostra as tarefas do bloco atual.', 'Cada bloco mostra carga × capacidade; estourar é só aviso.', 'Arrastar do painel para um bloco agenda a tarefa.', 'Tarefas começadas em dias anteriores aparecem primeiro.', '⌘K ou N captura para o Inbox de qualquer lugar.'],
    r: () => win(`${hdr('Hoje', 'Segunda, 28 set · iniciado 06:01', `<span class="wf-chip">${I('command')}⌘K Capturar</span>${pin(5)}`)}
      <div class="wf-active">
        <div class="wf-col"><div class="wf-card now">${lbl('Agora ', pin(1))}<div class="wf-big">${dot('blue')}Work<span class="wf-sub">10:00–11:00</span></div>
            <div class="wf-live"><i></i>Registrando desde 10:05</div>
            ${task('Relatório semanal', '45m', { c: 'blue', pri: 'h' })}${task('Revisar PR do sync', '20m', { c: 'blue', pri: 'm' })}
            <div class="wf-row">${btn('Terminei', { pri: true, ic: 'stop' })}</div></div>${nextCard()}</div>
        ${tl([{ a: 6, b: 9, n: 'Maker', c: 'orange', check: true, tasks: [['Fix Sortie sync', '1h30', true], ['Imprimir case', '30m', true]] }, { a: 9, b: 10, n: 'Drive / Leo', c: 'cyan', check: true }, { a: 10, b: 11, n: 'Work', c: 'blue', cap: '1h05 / 1h', over: true, p: 2 }, { a: 11, b: 12, n: 'Music', c: 'purple', tasks: [['Praticar “Numb”', '1h']] }, { a: 12, b: 14, n: 'Lunch + FlightSim', c: 'yellow' }, { a: 14, b: 17.5, n: 'Work', c: 'blue', cap: '1h30 / 3h30' }], { from: 6, to: 18, pph: 22, every: 2, now: 10.62 })}
        <div class="wf-card tasks">${lbl('Tarefas ', pin(3))}<div class="wf-grp">Continuar ${pin(4)}</div>${task('DCS Companion', '1h40 · 3 sessões', { c: 'orange', pri: 'm' })}
          <div class="wf-grp">High</div>${task('Enviar trimestral', 'prazo hoje', { c: 'blue', pri: 'h', drag: true })}
          <div class="wf-grp">Inbox · 3</div>${task('Comprar PETG', '', { c: 'cyan' })}${task('Ligar para a oficina', '', { c: 'cyan' })}</div>
      </div>`),
  };

  W.dayDiff = {
    t: 'O que mudou hoje · plano × real sem jogo dos 7 erros', kind: 'desktop',
    notes: ['Uma timeline só: o real por cima, o plano como contorno tracejado só onde ele difere.', 'Cada bloco ganha um selo com a diferença em minutos.', 'A lista explica o dia em frases curtas, da maior diferença para a menor.', 'Totais por área: planejado × real.'],
    r: () => win(`${hdr('O que mudou hoje', 'Segunda, 28 set · plano final × real', seg(['Plano final × Real', 'Baseline × Real'], 0))}
      <div class="wf-split r">
        <div>${pin(1)}${tl([
          { a: 13, b: 14, n: '', c: 'purple', prov: true, notime: true }, { a: 14, b: 17.5, n: '', c: 'blue', prov: true, notime: true },
          { a: 12, b: 13.08, n: 'Lunch', c: 'yellow', html: '<span class="wb-badge plus">+5m</span>' },
          { a: 13.13, b: 13.87, n: 'Music', c: 'purple', html: '<span class="wb-badge minus">−16m · começou 13:08</span>', p: 2 },
          { a: 14, b: 18.17, n: 'Work', c: 'blue', html: '<span class="wb-badge plus">+40m · até 18:10</span>' },
          { a: 18.17, b: 19.08, n: 'Drive', c: 'cyan', html: '<span class="wb-badge">no plano: 17:30</span>' },
        ], { from: 12, to: 19.5, pph: 30, every: 1 })}</div>
        <div class="wf-col">
          <div class="wf-card">${lbl('Em frases ', pin(3))}${[
            ['plus', 'plus', 'Work passou 40 min do plano', 'terminou 18:10 em vez de 17:30'],
            ['x', 'minus', 'FlightSim não aconteceu', '−1h · o almoço ocupou o espaço'],
            ['arrowR', 'minus', 'Drive e Family começaram 40 min depois', 'efeito do Work'],
            ['clock', 'minus', 'Music ficou 16 min mais curto', 'começou 13:08'],
            ['zap', 'plus', 'Fora do plano: Meeting 30 min', '11:30–12:00'],
          ].map(([ic, k, a, b]) => `<div class="wf-li diff-${k}">${I(ic, 'sm')}<div><b>${a}</b><span>${b}</span></div></div>`).join('')}</div>
          <div class="wf-card">${lbl('Por área ', pin(4))}${[['Work', 'blue', '6h30', '7h10'], ['Music', 'purple', '1h', '44m'], ['FlightSim', 'yellow', '1h', '0'], ['Family', 'green', '2h30', '2h15']].map(([n, c, p, r]) => `<div class="wf-q">${dot(c)}<b>${n}</b><span class="sp"></span><span class="wf-sub">plano ${p}</span><b>${r}</b></div>`).join('')}</div>
        </div>
      </div>`),
  };

  W.__setNav = list => { NAVSET = list || null; };
  return W;
}
