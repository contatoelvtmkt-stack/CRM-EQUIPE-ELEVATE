// Clientes (editar/remover), Saldos de anúncios, Financeiro e Metas
import { api, todayBR, addDays } from './api.js';
import { I, state, isManager, $, esc, toast, openSheet, busy, emptyBox, ago, countUp } from './ui.js';

const view = () => $('#view');
const isAdmin = () => state.me?.role === 'admin';
export const isAdsTeam = () => ['admin', 'trafego'].includes(state.me?.role);

// ---------------------------------------------------------------------
// Logos das redes (marcas originais)
// ---------------------------------------------------------------------
export const LOGO = {
  instagram: `<svg viewBox="0 0 24 24" width="100%" height="100%" aria-label="Instagram"><defs><radialGradient id="igg" cx="30%" cy="107%" r="150%"><stop offset="0" stop-color="#fdf497"/><stop offset=".05" stop-color="#fdf497"/><stop offset=".45" stop-color="#fd5949"/><stop offset=".6" stop-color="#d6249f"/><stop offset=".9" stop-color="#285AEB"/></radialGradient></defs><rect width="24" height="24" rx="6" fill="url(#igg)"/><rect x="5.5" y="5.5" width="13" height="13" rx="4" fill="none" stroke="#fff" stroke-width="1.8"/><circle cx="12" cy="12" r="3.1" fill="none" stroke="#fff" stroke-width="1.8"/><circle cx="16.3" cy="7.7" r="1" fill="#fff"/></svg>`,
  facebook: `<svg viewBox="0 0 24 24" width="100%" height="100%" aria-label="Facebook"><circle cx="12" cy="12" r="12" fill="#1877F2"/><path d="M13.4 19.5v-6.2h2.1l.3-2.5h-2.4V9.3c0-.7.2-1.2 1.2-1.2h1.3V5.9c-.2 0-1-.1-1.9-.1-1.9 0-3.2 1.2-3.2 3.3v1.8H8.7v2.5h2.1v6.2z" fill="#fff"/></svg>`,
  meta: `<svg viewBox="0 0 36 24" width="100%" height="100%" aria-label="Meta Ads"><path d="M4.6 15.9c0 1.4.3 2.4.7 3 .5.8 1.3 1.2 2.2 1.2 1.1 0 2.2-.3 4.1-3 1.5-2.1 3.3-5.1 4.5-7l2.1-3.2c1.5-2.2 3.2-4.7 5.2-4.7 1.6 0 3.2.9 4.4 2.7 1.3 2 2 4.6 2 7.2 0 1.6-.3 2.7-.9 3.7-.6 1-1.7 2-3.6 2v-3c1.6 0 2-1.5 2-3.2 0-2.4-.6-5.1-1.8-7-.9-1.4-2-2.2-3.2-2.2-1.3 0-2.4 1-3.6 2.8-.6.9-1.3 2.1-2 3.4l-.8 1.4c-1.6 2.8-2 3.5-2.8 4.6-1.4 1.9-2.6 2.6-4.2 2.6-1.9 0-3.1-.8-3.8-2-.6-1-.9-2.3-.9-3.8z" fill="#0081FB"/><path d="M4 8.1C5.3 6.1 7.2 4.7 9.4 4.7c1.3 0 2.5.4 3.9 1.5 1.5 1.2 3.1 3.2 5.1 6.5l.7 1.2c1.7 2.8 2.7 4.3 3.3 5 .7.9 1.2 1.2 1.9 1.2 1.7 0 2.1-1.6 2.1-3.3l2.6-.1c0 1.7-.3 3-.9 4-.6 1-1.7 2-3.6 2-1.2 0-2.2-.3-3.4-1.3-.9-.8-1.9-2.2-2.7-3.5l-2.3-3.9c-1.2-2-2.3-3.4-2.9-4.1-.7-.7-1.6-1.6-3-1.6-1.2 0-2.2.8-3 2.1z" fill="#0064E1"/></svg>`
};
const netBadges = (c) => `<span class="nets">
  <span class="${c.ig_user_id ? 'on' : ''}" title="Instagram ${c.ig_user_id ? '@' + esc(c.ig_username || '') : 'não vinculado'}">${LOGO.instagram}</span>
  <span class="${c.fb_page_id ? 'on' : ''}" title="Facebook ${c.fb_page_id ? esc(c.fb_page_name || '') : 'não vinculado'}">${LOGO.facebook}</span>
  <span class="wide ${c.ad_account_id ? 'on' : ''}" title="Anúncios ${c.ad_account_id ? esc(c.ad_account_name || '') : 'não vinculado'}">${LOGO.meta}</span></span>`;

const nfBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const brl = (v) => (v === null || v === undefined || Number.isNaN(Number(v)) ? '—' : nfBRL.format(Number(v)));
const MS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const fmtD = (iso) => { if (!iso) return '—'; const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`; };
const monthStart = (iso) => iso.slice(0, 7) + '-01';
const monthEnd = (iso) => { const [y, m] = iso.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
const shiftMonth = (iso, k) => { const [y, m] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1 + k, 1)).toISOString().slice(0, 10); };
const monthLabel = (iso) => { const [y, m] = iso.split('-').map(Number); return `${MONTHS[m - 1]} de ${y}`; };

// ---------------------------------------------------------------------
// Linha do cliente na aba Clientes + janela de edição
// ---------------------------------------------------------------------
export const clientRow = (c, i, plan) => `
  <div class="person card rise" style="--i:${i};${c.active ? '' : 'opacity:.45'}">
    <span class="client-logo" style="width:48px;height:48px">${c.logo_url ? `<img src="${esc(c.logo_url)}" alt="">` : I.building}</span>
    <span class="info"><b>${esc(c.name)}</b>
      <small>${netBadges(c)}${c.active ? '' : ' · arquivado'}${isAdmin() && plan ? ` · ${plan.plan_type === 'avulso' ? 'Avulso' : brl(plan.plan_value) + '/mês'}` : ''}</small></span>
    <button class="icon-btn" data-edit="${c.id}" aria-label="Editar ${esc(c.name)}" title="Editar cliente">${I.pencil}</button>
  </div>`;

export async function clientSheet(c, onDone, openLinks) {
  const plan = isAdmin() ? (await api.plans().catch(() => [])).find((p) => p.client_id === c.id) : null;
  const p = plan || { plan_type: 'recorrente', plan_name: '', plan_value: 0, billing_day: 10, start_date: todayBR() };
  let ptype = p.plan_type;
  openSheet(`
    <div class="sheet-head"><div><small class="muted">Cliente</small><h2>${esc(c.name)}</h2></div><button class="icon-btn" data-close aria-label="Fechar">${I.x}</button></div>
    <form id="cf2">
      <div class="photo-row card" style="margin-bottom:14px">
        ${c.logo_url ? `<img src="${esc(c.logo_url)}" alt="">` : `<span class="ph">${I.building}</span>`}
        <div class="acts"><label class="btn btn-white btn-sm" style="width:100%;cursor:pointer">${I.image} ${c.logo_url ? 'Trocar foto / logo' : 'Adicionar foto / logo'}<input type="file" accept="image/*" id="cl-logo" class="sr"></label></div>
      </div>
      <div class="field"><label for="cl-name">Nome</label><input class="input" id="cl-name" required maxlength="80" value="${esc(c.name)}"></div>
      <div class="field"><label for="cl-notes">Observações</label><textarea class="input" id="cl-notes" rows="3" maxlength="2000" placeholder="Contatos, preferências, combinados…">${esc(c.notes || '')}</textarea></div>
      ${isAdmin() ? `
      <fieldset class="pub-form"><legend>${I.cash} Plano <small>(só o administrador vê)</small></legend>
        <div class="field"><label>Tipo de cliente</label><div class="seg" id="cl-type"><button type="button" data-v="recorrente" class="${ptype === 'recorrente' ? 'on' : ''}">Recorrente</button><button type="button" data-v="avulso" class="${ptype === 'avulso' ? 'on' : ''}">Avulso</button></div></div>
        <div id="cl-rec" class="${ptype === 'avulso' ? 'hidden' : ''}">
          <div class="field"><label for="cl-pn">Nome do plano</label><input class="input" id="cl-pn" maxlength="80" value="${esc(p.plan_name || '')}" placeholder="Ex.: Plano Social + Tráfego"></div>
          <div class="row2">
            <div class="field"><label for="cl-pv">Valor mensal (R$)</label><input class="input" id="cl-pv" inputmode="decimal" value="${p.plan_value ? String(p.plan_value).replace('.', ',') : ''}" placeholder="0,00"></div>
            <div class="field"><label for="cl-bd">Dia do vencimento</label><input class="input" id="cl-bd" type="number" min="1" max="31" value="${p.billing_day || 10}"></div>
          </div>
          <div class="field" style="margin-bottom:0"><label for="cl-sd">Cliente desde</label><input class="input" type="date" id="cl-sd" value="${p.start_date || todayBR()}"></div>
        </div>
        <p class="muted ${ptype === 'avulso' ? '' : 'hidden'}" id="cl-av" style="font-size:13px;line-height:1.5">Clientes avulsos não têm mensalidade. Os serviços entram no Financeiro como receita avulsa.</p>
      </fieldset>` : ''}
      <div class="err" id="cl-err"></div>
      <div class="actions" style="margin-top:4px"><button class="btn btn-red" type="submit">Salvar ${I.arrow}</button></div>
    </form>
    <div class="section-title" style="margin-top:22px"><h2>Contas conectadas</h2></div>
    <div class="list">
      <div class="person card"><span class="net-lg">${LOGO.instagram}</span><span class="info"><b>Instagram</b><small>${c.ig_user_id ? '@' + esc(c.ig_username || '') + ' · publicação e relatórios' : 'não vinculado'}</small></span></div>
      <div class="person card"><span class="net-lg">${LOGO.facebook}</span><span class="info"><b>Facebook</b><small>${c.fb_page_id ? esc(c.fb_page_name || c.fb_page_id) + ' · relatórios' : 'não vinculado'}</small></span></div>
      <div class="person card"><span class="net-lg wide">${LOGO.meta}</span><span class="info"><b>Anúncios (Meta Ads)</b><small>${c.ad_account_id ? esc(c.ad_account_name || c.ad_account_id) + ' · tráfego pago e saldo' : 'não vinculado'}</small></span></div>
    </div>
    ${isManager() ? `<div class="actions"><button class="btn btn-white" id="cl-links">${I.link} Conectar ou trocar contas</button></div>` : ''}
    ${isManager() ? `<div class="actions">
      <button class="btn btn-ghost" id="cl-arch">${c.active ? 'Arquivar cliente' : 'Reativar cliente'}</button>
      <button class="btn btn-ghost" id="cl-del" style="color:var(--red-hi)">Remover cliente</button>
    </div>` : ''}`,
  (root, close) => {
    const done = () => { close(); onDone && onDone(); };
    const seg = $('#cl-type', root);
    if (seg) seg.onclick = (e) => {
      const b = e.target.closest('[data-v]'); if (!b) return;
      ptype = b.dataset.v; seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      $('#cl-rec', root).classList.toggle('hidden', ptype === 'avulso'); $('#cl-av', root).classList.toggle('hidden', ptype !== 'avulso');
    };
    $('#cl-logo', root).onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      toast('Enviando foto…');
      try { await api.uploadClientLogo(c.id, f); toast('Foto atualizada!'); done(); } catch (er) { toast(er.message); }
    };
    $('#cf2', root).onsubmit = (e) => {
      e.preventDefault();
      const name = $('#cl-name', root).value.trim();
      if (!name) return ($('#cl-err', root).textContent = 'Informe o nome.');
      busy(e.submitter || e.target.querySelector('[type=submit]'), async () => {
        try {
          await api.updateClient(c.id, { name, notes: $('#cl-notes', root).value.trim() });
          if (isAdmin()) {
            const val = Number(($('#cl-pv', root)?.value || '0').replace(/\./g, '').replace(',', '.')) || 0;
            await api.savePlan(c.id, {
              plan_type: ptype, plan_name: ptype === 'avulso' ? '' : $('#cl-pn', root).value.trim(), plan_value: ptype === 'avulso' ? 0 : val,
              billing_day: Math.min(31, Math.max(1, Number($('#cl-bd', root).value) || 10)), start_date: $('#cl-sd', root)?.value || todayBR()
            });
          }
          toast('Cliente atualizado.'); done();
        } catch (er) { $('#cl-err', root).textContent = er.message; }
      });
    };
    const lk = $('#cl-links', root); if (lk) lk.onclick = () => { close(); openLinks(c); };
    const ar = $('#cl-arch', root);
    if (ar) ar.onclick = async () => { try { await api.updateClient(c.id, { active: !c.active }); toast(c.active ? 'Cliente arquivado.' : 'Cliente reativado.'); done(); } catch (er) { toast(er.message); } };
    const del = $('#cl-del', root);
    if (del) del.onclick = async () => {
      if (!confirm(`Remover ${c.name}? Ele sai das listas, mas tarefas, relatórios e financeiro antigos continuam registrados.`)) return;
      try { await api.removeClient(c.id); toast(`${c.name} removido.`); done(); } catch (er) { toast(er.message); }
    };
  });
}

// ---------------------------------------------------------------------
// SALDOS DE ANÚNCIOS (admin e gestor de tráfego)
// ---------------------------------------------------------------------
export async function loadLowBalances() {
  if (!isAdsTeam()) { state.lowBalances = []; return []; }
  try {
    const [bal, clients] = await Promise.all([api.adBalances(), api.clients()]);
    const live = new Set(clients.filter((c) => c.active && c.ad_account_id).map((c) => c.id));
    state.lowBalances = bal.filter((b) => b.low && live.has(b.client_id));
  } catch { state.lowBalances = []; }
  return state.lowBalances;
}

export function lowBalancePopup(goTo) {
  const low = state.lowBalances || [];
  if (!low.length || !isAdsTeam()) return;
  const key = `elvt-saldo-${todayBR()}-${low.map((b) => b.client_id).sort().join(',')}`;
  try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1'); } catch { /* */ }
  const names = Object.fromEntries((state.clients || []).map((c) => [c.id, c.name]));
  const el = document.createElement('div');
  el.className = 'jer-wrap';
  el.innerHTML = `<div class="jer card glow" role="alertdialog" aria-labelledby="sb-t" style="text-align:left">
    <div class="pub-h"><b id="sb-t">${I.alert} Saldo baixo nas contas de anúncios</b></div>
    <ul class="rlist2 sb">${low.map((b) => `<li><span>${esc(names[b.client_id] || b.account_name)}</span><b class="red">${brl(b.available)}</b></li>`).join('')}</ul>
    <div class="two" style="margin-top:16px"><button class="btn btn-ghost" data-x>Depois</button><button class="btn btn-red" data-go>Ver saldos</button></div></div>`;
  document.body.appendChild(el);
  el.onclick = (e) => {
    if (e.target.closest('[data-go]')) { el.remove(); goTo('saldos'); }
    else if (e.target.closest('[data-x]') || e.target === el) el.remove();
  };
}

export async function viewSaldos() {
  const [bal, clients] = await Promise.all([api.adBalances().catch(() => []), api.clients()]);
  state.clients = clients;
  const withAds = clients.filter((c) => c.ad_account_id && c.active);
  const by = Object.fromEntries(bal.map((b) => [b.client_id, b]));
  const rows = withAds.map((c) => ({ c, b: by[c.id] })).sort((a, b) => (b.b?.low ? 1 : 0) - (a.b?.low ? 1 : 0) || (a.b?.available ?? 1e12) - (b.b?.available ?? 1e12));
  const low = rows.filter((r) => r.b?.low);
  state.lowBalances = low.map((r) => r.b);
  const last = bal.reduce((a, b) => (b.checked_at > a ? b.checked_at : a), '');
  view().innerHTML = `
    <header class="top rise"><div class="hello"><small>Contas de anúncios dos clientes</small><h1>Saldos</h1></div>
      <button class="btn btn-white btn-sm" id="sb-ref">${I.refresh} Atualizar agora</button></header>
    <div class="page">
      <section class="hero rise" style="--i:1;margin-top:10px">
        <div class="label"><b>${low.length ? `${low.length} conta${low.length > 1 ? 's' : ''} com saldo baixo` : 'Tudo certo com os saldos'}</b></div>
        <p style="margin-top:8px;line-height:1.5">${withAds.length} conta${withAds.length === 1 ? '' : 's'} acompanhada${withAds.length === 1 ? '' : 's'} · atualização automática de hora em hora${last ? ` · última ${ago(last)}` : ''}.</p>
        <img class="seta-up" src="assets/img/seta.svg" alt="">
      </section>
      <div class="section-title"><h2>Contas</h2><span>alerta abaixo do valor de cada cliente</span></div>
      <div class="list grid-2" id="sb-list">${rows.length ? rows.map(({ c, b }, i) => `
        <button class="bal card rise ${b?.low ? 'low' : ''}" style="--i:${i}" data-c="${c.id}">
          <span class="bal-top"><span class="client-logo" style="width:40px;height:40px">${c.logo_url ? `<img src="${esc(c.logo_url)}" alt="">` : I.building}</span>
            <span class="info"><b>${esc(c.name)}</b><small>${esc(b?.account_name || c.ad_account_name || c.ad_account_id)}</small></span>
            <span class="tag ${b?.kind === 'prepago' ? 'solid' : ''}">${b?.kind === 'prepago' ? 'Pré-pago' : b?.kind === 'cartao' ? 'Cartão' : '—'}</span></span>
          <span class="bal-v">${b?.error ? '<span class="red" style="font-size:14px">Erro ao ler a conta</span>' : b ? (b.available === null ? '<span class="muted" style="font-size:15px">Sem saldo (cartão sem limite)</span>' : brl(b.available)) : '<span class="muted" style="font-size:15px">Ainda não verificado</span>'}</span>
          <span class="bal-f"><span>${b?.low ? `${I.alert} Saldo baixo` : `Alerta abaixo de ${brl(c.ad_alert_threshold ?? 30)}`}</span><span>${b ? ago(b.checked_at) : ''}</span></span>
        </button>`).join('') : emptyBox('Nenhum cliente com conta de anúncios vinculada.<br>Vincule em Equipe e clientes → lápis do cliente → Conectar contas.')}</div>
    </div>`;
  $('#sb-ref').onclick = (e) => busy(e.currentTarget, async () => {
    try { const r = await api.refreshBalances(); toast(`${r.atualizados} conta(s) atualizada(s).`); viewSaldos(); state.render.badges?.(); } catch (er) { toast(er.message); }
  });
  $('#sb-list').onclick = (e) => { const b = e.target.closest('[data-c]'); if (b) balanceSheet(clients.find((c) => c.id === b.dataset.c), by[b.dataset.c]); };
}

async function balanceSheet(c, b) {
  const hist = await api.adHistory(c.id).catch(() => []);
  openSheet(`
    <div class="sheet-head"><div><small class="muted">Saldo de anúncios</small><h2>${esc(c.name)}</h2></div><button class="icon-btn" data-close aria-label="Fechar">${I.x}</button></div>
    <div class="pub card glow">
      <div class="pub-h"><b>${esc(b?.account_name || c.ad_account_name || '')}</b><span class="muted">${b?.kind === 'prepago' ? 'Pré-pago' : b?.kind === 'cartao' ? 'Cartão' : ''}</span></div>
      <p style="font-size:34px;font-weight:500;margin-top:8px;letter-spacing:-1px" class="${b?.low ? 'red' : ''}">${b ? (b.available === null ? '—' : brl(b.available)) : '—'}</p>
      ${b?.kind === 'cartao' && b?.spend_cap ? `<p class="muted" style="font-size:13px">Limite de gasto ${brl(b.spend_cap)} · gasto ${brl(b.amount_spent)}</p>` : ''}
      ${b?.kind === 'cartao' && !b?.spend_cap ? `<p class="muted" style="font-size:13px;line-height:1.5">Conta no cartão sem limite de gasto: a Meta não informa saldo. Para receber alerta, defina um limite de gasto da conta no Gerenciador de Anúncios.</p>` : ''}
      ${b?.error ? `<p class="just" style="margin-top:8px">${esc(b.error)}</p>` : ''}
    </div>
    <form id="th" class="field" style="margin-top:4px"><label for="th-v">Avisar quando o saldo ficar abaixo de (R$)</label>
      <div style="display:grid;grid-template-columns:1fr auto;gap:8px"><input class="input" id="th-v" inputmode="decimal" value="${String(c.ad_alert_threshold ?? 30).replace('.', ',')}"><button class="btn btn-white" style="width:auto">Salvar</button></div></form>
    <div class="section-title"><h2>Atualizações</h2><span>últimas ${hist.length}</span></div>
    <ul class="hist">${hist.length ? hist.map((h) => `<li class="${h.low ? 'low' : ''}"><span>${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(h.checked_at))}</span><b>${h.available === null ? '—' : brl(h.available)}</b></li>`).join('') : '<li><span class="muted">Sem histórico ainda.</span></li>'}</ul>`,
  (root, close) => {
    $('#th', root).onsubmit = async (e) => {
      e.preventDefault();
      const v = Number($('#th-v', root).value.replace(/\./g, '').replace(',', '.'));
      if (!(v >= 0)) return toast('Valor inválido.');
      try { await api.setThreshold(c.id, v); close(); toast(`Alerta ajustado para ${brl(v)}.`); viewSaldos(); } catch (er) { toast(er.message); }
    };
  });
}

// ---------------------------------------------------------------------
// METAS — todos veem o progresso no Painel; o administrador define no Financeiro
// ---------------------------------------------------------------------
const PERIOD = { mes: 'Mês', trimestre: 'Trimestre', semestre: 'Semestre', ano: 'Ano' };
export async function goalsCard() {
  let goals = [];
  try { goals = await api.goalsProgress(); } catch { return ''; }
  const t = todayBR();
  goals = goals.filter((g) => g.end_date >= t);
  if (!goals.length) return '';
  return `<div class="section-title"><h2>Metas da Elevate</h2><span>progresso da empresa</span></div>
    <div class="list goals">${goals.map((g, i) => {
      const cur = Number(g.current) || 0; const tgt = Number(g.target) || 1;
      const pc = Math.min(100, Math.round((cur / tgt) * 100));
      const total = (Date.parse(g.end_date) - Date.parse(g.start_date)) / 864e5 + 1;
      const elapsed = Math.min(total, Math.max(0, (Date.parse(t) - Date.parse(g.start_date)) / 864e5 + 1));
      const tp = Math.round((elapsed / total) * 100);
      const ahead = pc >= tp;
      // valores em reais só para o administrador; a equipe vê a porcentagem e o ritmo
      const money = g.metric === 'faturamento';
      const fmt = (v) => (money ? brl(v) : `${Math.round(v)} cliente${Math.round(v) === 1 ? '' : 's'}`);
      const showVals = !money || isAdmin();
      return `<div class="goal card rise" style="--i:${i}">
        <div class="goal-h"><b>${esc(g.title || (g.metric === 'faturamento' ? 'Faturamento' : 'Clientes'))}</b><span class="tag">${PERIOD[g.period]}</span></div>
        <div class="goal-n"><b data-count="${pc}">0</b><span>%</span><small>${showVals ? `${fmt(cur)} de ${fmt(tgt)}` : 'da meta atingida'}</small></div>
        <div class="goal-bar"><i style="width:${pc}%"></i><em style="left:${tp}%" title="Tempo decorrido do período"></em></div>
        <p class="goal-s ${pc >= 100 ? 'done' : ahead ? 'ok' : 'late'}">${pc >= 100 ? `${I.check} Meta batida!` : ahead ? `No ritmo: ${tp}% do período já passou.` : `Abaixo do ritmo: ${tp}% do período já passou. Faltam ${showVals ? fmt(Math.max(0, tgt - cur)) : `${100 - pc}% da meta`}.`}</p>
      </div>`;
    }).join('')}</div>`;
}

function goalSheet(g, onDone) {
  const t = todayBR();
  const x = g || { title: '', metric: 'faturamento', period: 'mes', target: '' };
  let metric = x.metric, period = x.period;
  const rangeFor = (per, ref) => {
    const [y, m] = ref.split('-').map(Number);
    if (per === 'mes') return [monthStart(ref), monthEnd(ref)];
    if (per === 'trimestre') { const q = Math.floor((m - 1) / 3) * 3 + 1; const s = `${y}-${String(q).padStart(2, '0')}-01`; return [s, monthEnd(shiftMonth(s, 2))]; }
    if (per === 'semestre') { const s = m <= 6 ? `${y}-01-01` : `${y}-07-01`; return [s, monthEnd(shiftMonth(s, 5))]; }
    return [`${y}-01-01`, `${y}-12-31`];
  };
  openSheet(`
    <div class="sheet-head"><h2>${g ? 'Editar meta' : 'Nova meta'}</h2><button class="icon-btn" data-close aria-label="Fechar">${I.x}</button></div>
    <form id="gf">
      <div class="field"><label>O que medir</label><div class="seg" id="g-m"><button type="button" data-v="faturamento" class="${metric === 'faturamento' ? 'on' : ''}">Faturamento</button><button type="button" data-v="clientes" class="${metric === 'clientes' ? 'on' : ''}">Clientes recorrentes</button></div></div>
      <div class="field"><label>Período</label><div class="seg" id="g-p">${Object.entries(PERIOD).map(([k, v]) => `<button type="button" data-v="${k}" class="${period === k ? 'on' : ''}">${v}</button>`).join('')}</div></div>
      <div class="field"><label for="g-ref">Período de referência (qualquer dia dentro dele)</label><input class="input" type="date" id="g-ref" value="${x.start_date || t}"></div>
      <p class="muted" id="g-rng" style="font-size:13px;margin:-6px 0 12px"></p>
      <div class="field"><label for="g-t" id="g-tl">Meta</label><input class="input" id="g-t" inputmode="decimal" required value="${x.target ? String(x.target).replace('.', ',') : ''}"></div>
      <div class="field"><label for="g-n">Nome (opcional)</label><input class="input" id="g-n" maxlength="80" value="${esc(x.title || '')}" placeholder="Ex.: Faturamento de dezembro"></div>
      <div class="err" id="g-err"></div>
      <div class="actions"><button class="btn btn-red" type="submit">Salvar meta ${I.arrow}</button>${g ? '<button class="btn btn-ghost" type="button" id="g-del" style="color:var(--red-hi)">Excluir meta</button>' : ''}</div>
    </form>`,
  (root, close) => {
    const upd = () => {
      const [s, e] = rangeFor(period, $('#g-ref', root).value || t);
      $('#g-rng', root).textContent = `De ${fmtD(s)} a ${fmtD(e)}`;
      $('#g-tl', root).textContent = metric === 'faturamento' ? 'Meta de faturamento recebido (R$)' : 'Meta de clientes recorrentes ativos';
      return [s, e];
    };
    upd();
    const seg = (id, set) => { const el = $(id, root); el.onclick = (e) => { const b = e.target.closest('[data-v]'); if (!b) return; set(b.dataset.v); el.querySelectorAll('button').forEach((y) => y.classList.toggle('on', y === b)); upd(); }; };
    seg('#g-m', (v) => (metric = v)); seg('#g-p', (v) => (period = v));
    $('#g-ref', root).onchange = upd;
    $('#gf', root).onsubmit = async (e) => {
      e.preventDefault();
      const target = Number($('#g-t', root).value.replace(/\./g, '').replace(',', '.'));
      if (!(target > 0)) return ($('#g-err', root).textContent = 'Informe a meta.');
      const [start_date, end_date] = upd();
      try { await api.saveGoal({ ...(g?.id ? { id: g.id } : {}), title: $('#g-n', root).value.trim(), metric, period, start_date, end_date, target }); close(); toast('Meta salva.'); onDone(); }
      catch (er) { $('#g-err', root).textContent = er.message; }
    };
    const del = $('#g-del', root);
    if (del) del.onclick = async () => { if (!confirm('Excluir esta meta?')) return; await api.deleteGoal(g.id); close(); toast('Meta excluída.'); onDone(); };
  });
}

// ---------------------------------------------------------------------
// FINANCEIRO (só administrador)
// ---------------------------------------------------------------------
const CATS = { receita: ['Serviço avulso', 'Plano recorrente', 'Produção de conteúdo', 'Tráfego pago', 'Consultoria', 'Outros'], custo: ['Equipe / freelancers', 'Software', 'Anúncios da Elevate', 'Impostos', 'Estrutura', 'Equipamentos', 'Outros'] };

export async function viewFinanceiro(tab = state.finTab || 'geral') {
  if (!isAdmin()) { view().innerHTML = emptyBox('Somente o administrador acessa o financeiro.'); return; }
  state.finTab = tab;
  await api.financeSync().catch(() => {});
  view().innerHTML = `
    <header class="top rise"><div class="hello"><small>Controle da Elevate · só administrador</small><h1>Financeiro</h1></div>
      <button class="icon-btn" id="fin-add" aria-label="Novo lançamento">${I.plus}</button></header>
    <div class="page">
      <div class="tabs rise" id="fin-tabs">${[['geral', 'Visão geral'], ['clientes', 'Clientes'], ['lanc', 'Lançamentos'], ['metas', 'Metas']].map(([k, l]) => `<button data-t="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div id="fin-body"></div>
    </div>`;
  $('#fin-tabs').onclick = (e) => { const b = e.target.closest('[data-t]'); if (b) viewFinanceiro(b.dataset.t); };
  $('#fin-add').onclick = () => entrySheet(null, () => viewFinanceiro(state.finTab));
  const body = $('#fin-body');
  if (tab === 'geral') await finGeral(body);
  else if (tab === 'clientes') await finClientes(body);
  else if (tab === 'lanc') await finLanc(body);
  else await finMetas(body);
  countUp(view());
}

async function finGeral(body) {
  const month = state.finMonth || monthStart(todayBR());
  state.finMonth = month;
  const from6 = shiftMonth(month, -5);
  const [all, plans, clients] = await Promise.all([api.entries(from6, monthEnd(month)), api.plans(), api.clients()]);
  state.clients = clients;
  const live = new Set(clients.filter((c) => c.active).map((c) => c.id));
  const mrr = plans.filter((p) => p.plan_type === 'recorrente' && live.has(p.client_id) && (!p.end_date || p.end_date >= todayBR())).reduce((a, p) => a + Number(p.plan_value), 0);
  const mEnd = monthEnd(month);
  const inM = (d) => d && d >= month && d <= mEnd;
  const act = all.filter((e) => e.status !== 'cancelado');
  const received = act.filter((e) => e.kind === 'receita' && e.status === 'pago' && inM(e.paid_at)).reduce((a, e) => a + Number(e.amount), 0);
  const toReceive = act.filter((e) => e.kind === 'receita' && e.status === 'pendente' && inM(e.due_date));
  const costs = act.filter((e) => e.kind === 'custo' && (inM(e.paid_at) || (e.status === 'pendente' && inM(e.due_date))));
  const costPaid = costs.filter((e) => e.status === 'pago').reduce((a, e) => a + Number(e.amount), 0);
  const costTotal = costs.reduce((a, e) => a + Number(e.amount), 0);
  const overdue = act.filter((e) => e.kind === 'receita' && e.status === 'pendente' && e.due_date < todayBR());
  const series = [...Array(6)].map((_, k) => {
    const m = shiftMonth(month, k - 5); const me = monthEnd(m);
    const r = act.filter((e) => e.kind === 'receita' && e.status === 'pago' && e.paid_at >= m && e.paid_at <= me).reduce((a, e) => a + Number(e.amount), 0);
    const c = act.filter((e) => e.kind === 'custo' && e.status === 'pago' && e.paid_at >= m && e.paid_at <= me).reduce((a, e) => a + Number(e.amount), 0);
    return { m, r, c };
  });
  const max = Math.max(1, ...series.flatMap((s) => [s.r, s.c]));
  const names = Object.fromEntries(clients.map((c) => [c.id, c.name]));
  body.innerHTML = `
    <div class="month-nav rise"><button class="icon-btn" data-mm="-1" aria-label="Mês anterior">${I.back}</button><b>${monthLabel(month)}</b><button class="icon-btn" data-mm="1" aria-label="Próximo mês">${I.arrow}</button></div>
    <div class="kpis k5 fin-k">
      <div class="kpi card rise accent-k"><small>Faturamento recorrente</small><b>${brl(mrr)}</b><span class="k-sub">por mês, com os planos ativos</span></div>
      <div class="kpi card rise" style="--i:1"><small>Recebido no mês</small><b>${brl(received)}</b></div>
      <div class="kpi card rise" style="--i:2"><small>A receber no mês</small><b>${brl(toReceive.reduce((a, e) => a + Number(e.amount), 0))}</b><span class="k-sub">${toReceive.length} cobrança${toReceive.length === 1 ? '' : 's'}</span></div>
      <div class="kpi card rise" style="--i:3"><small>Custos do mês</small><b>${brl(costTotal)}</b><span class="k-sub">${brl(costPaid)} pagos</span></div>
      <div class="kpi card rise" style="--i:4"><small>Resultado (recebido − custos pagos)</small><b class="${received - costPaid < 0 ? 'red' : ''}">${brl(received - costPaid)}</b></div>
    </div>
    <div class="dash" style="margin-top:12px">
      <div class="col-a">
        <section class="card chart-card rise"><h3>Últimos 6 meses <small>recebido x custos pagos</small></h3>
          <div class="fbars">${series.map((s) => `<div class="fb-col ${s.m === month ? 'cur' : ''}" title="${monthLabel(s.m)}: recebido ${brl(s.r)} · custos ${brl(s.c)}">
            <span class="fb-pair"><i class="r" style="height:${(s.r / max) * 100}%"></i><i class="c" style="height:${(s.c / max) * 100}%"></i></span><em>${MS[Number(s.m.slice(5, 7)) - 1]}</em></div>`).join('')}</div>
          <div class="legend" style="margin-top:10px;color:var(--muted)"><span><i style="background:var(--white)"></i>Recebido</span><span><i style="background:var(--red)"></i>Custos pagos</span></div>
        </section>
      </div>
      <div class="col-b">
        <div class="section-title" style="margin-top:0"><h2>A receber</h2><span>${overdue.length ? `<span class="red">${overdue.length} em atraso</span>` : 'em dia'}</span></div>
        <div class="list" id="fin-rec">${[...overdue.filter((e) => !inM(e.due_date)), ...toReceive].slice(0, 12).map((e) => entryRow(e, names)).join('') || emptyBox('Nada a receber neste mês.')}</div>
      </div>
    </div>`;
  body.querySelectorAll('[data-mm]').forEach((b) => (b.onclick = () => { state.finMonth = shiftMonth(month, Number(b.dataset.mm)); viewFinanceiro('geral'); }));
  bindEntryList(body, all, () => viewFinanceiro('geral'));
}

function entryRow(e, names) {
  const late = e.status === 'pendente' && e.due_date < todayBR();
  return `<div class="fe card ${e.kind}" data-e="${e.id}">
    <span class="fe-i">${e.kind === 'receita' ? '+' : '−'}</span>
    <span class="info"><b>${esc(e.description || e.category)}</b><small>${esc(e.category)}${e.client_id && names[e.client_id] && !e.description?.includes(names[e.client_id]) ? ' · ' + esc(names[e.client_id]) : ''} · ${e.status === 'pago' ? 'pago em ' + fmtD(e.paid_at) : (late ? '<span class="red">venceu ' + fmtD(e.due_date) + '</span>' : 'vence ' + fmtD(e.due_date))}${e.status === 'cancelado' ? ' · cancelado' : ''}</small></span>
    <span class="fe-v ${e.kind === 'custo' ? 'red' : ''}">${e.kind === 'custo' ? '−' : ''}${brl(e.amount)}</span>
    ${e.status === 'pendente' ? `<button class="btn btn-white btn-sm" data-pay="${e.id}">Pago</button>` : `<span class="tag ${e.status === 'pago' ? 'solid' : ''}">${e.status === 'pago' ? 'Pago' : 'Cancelado'}</span>`}
  </div>`;
}
function bindEntryList(root, list, refresh) {
  root.onclick = async (ev) => {
    const pay = ev.target.closest('[data-pay]');
    if (pay) { ev.stopPropagation(); await api.updateEntry(pay.dataset.pay, { status: 'pago', paid_at: todayBR() }); toast('Marcado como pago.'); return refresh(); }
    const row = ev.target.closest('[data-e]');
    if (row) entrySheet(list.find((x) => x.id === row.dataset.e), refresh);
  };
}

async function finClientes(body) {
  const [plans, clients] = await Promise.all([api.plans(), api.clients()]);
  state.clients = clients;
  const by = Object.fromEntries(plans.map((p) => [p.client_id, p]));
  const rec = clients.filter((c) => c.active && by[c.id]?.plan_type === 'recorrente');
  const av = clients.filter((c) => c.active && by[c.id]?.plan_type === 'avulso');
  const none = clients.filter((c) => c.active && !by[c.id]);
  const mrr = rec.reduce((a, c) => a + Number(by[c.id].plan_value), 0);
  const row = (c) => { const p = by[c.id]; return `<button class="person card" data-cl="${c.id}"><span class="client-logo" style="width:40px;height:40px">${c.logo_url ? `<img src="${esc(c.logo_url)}" alt="">` : I.building}</span>
    <span class="info"><b>${esc(c.name)}</b><small>${p ? (p.plan_type === 'avulso' ? 'Cliente avulso' : `${esc(p.plan_name || 'Plano')} · vence dia ${p.billing_day} · desde ${fmtD(p.start_date)}`) : 'Plano não definido'}</small></span>
    <b class="fe-v">${p?.plan_type === 'recorrente' ? brl(p.plan_value) : ''}</b></button>`; };
  body.innerHTML = `
    <section class="hero rise" style="margin-top:14px"><div class="label"><b>Faturamento recorrente mensal</b></div>
      <div class="big">${brl(mrr)}</div><p style="margin-top:6px">${rec.length} cliente${rec.length === 1 ? '' : 's'} recorrente${rec.length === 1 ? '' : 's'} · ticket médio ${brl(rec.length ? mrr / rec.length : 0)}</p>
      <img class="seta-up" src="assets/img/seta.svg" alt=""></section>
    <div class="section-title"><h2>Recorrentes</h2><span>${rec.length}</span></div><div class="list grid-2">${rec.map(row).join('') || emptyBox('Nenhum cliente recorrente.')}</div>
    <div class="section-title"><h2>Avulsos</h2><span>${av.length}</span></div><div class="list grid-2">${av.map(row).join('') || emptyBox('Nenhum cliente avulso.')}</div>
    ${none.length ? `<div class="section-title"><h2>Sem plano definido</h2><span>${none.length}</span></div><div class="list grid-2">${none.map(row).join('')}</div>` : ''}
    <div class="actions" style="margin-top:16px;display:grid"><button class="btn btn-ghost" id="fin-av">${I.plus} Lançar serviço avulso</button></div>`;
  body.onclick = (e) => { const b = e.target.closest('[data-cl]'); if (b) clientSheet(clients.find((c) => c.id === b.dataset.cl), () => viewFinanceiro('clientes'), () => {}); };
  $('#fin-av').onclick = () => entrySheet({ kind: 'receita', source: 'avulso', category: 'Serviço avulso' }, () => viewFinanceiro('clientes'));
}

async function finLanc(body) {
  const r = state.finRange || [monthStart(todayBR()), monthEnd(todayBR())];
  const filter = state.finFilter || 'todos';
  const [list, clients] = await Promise.all([api.entries(r[0], r[1]), api.clients()]);
  const names = Object.fromEntries(clients.map((c) => [c.id, c.name]));
  const shown = list.filter((e) => filter === 'todos' || e.kind === filter).sort((a, b) => (b.paid_at || b.due_date).localeCompare(a.paid_at || a.due_date));
  const tot = summarize(list, r);
  body.innerHTML = `
    <section class="card rep-gen rise" style="margin-top:14px">
      <div class="rep-quick" id="fq">${[['Este mês', [monthStart(todayBR()), monthEnd(todayBR())]], ['Mês passado', [shiftMonth(todayBR(), -1), monthEnd(shiftMonth(todayBR(), -1))]], ['Este ano', [todayBR().slice(0, 4) + '-01-01', todayBR().slice(0, 4) + '-12-31']]].map(([l, v]) => `<button type="button" data-r="${v.join('|')}" class="${v.join('|') === r.join('|') ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="row2"><div class="field"><label for="f-s">De</label><input class="input" type="date" id="f-s" value="${r[0]}"></div><div class="field"><label for="f-u">Até</label><input class="input" type="date" id="f-u" value="${r[1]}"></div></div>
      <div class="seg" id="f-k">${[['todos', 'Tudo'], ['receita', 'Receitas'], ['custo', 'Custos']].map(([k, l]) => `<button type="button" data-v="${k}" class="${filter === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    </section>
    <div class="kpis k4 fin-k" style="margin-top:12px">
      <div class="kpi card"><small>Receitas recebidas</small><b>${brl(tot.rec)}</b></div>
      <div class="kpi card"><small>Custos pagos</small><b>${brl(tot.cost)}</b></div>
      <div class="kpi card"><small>Resultado</small><b class="${tot.rec - tot.cost < 0 ? 'red' : ''}">${brl(tot.rec - tot.cost)}</b></div>
      <div class="kpi card"><small>A receber no período</small><b>${brl(tot.pend)}</b></div>
    </div>
    <div class="section-title"><h2>Lançamentos</h2><span>${shown.length}</span></div>
    <div class="actions" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:0 0 12px">
      <button class="btn btn-ghost btn-sm" id="f-rec" style="width:100%">${I.plus} Receita avulsa</button>
      <button class="btn btn-ghost btn-sm" id="f-cost" style="width:100%">${I.plus} Custo</button>
      <button class="btn btn-red btn-sm" id="f-pdf" style="width:100%">${I.file} Relatório PDF</button>
    </div>
    <div class="list" id="f-list">${shown.map((e) => entryRow(e, names)).join('') || emptyBox('Nenhum lançamento no período.')}</div>`;
  $('#fq').onclick = (e) => { const b = e.target.closest('[data-r]'); if (b) { state.finRange = b.dataset.r.split('|'); viewFinanceiro('lanc'); } };
  ['#f-s', '#f-u'].forEach((id) => ($(id).onchange = () => { const s = $('#f-s').value, u = $('#f-u').value; if (s && u && s <= u) { state.finRange = [s, u]; viewFinanceiro('lanc'); } }));
  $('#f-k').onclick = (e) => { const b = e.target.closest('[data-v]'); if (b) { state.finFilter = b.dataset.v; viewFinanceiro('lanc'); } };
  $('#f-rec').onclick = () => entrySheet({ kind: 'receita', source: 'avulso', category: 'Serviço avulso' }, () => viewFinanceiro('lanc'));
  $('#f-cost').onclick = () => entrySheet({ kind: 'custo', category: 'Outros' }, () => viewFinanceiro('lanc'));
  $('#f-pdf').onclick = () => financePdf(r, list, names);
  bindEntryList($('#f-list'), list, () => viewFinanceiro('lanc'));
}
function summarize(list, r) {
  const act = list.filter((e) => e.status !== 'cancelado');
  const inR = (d) => d && d >= r[0] && d <= r[1];
  return {
    rec: act.filter((e) => e.kind === 'receita' && e.status === 'pago' && inR(e.paid_at)).reduce((a, e) => a + Number(e.amount), 0),
    cost: act.filter((e) => e.kind === 'custo' && e.status === 'pago' && inR(e.paid_at)).reduce((a, e) => a + Number(e.amount), 0),
    pend: act.filter((e) => e.kind === 'receita' && e.status === 'pendente' && inR(e.due_date)).reduce((a, e) => a + Number(e.amount), 0),
    costPend: act.filter((e) => e.kind === 'custo' && e.status === 'pendente' && inR(e.due_date)).reduce((a, e) => a + Number(e.amount), 0)
  };
}

async function finMetas(body) {
  const goals = await api.goalsProgress().catch(() => []);
  const card = await goalsCard();
  const old = goals.filter((g) => g.end_date < todayBR());
  body.innerHTML = `
    <p class="muted rise" style="font-size:13px;line-height:1.5;margin:14px 0 4px">As metas aparecem no Painel de toda a equipe, só com o progresso. Faturamento conta as receitas marcadas como pagas no período; clientes conta os recorrentes ativos.</p>
    ${card || emptyBox('Nenhuma meta ativa.')}
    ${old.length ? `<div class="section-title"><h2>Encerradas recentemente</h2></div><div class="list">${old.map((g) => `<button class="person card" data-g="${g.id}"><span class="info"><b>${esc(g.title || g.metric)}</b><small>${PERIOD[g.period]} · ${fmtD(g.start_date)} a ${fmtD(g.end_date)}</small></span><b>${Math.round((Number(g.current) / Number(g.target)) * 100)}%</b></button>`).join('')}</div>` : ''}
    <div class="actions" style="margin-top:16px;display:grid"><button class="btn btn-red" id="g-new">${I.plus} Nova meta</button></div>`;
  $('#g-new').onclick = () => goalSheet(null, () => viewFinanceiro('metas'));
  body.querySelectorAll('.goal').forEach((el, i) => { el.style.cursor = 'pointer'; el.onclick = () => goalSheet(goals.filter((g) => g.end_date >= todayBR())[i], () => viewFinanceiro('metas')); });
  body.querySelectorAll('[data-g]').forEach((b) => (b.onclick = () => goalSheet(goals.find((g) => g.id === b.dataset.g), () => viewFinanceiro('metas'))));
}

async function entrySheet(e, onDone) {
  const editing = !!e?.id;
  const x = { kind: 'receita', source: 'manual', category: '', description: '', amount: '', due_date: todayBR(), status: 'pendente', paid_at: null, client_id: null, notes: '', ...e };
  let kind = x.kind;
  const clients = state.clients?.length ? state.clients : await api.clients();
  openSheet(`
    <div class="sheet-head"><h2>${editing ? 'Editar lançamento' : kind === 'custo' ? 'Novo custo' : 'Nova receita'}</h2><button class="icon-btn" data-close aria-label="Fechar">${I.x}</button></div>
    <form id="ef">
      ${editing && x.source === 'plano' ? '<p class="muted" style="font-size:13px;margin-bottom:12px">Cobrança gerada pelo plano do cliente.</p>' : `<div class="field"><label>Tipo</label><div class="seg" id="e-k"><button type="button" data-v="receita" class="${kind === 'receita' ? 'on' : ''}">Receita</button><button type="button" data-v="custo" class="${kind === 'custo' ? 'on' : ''}">Custo</button></div></div>`}
      <div class="field"><label for="e-d">Descrição</label><input class="input" id="e-d" required maxlength="140" value="${esc(x.description)}" placeholder="Ex.: Ensaio fotográfico / Adobe"></div>
      <div class="field" id="e-cw"><label for="e-c">Cliente (opcional)</label><select class="input" id="e-c"><option value="">—</option>${clients.map((c) => `<option value="${c.id}" ${x.client_id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
      <div class="field"><label for="e-cat">Categoria</label><input class="input" id="e-cat" list="e-cats" value="${esc(x.category)}"><datalist id="e-cats"></datalist></div>
      <div class="row2">
        <div class="field"><label for="e-v">Valor (R$)</label><input class="input" id="e-v" inputmode="decimal" required value="${x.amount !== '' ? String(x.amount).replace('.', ',') : ''}" placeholder="0,00"></div>
        <div class="field"><label for="e-due">Vencimento</label><input class="input" type="date" id="e-due" value="${x.due_date}"></div>
      </div>
      <div class="field"><label>Situação</label><div class="seg" id="e-s">${[['pendente', kind === 'custo' ? 'A pagar' : 'A receber'], ['pago', 'Pago'], ['cancelado', 'Cancelado']].map(([k, l]) => `<button type="button" data-v="${k}" class="${x.status === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      <div class="field ${x.status === 'pago' ? '' : 'hidden'}" id="e-pw"><label for="e-p">Pago em</label><input class="input" type="date" id="e-p" value="${x.paid_at || todayBR()}"></div>
      <div class="field"><label for="e-n">Observação</label><textarea class="input" id="e-n" rows="2" maxlength="1000">${esc(x.notes || '')}</textarea></div>
      <div class="err" id="e-err"></div>
      <div class="actions"><button class="btn btn-red" type="submit">Salvar ${I.arrow}</button>${editing ? '<button class="btn btn-ghost" type="button" id="e-del" style="color:var(--red-hi)">Excluir lançamento</button>' : ''}</div>
    </form>`,
  (root, close) => {
    let status = x.status;
    const fillCats = () => { $('#e-cats', root).innerHTML = CATS[kind].map((c) => `<option value="${c}">`).join(''); };
    fillCats();
    const k = $('#e-k', root);
    if (k) k.onclick = (ev) => { const b = ev.target.closest('[data-v]'); if (!b) return; kind = b.dataset.v; k.querySelectorAll('button').forEach((y) => y.classList.toggle('on', y === b)); fillCats(); };
    const s = $('#e-s', root);
    s.onclick = (ev) => { const b = ev.target.closest('[data-v]'); if (!b) return; status = b.dataset.v; s.querySelectorAll('button').forEach((y) => y.classList.toggle('on', y === b)); $('#e-pw', root).classList.toggle('hidden', status !== 'pago'); };
    $('#ef', root).onsubmit = async (ev) => {
      ev.preventDefault();
      const amount = Number($('#e-v', root).value.replace(/\./g, '').replace(',', '.'));
      if (!(amount >= 0) || $('#e-v', root).value.trim() === '') return ($('#e-err', root).textContent = 'Informe o valor.');
      const row = {
        kind, description: $('#e-d', root).value.trim(), client_id: $('#e-c', root).value || null, category: $('#e-cat', root).value.trim() || (kind === 'custo' ? 'Outros' : 'Serviço avulso'),
        amount, due_date: $('#e-due', root).value || todayBR(), status, paid_at: status === 'pago' ? ($('#e-p', root).value || todayBR()) : null, notes: $('#e-n', root).value.trim()
      };
      if (!editing) row.source = x.source === 'plano' ? 'manual' : (kind === 'receita' && row.client_id ? 'avulso' : x.source || 'manual');
      try { if (editing) await api.updateEntry(x.id, row); else await api.addEntry(row); close(); toast('Lançamento salvo.'); onDone(); }
      catch (er) { $('#e-err', root).textContent = er.message; }
    };
    const del = $('#e-del', root);
    if (del) del.onclick = async () => { if (!confirm('Excluir este lançamento?')) return; await api.deleteEntry(x.id); close(); toast('Lançamento excluído.'); onDone(); };
  });
}

// Relatório financeiro em PDF (A4 deitado), usando a mesma impressão dos relatórios
async function financePdf(r, list, names) {
  const t = summarize(list, r);
  const rows = list.filter((e) => e.status !== 'cancelado').sort((a, b) => (a.paid_at || a.due_date).localeCompare(b.paid_at || b.due_date));
  const per = 16; const pages = Math.max(1, Math.ceil(rows.length / per));
  const byCat = {};
  rows.filter((e) => e.status === 'pago').forEach((e) => { const k = `${e.kind}|${e.category}`; byCat[k] = (byCat[k] || 0) + Number(e.amount); });
  const head = (n) => `<header class="rh"><div class="rh-c"><b>EL</b><div><small>Relatório financeiro</small><h1>Elevate Marketing</h1></div></div>
    <div class="rh-p"><span>${fmtD(r[0])} a ${fmtD(r[1])}</span><img src="assets/img/logo.svg" alt="Elevate"></div></header>`;
  const foot = (n) => `<footer class="rf"><span>Gerado pelo CRM Elevate em ${fmtD(todayBR())} · uso interno</span><span>${String(n).padStart(2, '0')}/${String(pages + 1).padStart(2, '0')}</span></footer>`;
  let html = `<section class="rep-page">${head(1)}<div class="rbody ads">
    <div class="rkpis k4" style="grid-column:1/-1">
      <div class="rk accent"><small>Receitas recebidas</small><b>${brl(t.rec)}</b></div>
      <div class="rk"><small>Custos pagos</small><b>${brl(t.cost)}</b></div>
      <div class="rk"><small>Resultado</small><b>${brl(t.rec - t.cost)}</b></div>
      <div class="rk"><small>A receber / a pagar</small><b>${brl(t.pend)}</b><span class="sub">${brl(t.costPend)} a pagar</span></div>
    </div>
    <div class="rsec"><h2>Receitas por categoria</h2><ul class="rlist2">${Object.entries(byCat).filter(([k]) => k.startsWith('receita')).map(([k, v]) => `<li><span>${esc(k.split('|')[1])}</span><b>${brl(v)}</b></li>`).join('') || '<li><span>Sem receitas pagas.</span></li>'}</ul></div>
    <div class="rsec"><h2>Custos por categoria</h2><ul class="rlist2">${Object.entries(byCat).filter(([k]) => k.startsWith('custo')).map(([k, v]) => `<li><span>${esc(k.split('|')[1])}</span><b>${brl(v)}</b></li>`).join('') || '<li><span>Sem custos pagos.</span></li>'}</ul></div>
  </div>${foot(1)}</section>`;
  for (let p = 0; p < pages; p++) {
    const chunk = rows.slice(p * per, (p + 1) * per);
    html += `<section class="rep-page">${head(p + 2)}<div class="rbody one" style="place-items:start stretch">
      <table class="rtable fin"><thead><tr><th>Data</th><th>Descrição</th><th>Cliente</th><th>Categoria</th><th>Situação</th><th style="text-align:right">Valor</th></tr></thead><tbody>
      ${chunk.map((e) => `<tr><td>${fmtD(e.paid_at || e.due_date)}</td><td>${esc(e.description)}</td><td>${esc(names[e.client_id] || '')}</td><td>${esc(e.category)}</td><td>${e.status === 'pago' ? 'Pago' : e.kind === 'custo' ? 'A pagar' : 'A receber'}</td><td style="text-align:right;${e.kind === 'custo' ? 'color:#ff4d4d' : ''}">${e.kind === 'custo' ? '−' : ''}${brl(e.amount)}</td></tr>`).join('') || '<tr><td colspan="6">Nenhum lançamento.</td></tr>'}
      </tbody></table></div>${foot(p + 2)}</section>`;
  }
  const pr = $('#print-root');
  pr.innerHTML = html;
  const prevTitle = document.title;
  document.title = `Financeiro Elevate ${fmtD(r[0])} a ${fmtD(r[1])}`;
  window.addEventListener('afterprint', () => { document.title = prevTitle; pr.innerHTML = ''; }, { once: true });
  toast('Na janela de impressão, escolha "Salvar como PDF".');
  setTimeout(() => window.print(), 300);
}

export { goalSheet };
