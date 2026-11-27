// Página pública do relatório para o cliente (sem login): ver, avaliar com estrelas e baixar PDF
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { renderReport, periodLabel } from './report.js';
import { api } from './api.js';

const qs = new URLSearchParams(location.search);
const TOKEN = (qs.get('t') || '').trim();
const DEMO = qs.has('demo');
const $ = (s, r = document) => r.querySelector(s);
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const fmtDate = (d) => { const x = new Date(d); return `${x.getDate()} ${MS[x.getMonth()]}`; };
const STAR = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l2.9 6.2 6.6.7-5 4.5 1.4 6.6L12 17.2l-5.9 3.3 1.4-6.6-5-4.5 6.6-.7z"/></svg>';
const LABELS = ['', 'Não gostei', 'Pode melhorar', 'Bom', 'Muito bom', 'Excelente!'];

function toast(msg) {
  const el = $('#toast'); el.textContent = msg; el.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 2800);
}

const sb = DEMO ? null : window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
async function load() {
  if (DEMO) {
    const r = await api.report('rep1');
    return { state: 'aberto', expires_at: new Date(Date.now() + 6 * 864e5).toISOString(), data: r.data, feedback: null };
  }
  const { data, error } = await sb.rpc('get_report_share', { p_token: TOKEN });
  if (error) throw new Error(error.message);
  return data;
}
async function send(stars, comment) {
  if (DEMO) { await new Promise((r) => setTimeout(r, 500)); return; }
  const { error } = await sb.rpc('submit_report_feedback', { p_token: TOKEN, p_stars: stars, p_comment: comment });
  if (error) throw new Error(error.message.replace(/^.*?: /, ''));
}

function header(d) {
  const c = d.client || {};
  return `<header class="ap-head rise">
    <div class="ap-brand">
      <span class="ap-logo">${c.logo_url ? `<img src="${esc(c.logo_url)}" alt="${esc(c.name)}">` : `<b>${esc((c.name || 'EL').slice(0, 2).toUpperCase())}</b>`}</span>
      <div><small>Relatório de resultados · ${esc(periodLabel(d.since, d.until))}</small><h1>${esc(c.name || '')}</h1></div>
    </div>
    <span class="ap-by">por <img src="assets/img/logo.svg" alt="Elevate"></span>
  </header>`;
}

function feedbackBox(fb) {
  let stars = fb?.stars || 0;
  const html = `<section class="rc-fb card glow rise" id="fb">
    <div class="rc-fb-t"><div><b>O que você achou deste relatório?</b><small>${fb ? `Você avaliou em ${fmtDate(fb.updated_at)}. Pode mudar quando quiser.` : 'Sua opinião ajuda a Elevate a melhorar o seu trabalho.'}</small></div></div>
    <div class="rc-stars" id="st" role="radiogroup" aria-label="Avaliação de 1 a 5 estrelas">${[1, 2, 3, 4, 5].map((n) => `<button type="button" role="radio" aria-checked="${n === stars}" aria-label="${n} estrela${n > 1 ? 's' : ''}" data-s="${n}" class="${n <= stars ? 'on' : ''}">${STAR}</button>`).join('')}
      <span class="rc-lbl" id="st-l">${stars ? LABELS[stars] : 'Toque nas estrelas'}</span></div>
    <textarea class="input" id="fb-t" rows="3" maxlength="3000" placeholder="Conte o que achou dos resultados, sugestões ou dúvidas (opcional)">${esc(fb?.comment || '')}</textarea>
    <p class="err" id="fb-err"></p>
    <button class="btn btn-red" id="fb-send">${fb ? 'Atualizar avaliação' : 'Enviar avaliação'}</button>
  </section>`;
  const bind = () => {
    const st = $('#st');
    const paint = (n) => st.querySelectorAll('[data-s]').forEach((b) => { b.classList.toggle('on', Number(b.dataset.s) <= n); b.setAttribute('aria-checked', String(Number(b.dataset.s) === n)); });
    st.onmouseover = (e) => { const b = e.target.closest('[data-s]'); if (b) paint(Number(b.dataset.s)); };
    st.onmouseleave = () => paint(stars);
    st.onclick = (e) => { const b = e.target.closest('[data-s]'); if (!b) return; stars = Number(b.dataset.s); paint(stars); $('#st-l').textContent = LABELS[stars]; $('#fb-err').textContent = ''; };
    $('#fb-send').onclick = async (e) => {
      if (!stars) { $('#fb-err').textContent = 'Escolha de 1 a 5 estrelas.'; return; }
      const btn = e.currentTarget; btn.disabled = true; btn.classList.add('loading');
      const comment = $('#fb-t').value.trim();
      try {
        await send(stars, comment);
        const sent = { stars, comment, updated_at: new Date().toISOString() };
        $('#fb').outerHTML = `<section class="rc-fb card glow rise" id="fb"><div class="rc-done"><span class="rc-done-s">${STAR.repeat(stars)}</span>
          <b>Obrigado pela avaliação!</b><small>A equipe Elevate já recebeu seu retorno.</small>
          <button class="btn btn-ghost btn-sm" id="fb-edit">Editar avaliação</button></div></section>`;
        $('#fb-edit').onclick = () => { const again = feedbackBox(sent); $('#fb').outerHTML = again.html; again.bind(); };
      } catch (er) { toast(er.message); btn.disabled = false; btn.classList.remove('loading'); }
    };
  };
  return { html, bind };
}

function render(res) {
  const d = res.data;
  document.title = `Relatório ${d.client?.name || ''} · ${periodLabel(d.since, d.until)}`;
  const fb = feedbackBox(res.feedback);
  $('#ap').innerHTML = `${header(d)}
    <div class="rc-bar rise"><span class="tag solid">Disponível até ${fmtDate(res.expires_at)}</span>
      <button class="btn btn-white btn-sm" id="pdf">Baixar PDF</button></div>
    ${fb.html}
    <div class="rep-scroll rc-pages"><div class="rep-pages">${renderReport(d).replace(/<section class="rep-page">/g, '<div class="rep-fit"><section class="rep-page">').replace(/<\/section>/g, '</section></div>')}</div></div>
    <div class="rc-bottom"><a href="#fb" class="btn btn-red">Avaliar este relatório</a></div>`;
  fb.bind();
  const fit = () => {
    const w = $('.rc-pages').clientWidth;
    $('.rc-pages').style.setProperty('--s', Math.min(1, w / 1123).toFixed(4));
  };
  fit(); window.addEventListener('resize', fit);
  $('#pdf').onclick = async () => {
    const pr = $('#print-root');
    pr.innerHTML = renderReport(d);
    await Promise.all([...pr.querySelectorAll('img')].map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; setTimeout(r, 4000); }))));
    window.addEventListener('afterprint', () => { pr.innerHTML = ''; }, { once: true });
    toast('Na janela de impressão, escolha "Salvar como PDF".');
    setTimeout(() => window.print(), 300);
  };
}

function statusScreen(kind) {
  const msgs = {
    invalido: ['Link não encontrado', 'Confira se o endereço foi copiado inteiro, ou peça um novo link para a equipe Elevate.'],
    expirado: ['Este link expirou', 'Os links de relatório valem por 7 dias. Peça um novo link para a equipe Elevate.']
  };
  const [h, p] = msgs[kind] || msgs.invalido;
  $('#ap').innerHTML = `<header class="ap-head"><span></span><span class="ap-by">por <img src="assets/img/logo.svg" alt="Elevate"></span></header>
    <main class="ap-done rise"><span class="ap-done-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18"/><path d="M12 7v5l3 2"/></svg></span><h2>${h}</h2><p>${p}</p></main>`;
}

(async () => {
  if (!TOKEN && !DEMO) return statusScreen('invalido');
  try {
    const res = await load();
    if (!res || res.state !== 'aberto') return statusScreen(res?.state);
    render(res);
  } catch (e) { statusScreen('invalido'); toast(e.message); }
})();
