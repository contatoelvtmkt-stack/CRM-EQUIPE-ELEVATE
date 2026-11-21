import { api, todayBR, addDays } from './api.js';
import { AVATARS, avatarSVG, avatarName, runnerSVG, TURTLE_SVG } from './avatars.js';
import {
  I, ROLES, STAGES, STAGE, WD, SWATCH, state, isManager, isReviewer, person, clientName, $, esc, firstName, initials,
  dObj, fmtShort, fmtDay, weekStart, sortTasks, summary, saudacao, face, toast, openSheet, countUp, busy, emptyBox, hhmm, ago, isLate
} from './ui.js';
import { taskCard, kCard, taskSheet, newTaskSheet } from './tasks.js';
import { donut, weekBars } from './charts.js';

const view = () => $('#view');
const seta = '<img class="seta-up" src="assets/img/seta.svg" alt="">';

const topBar = (sub, title, right = '') => `
  <header class="top rise">
    <button class="av-frame" data-go="perfil" aria-label="Seu perfil">${face(state.me, 46)}</button>
    <div class="hello"><small>${sub}</small><h1>${title}</h1></div>
    ${right || `<span class="star-pill" title="Estrelas acumuladas">${I.star}${state.me.stars}</span>`}
  </header>`;

function weekStrip(selected, weekTasks, id) {
  const ws = weekStart(selected);
  return `<div class="week rise" id="${id}" style="--i:1">${[...Array(7)].map((_, i) => {
    const d = addDays(ws, i);
    const list = weekTasks.filter((t) => t.task_date === d);
    const cls = ['day', d === selected && 'sel', d === todayBR() && 'today',
      list.length && 'has', list.length && list.every((t) => t.status === 'finalizada') && 'done'].filter(Boolean).join(' ');
    return `<button class="${cls}" data-d="${d}"><span>${WD[dObj(d).getUTCDay()]}</span><b>${dObj(d).getUTCDate()}</b><i></i></button>`;
  }).join('')}</div>`;
}

function weekDays(selected, week) {
  const ws = weekStart(selected);
  return [...Array(7)].map((_, i) => {
    const d = addDays(ws, i);
    const l = week.filter((t) => t.task_date === d);
    return { label: WD[dObj(d).getUTCDay()].slice(0, 3), full: fmtDay(d), total: l.length, done: l.filter((t) => t.status === 'finalizada').length, cur: d === selected };
  });
}

const heroBar = (c) => {
  const pct = (n) => (c.total ? (n / c.total) * 100 : 0);
  return `<div class="bar"><span class="f" style="width:${pct(c.finalizada)}%"></span><span class="p" style="width:${pct(c.incompleta)}%"></span><span class="n" style="width:${pct(c.nao_realizada)}%"></span><span class="a" style="width:${pct(c.em_alteracao)}%"></span></div>
    <div class="legend">
      <span><i style="background:#181818"></i>Finalizadas ${c.finalizada}</span>
      <span><i style="background:#cc0000"></i>Incompletas ${c.incompleta}</span>
      <span><i style="background:var(--tex)"></i>Não realizadas ${c.nao_realizada}</span>
      <span><i style="background:repeating-linear-gradient(135deg,#181818 0 2px,transparent 2px 4px)"></i>Em alteração ${c.em_alteracao}</span>
    </div>`;
};

function bindCommon() {
  view().querySelectorAll('[data-go]').forEach((b) => (b.onclick = () => { state.tab = b.dataset.go; state.render(); }));
  countUp(view());
}

// =====================================================================
// HOJE
// =====================================================================
export async function viewHoje() {
  const ws = weekStart(state.date);
  const week = await api.tasks({ from: ws, to: addDays(ws, 6), userId: state.me.id });
  const list = week.filter((t) => t.task_date === state.date).sort(sortTasks);
  const c = summary(list);
  const bars = weekBars(weekDays(state.date, week));
  view().innerHTML = `${topBar(`${saudacao()},`, esc(firstName(state.me.name)))}
    <div class="page">
      <div class="dash">
        <div class="col-a">
          ${weekStrip(state.date, week, 'wk')}
          <section class="hero rise" style="--i:2;margin-top:14px">
            <div class="label"><b>${fmtDay(state.date)}</b><span>· suas demandas</span></div>
            <div class="big"><span data-count="${c.finalizada}">0</span><small>/${c.total} finalizadas</small></div>
            ${heroBar(c)}
            ${seta}
          </section>
          <section class="card chart-card rise" style="--i:3;margin-top:12px"><h3>Sua semana <small>finalizadas por dia</small></h3>${bars.html}</section>
        </div>
        <div class="col-b">
          <div class="section-title"><h2>Demandas</h2><span>${c.pendente + c.em_alteracao ? `${c.pendente + c.em_alteracao} para marcar` : c.total ? 'Tudo marcado' : ''}</span></div>
          <div class="list" id="list">${list.length ? list.map((t, i) => taskCard(t, { i })).join('') : emptyBox(state.date === todayBR() ? 'Nenhuma demanda para hoje.<br>Toque no <b class="red">+</b> para criar.' : 'Nenhuma demanda neste dia.')}</div>
        </div>
      </div>
    </div>`;
  bars.bind(view());
  bindCommon();
  $('#wk').onclick = (e) => { const b = e.target.closest('[data-d]'); if (b) { state.date = b.dataset.d; viewHoje(); } };
  $('#list').onclick = (e) => { const b = e.target.closest('[data-id]'); if (b) taskSheet(list.find((t) => t.id === b.dataset.id)); };
}

// =====================================================================
// PAINEL
// =====================================================================
export async function viewPainel() {
  const d = state.painelDate;
  const ws = weekStart(d);
  const teamView = isReviewer();
  const week = await api.tasks({ from: ws, to: addDays(ws, 6), userId: teamView ? undefined : state.me.id });
  const day = week.filter((t) => t.task_date === d);
  const c = summary(day);
  const done = c.total ? Math.round((c.finalizada / c.total) * 100) : 0;
  const dn = donut(c);
  const bars = weekBars(weekDays(d, week));
  const kpi = (label, n, sw, i) => `<div class="kpi card rise" style="--i:${i}"><small><i style="background:${sw}"></i>${label}</small><b data-count="${n}">0</b></div>`;

  let peopleHtml = '';
  if (teamView) {
    const rows = state.people.map((p) => ({ p, s: summary(day.filter((t) => t.assigned_to === p.id)) }))
      .sort((a, b) => b.s.total - a.s.total || a.p.name.localeCompare(b.p.name));
    peopleHtml = `<div class="section-title"><h2>Equipe</h2><span>${fmtDay(d)}</span></div>
      <div class="list" id="ppl">${rows.map(({ p, s }, i) => `
        <button class="person card rise" style="--i:${i}" data-p="${p.id}">
          ${face(p, 44)}
          <span class="info">
            <b><span>${esc(p.name)}</span><span class="stars">${I.star}${p.stars}</span></b>
            <small>${ROLES[p.role]} · ${s.total ? `${s.finalizada}/${s.total} finalizadas` : 'sem demandas'}${s.late ? ` · <span class="red">${s.late} atrasada${s.late > 1 ? 's' : ''}</span>` : ''}</small>
            <div class="bar"><span class="f" style="width:${s.total ? (s.finalizada / s.total) * 100 : 0}%"></span><span class="p" style="width:${s.total ? (s.incompleta / s.total) * 100 : 0}%"></span><span class="n" style="width:${s.total ? (s.nao_realizada / s.total) * 100 : 0}%"></span></div>
          </span>
        </button>`).join('')}</div>`;
  }

  view().innerHTML = `${topBar(teamView ? 'Acompanhamento diário' : 'Seu desempenho', 'Painel')}
    <div class="page">
      ${weekStrip(d, week, 'pwk')}
      <div class="dash" style="margin-top:14px">
        <div class="col-a">
          <section class="hero rise" style="--i:2">
            <div class="label"><b>${fmtDay(d)}</b><span>· ${teamView ? 'time todo' : 'você'}</span></div>
            <div class="big"><span data-count="${done}">0</span><small>% concluído</small></div>
            ${heroBar(c)}
            ${seta}
          </section>
          <section class="card chart-card rise" style="--i:3;margin-top:12px"><h3>Status do dia <small>${c.total} demandas</small></h3>${dn.html}</section>
          <section class="card chart-card rise" style="--i:4;margin-top:12px"><h3>Semana <small>${fmtShort(ws)} – ${fmtShort(addDays(ws, 6))}</small></h3>${bars.html}</section>
        </div>
        <div class="col-b">
          <div class="section-title"><h2>Números</h2><span class="${c.late ? 'red' : ''}">${c.late} atrasada${c.late === 1 ? '' : 's'}</span></div>
          <div class="kpis">
            ${kpi('Finalizadas', c.finalizada, SWATCH.finalizada, 0)}${kpi('Incompletas', c.incompleta, SWATCH.incompleta, 1)}
            ${kpi('Não realizadas', c.nao_realizada, SWATCH.nao_realizada, 2)}${kpi('Em alteração', c.em_alteracao, SWATCH.em_alteracao, 3)}
          </div>
          ${peopleHtml}
        </div>
      </div>
    </div>`;
  dn.bind(view()); bars.bind(view());
  bindCommon();
  $('#pwk').onclick = (e) => { const b = e.target.closest('[data-d]'); if (b) { state.painelDate = b.dataset.d; viewPainel(); } };
  const ppl = $('#ppl');
  if (ppl) ppl.onclick = (e) => {
    const b = e.target.closest('[data-p]'); if (!b) return;
    personDaySheet(person(b.dataset.p), day.filter((t) => t.assigned_to === b.dataset.p));
  };
}

function personDaySheet(p, list) {
  openSheet(`
    <div class="sheet-head"><div style="display:flex;gap:12px;align-items:center">${face(p, 44)}<div><h2>${esc(p.name)}</h2><small class="muted">${ROLES[p.role]} · ${fmtDay(state.painelDate)}</small></div></div>
      <button class="icon-btn" data-close aria-label="Fechar">${I.x}</button></div>
    <div class="list" id="pd">${list.length ? list.sort(sortTasks).map((t, i) => taskCard(t, { i })).join('') : emptyBox('Sem demandas neste dia.')}</div>
    ${isManager() ? `<div class="actions"><button class="btn btn-red" id="pd-new">${I.plus} Nova tarefa para ${esc(firstName(p.name))}</button></div>` : ''}`,
  (root, close) => {
    $('#pd', root).onclick = (e) => { const b = e.target.closest('[data-id]'); if (b) { close(); taskSheet(list.find((t) => t.id === b.dataset.id)); } };
    const nb = $('#pd-new', root);
    if (nb) nb.onclick = () => { close(); newTaskSheet({ assigned_to: p.id, task_date: state.painelDate }); };
  });
}

// =====================================================================
// FLUXO DE CONTEÚDO (admin, gestora, social media)
// =====================================================================
export async function viewFluxo() {
  const all = await api.pipeline();
  const cutoff = new Date(Date.now() - 30 * 86400e3).toISOString();
  const items = all.filter((t) => t.stage !== 'concluido' || t.stage_at >= cutoff);
  view().innerHTML = `${topBar('Do briefing à postagem', 'Fluxo de conteúdo', `<button class="icon-btn" id="fx-new" aria-label="Nova tarefa">${I.plus}</button>`)}
    <div class="page">
      <div class="grid-2 rise" style="--i:1;margin-top:10px;gap:8px;display:grid">
        <label class="search"><span class="sr">Pesquisar</span>${I.search}<input class="input" id="q" type="search" placeholder="Pesquisar tarefa, cliente ou pessoa" value="${esc(state.fluxoQuery)}"></label>
        <select class="input" id="fc" aria-label="Filtrar por cliente"><option value="">Todos os clientes</option>
          ${state.clients.map((c) => `<option value="${c.id}" ${state.fluxoClient === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
      </div>
      <p class="drag-hint rise" style="--i:2"><span class="d-only">Arraste os cards entre as etapas para atualizar.</span><span class="m-only">Segure um card e arraste até uma etapa acima para mover.</span></p>
      <div class="chips" id="chips"></div>
      <div class="kanban" id="kb"></div>
    </div>`;
  const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const draw = () => {
    const q = norm(state.fluxoQuery);
    const f = items.filter((t) => (!state.fluxoClient || t.client_id === state.fluxoClient) &&
      (!q || norm(`${t.title} ${clientName(t.client_id)} ${person(t.assigned_to).name} ${t.description}`).includes(q)));
    const by = Object.fromEntries(STAGES.map(([k]) => [k, f.filter((t) => t.stage === k).sort((a, b) => (a.stage_at < b.stage_at ? 1 : -1))]));
    $('#chips').innerHTML = STAGES.map(([k, l]) => `<button data-k="${k}" class="${state.fluxoStage === k ? 'on' : ''}">${l}<b>${by[k].length}</b></button>`).join('');
    $('#kb').innerHTML = STAGES.map(([k, l]) => `<section class="kcol ${state.fluxoStage === k ? 'on' : ''}" data-k="${k}">
      <div class="kcol-head"><span>${l}</span><b>${by[k].length}</b></div>
      ${by[k].length ? by[k].map((t, i) => kCard(t, i)).join('') : `<p class="muted" style="font-size:13px;padding:14px 4px">${q || state.fluxoClient ? 'Nada encontrado.' : 'Nada nesta etapa.'}</p>`}
    </section>`).join('');
  };
  draw();
  bindCommon();
  let tmr;
  $('#q').oninput = (e) => { clearTimeout(tmr); tmr = setTimeout(() => { state.fluxoQuery = e.target.value; draw(); }, 120); };
  $('#fc').onchange = (e) => { state.fluxoClient = e.target.value; draw(); };
  $('#chips').onclick = (e) => { const b = e.target.closest('[data-k]'); if (b) { state.fluxoStage = b.dataset.k; draw(); } };
  $('#kb').onclick = (e) => {
    if (dragJustEnded) return;
    const b = e.target.closest('[data-id]'); if (b) taskSheet(items.find((t) => t.id === b.dataset.id), () => viewFluxo());
  };
  $('#fx-new').onclick = () => newTaskSheet({}, () => viewFluxo());

  // ---- arrastar e soltar entre etapas ----
  const moveTo = async (t, target) => {
    if (!t || t.stage === target) return;
    if (target === 'a_fazer') return toast('"A fazer" é só para o que ainda não foi entregue. Use "Em alteração" para devolver.');
    if (target === 'em_alteracao') return askChange(t);
    const prev = { stage: t.stage, stage_at: t.stage_at };
    Object.assign(t, { stage: target, stage_at: new Date().toISOString() });
    draw();
    try { await api.review(t.id, 'mover', '', target); toast(`Movido para ${STAGE[target]}.`); }
    catch (er) { Object.assign(t, prev); draw(); toast(er.message); }
  };
  const askChange = (t) => openSheet(`
    <div class="sheet-head"><div><small class="muted">Mover para Em alteração</small><h2>${esc(t.title)}</h2></div><button class="icon-btn" data-close aria-label="Fechar">${I.x}</button></div>
    <div class="field"><label for="dn">O que precisa mudar? <span class="red">*</span></label><textarea class="input" id="dn" placeholder="Descreva o ajuste para ${esc(firstName(person(t.assigned_to).name))}"></textarea></div>
    <div class="err" id="dn-err"></div>
    <div class="actions"><button class="btn btn-red" id="dn-ok">Enviar pedido de alteração ${I.arrow}</button></div>`,
  (root, close) => {
    $('#dn', root).focus();
    $('#dn-ok', root).onclick = (e) => {
      const note = $('#dn', root).value.trim();
      if (!note) return ($('#dn-err', root).textContent = 'Descreva o ajuste.');
      busy(e.currentTarget, async () => {
        try { await api.review(t.id, 'alterar', note); close(); toast(`Voltou para ${firstName(person(t.assigned_to).name)} com o pedido de ajuste.`); viewFluxo(); }
        catch (er) { $('#dn-err', root).textContent = er.message; }
      });
    };
  });
  enableDrag($('.page', view()), (id, target) => moveTo(items.find((t) => t.id === id), target));
}

// Arrastar com mouse (move 6px) ou com o dedo (segurar 300ms). Solta numa coluna (desktop) ou num botão de etapa (celular).
let dragJustEnded = false;
let s = null; // arraste em andamento: { card, x, y, timer, ghost, dragging, over }
let dropCb = null;
const targetAt = (x, y) => document.elementFromPoint(x, y)?.closest('.kcol[data-k], .chips [data-k]');
const start = () => {
  const r = s.card.getBoundingClientRect();
  s.dragging = true; s.dx = s.x - r.left; s.dy = s.y - r.top;
  s.ghost = s.card.cloneNode(true);
  s.ghost.className += ' drag-ghost'; s.ghost.style.width = r.width + 'px';
  document.body.appendChild(s.ghost);
  s.card.classList.add('drag-src'); document.body.classList.add('is-dragging');
  if (navigator.vibrate) navigator.vibrate(12);
  place(s.x, s.y);
};
const place = (x, y) => {
  s.ghost.style.transform = `translate(${x - s.dx}px, ${y - s.dy}px) rotate(2.5deg)`;
  const t = targetAt(x, y);
  if (t !== s.over) { s.over?.classList.remove('drop-on'); t?.classList.add('drop-on'); s.over = t; }
  // rolagem automática perto das bordas
  const sc = document.elementFromPoint(x, y)?.closest('.kanban, .chips');
  if (sc) { const r = sc.getBoundingClientRect(); if (x < r.left + 50) sc.scrollLeft -= 14; else if (x > r.right - 50) sc.scrollLeft += 14; }
  if (y < 70) window.scrollBy(0, -12); else if (y > window.innerHeight - 110) window.scrollBy(0, 12);
};
const end = (drop) => {
  if (!s) return;
  clearTimeout(s.timer);
  if (s.dragging) {
    const k = s.over?.dataset.k; const id = s.card.dataset.id;
    s.ghost.remove(); s.card.classList.remove('drag-src'); s.over?.classList.remove('drop-on');
    document.body.classList.remove('is-dragging');
    dragJustEnded = true; setTimeout(() => (dragJustEnded = false), 60);
    if (drop && k && dropCb) dropCb(id, k);
  }
  s = null;
};

let dragGlobals = false;
function enableDrag(root, onDrop) {
  dropCb = onDrop;
  root.addEventListener('pointerdown', (e) => {
    const card = e.target.closest('.kcard'); if (!card || e.button > 0) return;
    s = { card, x: e.clientX, y: e.clientY, touch: e.pointerType !== 'mouse' };
    if (s.touch) s.timer = setTimeout(() => s && start(), 300);
  });
  root.addEventListener('touchmove', (e) => { if (s?.dragging) e.preventDefault(); }, { passive: false });
  root.addEventListener('contextmenu', (e) => { if (e.target.closest('.kcard')) e.preventDefault(); });
  if (dragGlobals) return;
  dragGlobals = true;
  window.addEventListener('pointermove', (e) => {
    if (!s) return;
    const moved = Math.hypot(e.clientX - s.x, e.clientY - s.y);
    if (!s.dragging) {
      if (s.touch) { if (moved > 10) end(false); return; } // o dedo rolou a tela: não é arrastar
      if (moved < 6) return;
      start();
    }
    e.preventDefault();
    place(e.clientX, e.clientY);
  }, { passive: false });
  window.addEventListener('pointerup', () => end(true));
  window.addEventListener('pointercancel', () => end(false));
}

// =====================================================================
// RANKING: corrida dos bichinhos
// =====================================================================
export async function viewRanking() {
  state.people = await api.profiles();
  const ppl = [...state.people].sort((a, b) => b.stars - a.stars || a.name.localeCompare(b.name));
  const max = Math.max(1, ...ppl.map((p) => p.stars));
  view().innerHTML = `${topBar('Dias perfeitos viram estrelas', 'Ranking')}
    <div class="page">
      <section class="hero rise" style="--i:1;margin-top:10px">
        <div class="label"><b>Como ganhar</b></div>
        <p style="margin-top:8px;line-height:1.5">Entregue <b>todas</b> as demandas do dia, dentro do prazo, e ganhe <b style="color:var(--red)">1 estrela</b>. Quem tem mais estrelas corre na frente.</p>
        ${seta}
      </section>
      <section class="card race rise" style="--i:2" aria-label="Corrida do ranking">
        ${ppl.map((p, i) => {
          const left = 14 + (p.stars / max) * 70;
          return `<div class="lane ${i === 0 ? 'first' : ''}">
            <span class="pos">${i + 1}º</span><span class="finish"></span>
            <div class="runner" style="left:${left}%">
              <span class="bubble">${p.photo_url ? `<img src="${esc(p.photo_url)}" alt="">` : `<span class="ph">${initials(p.name)}</span>`}<b>${esc(firstName(p.name))}</b><em>${I.star}${p.stars}</em>${i === 0 ? `<span class="crown">${I.crown}</span>` : ''}</span>
              <span style="position:relative">${runnerSVG(p.avatar, 58)}<i class="dust"></i><i class="dust d2"></i></span>
            </div>
          </div>`;
        }).join('')}
      </section>
      <div class="section-title"><h2>Classificação</h2></div>
      <div class="list">${ppl.map((p, i) => `
        <div class="person card rise" style="--i:${i}">
          <span class="rank ${i < 3 ? 'podium' : ''}">${i + 1}</span>
          ${face(p, 44)}
          <span class="info"><b><span>${esc(p.name)}${p.id === state.me.id ? ' <small class="muted">(você)</small>' : ''}</span><span class="stars">${I.star}${p.stars}</span></b><small>${ROLES[p.role]} · ${avatarName(p.avatar)}</small></span>
        </div>`).join('')}</div>
    </div>`;
  bindCommon();
}

// =====================================================================
// CHAT DA EQUIPE
// =====================================================================
let unsubChat = null;
export async function viewChat() {
  if (unsubChat) { unsubChat(); unsubChat = null; }
  view().innerHTML = `<div class="chat">
    <div class="chat-head">
      <div class="faces">${state.people.slice(0, 5).map((p) => face(p, 32)).join('')}</div>
      <div style="flex:1;line-height:1.2"><b style="font-size:18px">Chat da equipe</b><small class="muted" style="display:block">${state.people.length} pessoas</small></div>
    </div>
    <div class="msgs" id="msgs" aria-live="polite"></div>
    <form class="chat-form" id="cf">
      <label class="sr" for="cm">Mensagem</label>
      <textarea class="input" id="cm" rows="1" maxlength="2000" placeholder="Escreva para o time…" style="min-height:50px;height:50px;resize:none;padding-top:14px"></textarea>
      <button class="btn btn-red" aria-label="Enviar">${I.send}</button>
    </form>
  </div>`;
  const box = $('#msgs');
  let msgs = [];
  const draw = () => {
    let lastDay = '';
    box.innerHTML = msgs.length ? msgs.map((m) => {
      const p = person(m.user_id);
      const mine = m.user_id === state.me.id;
      const d = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(m.created_at));
      const sep = d !== lastDay ? `<span class="day-sep">${fmtDay(d)}</span>` : '';
      lastDay = d;
      return `${sep}<div class="msg ${mine ? 'mine' : ''}">
        ${mine ? '' : face(p, 32)}
        <div><div class="who-m">${mine ? '' : `<b>${esc(firstName(p.name))}</b>`}<span>${hhmm(m.created_at)}</span></div>
        <div class="bubble-m">${esc(m.body)}</div></div></div>`;
    }).join('') : emptyBox('Nenhuma mensagem ainda.<br>Dê um oi para o time!');
    box.scrollTop = box.scrollHeight;
  };
  const load = async () => { try { msgs = await api.messages(); draw(); } catch (e) { toast(e.message); } };
  await load();
  unsubChat = api.subscribeMessages(() => load());
  const poll = setInterval(() => { if (state.tab !== 'chat') { clearInterval(poll); if (unsubChat) { unsubChat(); unsubChat = null; } return; } load(); }, 15000);
  const ta = $('#cm');
  const send = async () => {
    const body = ta.value.trim(); if (!body) return;
    ta.value = '';
    try { await api.sendMessage(body); await load(); } catch (e) { toast(e.message); ta.value = body; }
  };
  $('#cf').onsubmit = (e) => { e.preventDefault(); send(); };
  ta.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };
}

// =====================================================================
// ENERGIA DO TIME (respostas ao Jeremias) — admin e gestora
// =====================================================================
export async function viewEnergia() {
  const since = new Date(Date.now() - 7 * 86400e3).toISOString();
  const all = await api.pulses(since);
  const today = todayBR();
  const dayOf = (ts) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(ts));
  const todays = all.filter((p) => dayOf(p.created_at) === today);
  const ok = todays.filter((p) => p.answer === 'ok').length;
  const slow = todays.length - ok;
  const energy = todays.length ? Math.round((ok / todays.length) * 100) : 0;
  const latest = new Map();
  todays.forEach((p) => latest.set(p.user_id, p));
  const team = state.people.filter((p) => !['admin', 'gestora'].includes(p.role));
  const days = [...Array(7)].map((_, i) => {
    const d = addDays(today, i - 6);
    const l = all.filter((p) => dayOf(p.created_at) === d);
    return { label: WD[dObj(d).getUTCDay()].slice(0, 3), full: fmtDay(d), total: l.length, done: l.filter((p) => p.answer === 'ok').length, cur: d === today };
  });
  const bars = weekBars(days);
  view().innerHTML = `${topBar('Respostas ao Jeremias', 'Energia do time')}
    <div class="page">
      <div class="dash" style="margin-top:10px">
        <div class="col-a">
          <section class="card glow chart-card rise" style="--i:1;padding:20px">
            <h3>Hoje <small>${todays.length} resposta${todays.length === 1 ? '' : 's'}</small></h3>
            <div style="display:flex;align-items:flex-end;gap:10px;margin-top:10px"><b style="font-size:52px;font-weight:500;line-height:1;letter-spacing:-2px"><span data-count="${energy}">0</span>%</b><span class="muted" style="padding-bottom:8px">de energia</span></div>
            <div class="meter"><span class="ok" style="width:${todays.length ? (ok / todays.length) * 100 : 0}%"></span><span class="slow" style="width:${todays.length ? (slow / todays.length) * 100 : 0}%"></span></div>
            <div class="legend" style="color:var(--muted)"><span><i style="background:var(--white)"></i>Tudo certo ${ok}</span><span><i style="background:var(--tex)"></i>Devagar hoje ${slow}</span></div>
          </section>
          <section class="card chart-card rise" style="--i:2;margin-top:12px"><h3>Últimos 7 dias <small>respostas "Tudo certo!"</small></h3>${bars.html}</section>
        </div>
        <div class="col-b">
          <div class="section-title"><h2>Como cada um está</h2><span>última resposta de hoje</span></div>
          <div class="list">${team.map((p, i) => {
            const r = latest.get(p.id);
            return `<div class="pulse-row card rise" style="--i:${i}">${face(p, 40)}
              <div style="min-width:0"><b style="font-weight:500">${esc(p.name)}</b><div class="time">${r ? `${hhmm(r.created_at)} · ${ago(r.created_at)}` : 'Ainda não respondeu hoje'}</div></div>
              <span class="ans">${r ? (r.answer === 'ok' ? `<span class="tag solid">${I.check} Tudo certo</span>` : `<span class="tag late">${TURTLE_SVG} Devagar</span>`) : '<span class="tag">—</span>'}</span>
            </div>`;
          }).join('') || emptyBox('Sem pessoas para acompanhar.')}</div>
        </div>
      </div>
    </div>`;
  bars.bind(view());
  bindCommon();
}

// =====================================================================
// EQUIPE + CLIENTES (admin e gestora)
// =====================================================================
export async function viewEquipe(tab = 'pessoas') {
  const [all, clients] = await Promise.all([api.allProfiles(), api.clients()]);
  state.people = all.filter((p) => p.role !== 'pendente' && p.active !== false);
  state.clients = clients;
  const pend = all.filter((p) => p.role === 'pendente');
  view().innerHTML = `${topBar(`${state.people.length} pessoas ativas · ${clients.filter((c) => c.active).length} clientes`, 'Equipe', `<button class="icon-btn" id="add" aria-label="Adicionar">${I.plus}</button>`)}
    <div class="page">
      <div class="tabs rise" id="eq-tabs"><button data-t="pessoas">Pessoas</button><button data-t="clientes">Clientes</button></div>
      <div id="eq-body"></div>
    </div>`;
  const body = $('#eq-body');
  const memberRow = (p, i) => `
    <button class="person card rise" style="--i:${i};${p.active === false ? 'opacity:.45' : ''}" data-m="${p.id}">
      ${face(p, 44)}
      <span class="info"><b><span>${esc(p.name || p.email)}</span><span class="stars">${I.star}${p.stars}</span></b>
      <small>${ROLES[p.role] || p.role}${p.active === false ? ' · desativado' : ''}${p.email ? ` · ${esc(p.email)}` : ''}</small></span>
    </button>`;
  const show = (t) => {
    tab = t;
    $('#eq-tabs').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.t === t));
    if (t === 'pessoas') {
      body.innerHTML = `${pend.length ? `<div class="section-title"><h2>Aguardando cargo</h2><span>${pend.length}</span></div><div class="list">${pend.map(memberRow).join('')}</div>` : ''}
        <div class="section-title"><h2>Pessoas</h2></div>
        <div class="list grid-2">${all.filter((p) => p.role !== 'pendente').map(memberRow).join('')}</div>
        <div class="actions" style="margin-top:16px;display:grid"><button class="btn btn-red" id="add2">${I.plus} Adicionar pessoa</button></div>`;
    } else {
      body.innerHTML = `<div class="section-title"><h2>Clientes</h2><span>aparecem na criação de tarefas</span></div>
        <form id="cl-form" style="display:grid;grid-template-columns:1fr auto;gap:8px;margin-bottom:12px">
          <input class="input" name="name" placeholder="Nome do novo cliente" required maxlength="80">
          <button class="btn btn-red" style="width:auto">${I.plus} Adicionar</button>
        </form>
        <div class="list grid-2">${clients.map((c, i) => `<div class="person card rise" style="--i:${i};${c.active ? '' : 'opacity:.45'}">
          <label class="client-logo" title="Enviar logo">${c.logo_url ? `<img src="${esc(c.logo_url)}" alt="">` : I.building}<span>${I.camera}</span>
            <input type="file" accept="image/*" class="sr" data-logo="${c.id}"></label>
          <span class="info"><b>${esc(c.name)}</b><small>${c.instagram ? `@${esc(c.instagram)}` : 'sem Instagram'} · ${c.active ? 'ativo' : 'arquivado'}</small></span>
          <button class="btn btn-ghost btn-sm" data-ig="${c.id}" aria-label="Instagram de ${esc(c.name)}">${I.insta}</button>
          <button class="btn btn-ghost btn-sm" data-c="${c.id}">${c.active ? 'Arquivar' : 'Reativar'}</button></div>`).join('') || emptyBox('Nenhum cliente ainda.')}</div>`;
      body.querySelectorAll('[data-logo]').forEach((inp) => (inp.onchange = async (e) => {
        const file = e.target.files[0]; if (!file) return;
        toast('Enviando logo…');
        try { await api.uploadClientLogo(inp.dataset.logo, file); toast('Logo atualizada!'); viewEquipe('clientes'); } catch (er) { toast(er.message); }
      }));
      $('#cl-form').onsubmit = async (e) => {
        e.preventDefault();
        const name = e.target.name.value.trim(); if (!name) return;
        try { await api.createClient(name); toast(`${name} adicionado.`); viewEquipe('clientes'); } catch (er) { toast(er.message); }
      };
    }
    const a2 = $('#add2'); if (a2) a2.onclick = () => memberSheet();
  };
  $('#eq-tabs').onclick = (e) => { const b = e.target.closest('button'); if (b) show(b.dataset.t); };
  $('#add').onclick = () => (tab === 'clientes' ? $('#cl-form input')?.focus() : memberSheet());
  body.onclick = async (e) => {
    const m = e.target.closest('[data-m]'); if (m) return memberSheet(all.find((p) => p.id === m.dataset.m));
    const ig = e.target.closest('[data-ig]');
    if (ig) {
      const cl = clients.find((x) => x.id === ig.dataset.ig);
      const v = prompt(`@ do Instagram de ${cl.name}:`, cl.instagram ? '@' + cl.instagram : '@');
      if (v === null) return;
      const handle = v.trim().replace(/^@+/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/[/?].*$/, '');
      try { await api.updateClient(cl.id, { instagram: handle || null }); toast(handle ? `@${handle} salvo.` : 'Instagram removido.'); viewEquipe('clientes'); } catch (er) { toast(er.message); }
      return;
    }
    const c = e.target.closest('[data-c]');
    if (c) { const cl = clients.find((x) => x.id === c.dataset.c); await api.updateClient(cl.id, { active: !cl.active }); viewEquipe('clientes'); }
  };
  show(tab);
  bindCommon();
}

function memberSheet(p) {
  const editing = !!(p && p.id);
  const roleOpts = Object.entries(ROLES).filter(([k]) => k !== 'pendente')
    .map(([k, v]) => `<option value="${k}" ${p && p.role === k ? 'selected' : ''}>${v}</option>`).join('');
  openSheet(`
    <div class="sheet-head"><h2>${editing ? 'Editar pessoa' : 'Nova pessoa'}</h2><button class="icon-btn" data-close aria-label="Fechar">${I.x}</button></div>
    <form id="mf">
      <div class="field"><label for="mf-n">Nome</label><input class="input" id="mf-n" name="name" required value="${esc(p?.name || '')}"></div>
      ${editing ? `<p class="muted" style="margin:-4px 0 14px;font-size:13px">${esc(p.email || '')}</p>` : `
      <div class="field"><label for="mf-e">E-mail de acesso</label><input class="input" id="mf-e" name="email" type="email" required autocomplete="off"></div>
      <div class="field"><label for="mf-s">Senha inicial</label><input class="input" id="mf-s" name="password" type="text" minlength="6" required autocomplete="off" placeholder="mínimo 6 caracteres"></div>`}
      <div class="field"><label for="mf-r">Cargo</label><select class="input" id="mf-r" name="role" required>${p?.role === 'pendente' || !p ? '<option value="" disabled selected>Escolha…</option>' : ''}${roleOpts}</select></div>
      <div class="err" id="mf-err"></div>
      <div class="actions">
        <button class="btn btn-red" type="submit">${editing ? 'Salvar' : 'Cadastrar'} ${I.arrow}</button>
        ${editing && p.id !== state.me.id ? `<button class="btn btn-ghost" type="button" id="mf-toggle">${p.active === false ? 'Reativar acesso' : 'Desativar acesso'}</button>` : ''}
      </div>
    </form>`,
  (root, close) => {
    $('#mf', root).onsubmit = (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      busy(e.submitter || e.target.querySelector('[type=submit]'), async () => {
        try {
          if (editing) await api.setMember(p.id, f.name.trim(), f.role);
          else await api.createMember({ name: f.name.trim(), email: f.email.trim(), password: f.password, role: f.role });
          close(); toast(editing ? 'Pessoa atualizada.' : `${firstName(f.name)} cadastrado(a).`); viewEquipe();
        } catch (er) { $('#mf-err', root).textContent = er.message; }
      });
    };
    const tg = $('#mf-toggle', root);
    if (tg) tg.onclick = async () => {
      try { await api.updateProfile(p.id, { active: p.active === false }); close(); toast('Acesso atualizado.'); viewEquipe(); }
      catch (er) { $('#mf-err', root).textContent = er.message; }
    };
  });
}

// =====================================================================
// PERFIL
// =====================================================================
export async function viewPerfil() {
  const since = addDays(todayBR(), -29);
  const month = await api.tasks({ from: since, to: todayBR(), userId: state.me.id });
  const s = summary(month);
  const me = state.me;
  view().innerHTML = `
    <div class="page" style="max-width:760px;margin:0 auto">
      <div class="profile-head rise">
        <label class="av-wrap" style="cursor:pointer" title="Trocar foto">
          <span class="av-frame">${face(me, 104)}</span>
          <span class="cam">${I.camera}</span>
          <input type="file" accept="image/*" id="ph-in" class="sr">
        </label>
        <h1>${esc(me.name)}</h1><small>${ROLES[me.role]}</small>
      </div>
      <div class="stats3 card rise" style="--i:1">
        <div><b>${I.star}<span data-count="${me.stars}">0</span></b><small>Estrelas</small></div>
        <div><b data-count="${s.finalizada}">0</b><small>Entregues 30d</small></div>
        <div><b class="${s.late ? 'red' : ''}" data-count="${s.late}">0</b><small>Atrasos 30d</small></div>
      </div>
      <div class="section-title"><h2>Foto de perfil</h2><span>da galeria ou da câmera</span></div>
      <div class="photo-row card rise" style="--i:2">
        ${me.photo_url ? `<img src="${esc(me.photo_url)}" alt="Sua foto">` : `<span class="ph">${I.camera}</span>`}
        <div class="acts">
          <label class="btn btn-white btn-sm" style="width:100%;cursor:pointer">${I.image} ${me.photo_url ? 'Trocar foto' : 'Escolher foto'}<input type="file" accept="image/*" id="ph-in2" class="sr"></label>
          ${me.photo_url ? `<button class="btn btn-ghost btn-sm" id="ph-del" style="width:100%">Usar só o bichinho</button>` : ''}
        </div>
      </div>
      <div class="section-title"><h2>Seu bichinho</h2><span>${avatarName(me.avatar)} · corre no ranking</span></div>
      <div class="av-grid" id="avg">${AVATARS.map((k, i) => `<button class="rise ${k === me.avatar ? 'on' : ''}" style="--i:${i}" data-a="${k}">${avatarSVG(k, 64)}${avatarName(k)}</button>`).join('')}</div>
      <div class="section-title"><h2>Seu nome</h2></div>
      <form id="nf" style="display:grid;grid-template-columns:1fr auto;gap:8px">
        <input class="input" name="name" value="${esc(me.name)}" required aria-label="Seu nome">
        <button class="btn btn-white" style="width:auto">Salvar</button>
      </form>
      <div class="menu-list" style="margin-top:26px">
        <button class="card" id="how">${I.info}<span>Ver como funciona</span>${I.arrow}</button>
        <button class="card" id="out">${I.out}<span>Sair</span></button>
      </div>
    </div>`;
  const upload = async (e) => {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    toast('Enviando foto…');
    try { state.me = await api.uploadPhoto(file); syncMe(); toast('Foto atualizada!'); viewPerfil(); } catch (er) { toast(er.message); }
  };
  $('#ph-in').onchange = upload; $('#ph-in2').onchange = upload;
  const del = $('#ph-del'); if (del) del.onclick = async () => { state.me = await api.removePhoto(); syncMe(); viewPerfil(); };
  $('#avg').onclick = async (e) => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    state.me = await api.updateProfile(state.me.id, { avatar: b.dataset.a });
    syncMe(); toast(`Agora você é ${avatarName(state.me.avatar).toLowerCase()}!`); viewPerfil();
  };
  $('#nf').onsubmit = async (e) => {
    e.preventDefault();
    state.me = await api.updateProfile(state.me.id, { name: e.target.name.value.trim() });
    syncMe(); toast('Nome atualizado.'); viewPerfil();
  };
  $('#how').onclick = () => window.dispatchEvent(new Event('elvt:onboarding'));
  $('#out').onclick = () => api.signOut();
  countUp(view());
}
function syncMe() {
  const i = state.people.findIndex((p) => p.id === state.me.id);
  if (i >= 0) state.people[i] = { ...state.people[i], ...state.me };
  const side = document.querySelector('.side .me');
  if (side) side.querySelector('.av-slot').innerHTML = face(state.me, 36);
}

// =====================================================================
// MAIS (menu do celular)
// =====================================================================
export function viewMais(items) {
  view().innerHTML = `${topBar('Tudo do CRM', 'Menu')}
    <div class="page"><div class="menu-list" style="margin-top:12px">
      ${items.map(([k, l, ic], i) => `<button class="card rise" style="--i:${i}" data-go="${k}">${ic}<span>${l}</span>${I.arrow}</button>`).join('')}
      <button class="card rise" id="how2">${I.info}<span>Ver como funciona</span>${I.arrow}</button>
      <button class="card rise" id="out2">${I.out}<span>Sair</span></button>
    </div></div>`;
  bindCommon();
  $('#how2').onclick = () => window.dispatchEvent(new Event('elvt:onboarding'));
  $('#out2').onclick = () => api.signOut();
}
