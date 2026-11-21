import { api, todayBR } from './api.js';
import {
  I, PRIOS, STATUS, STAGE, ROLES, FORMATS, state, isManager, isReviewer, person, clientName, $, esc, firstName,
  fmtShort, fmtPost, toLocalInput, fromLocalInput, isLate, ago, face, toast, openSheet, busy
} from './ui.js';

const clientOf = (id) => state.clients.find((c) => c.id === id) || null;

// ---------------------------------------------------------------------
// Cartão de tarefa (lista do dia)
// ---------------------------------------------------------------------
export function taskCard(t, { showWho = false, i = 0 } = {}) {
  const p = person(t.assigned_to);
  const late = isLate(t);
  const cl = clientName(t.client_id);
  const inFlow = !['a_fazer', 'em_alteracao'].includes(t.stage);
  return `<button class="task card rise st-${t.status}" style="--i:${i}" data-id="${t.id}">
    <span class="chk">${t.status === 'finalizada' ? I.check : t.status === 'nao_realizada' ? I.x : ''}</span>
    <span class="body">
      <h3>${esc(t.title)}</h3>
      ${cl ? `<span class="client">${esc(cl)}</span>` : ''}
      <span class="meta">
        <span class="tag p-${t.priority}">${PRIOS[t.priority]}</span>
        <span class="tag ${late ? 'late' : ''}">${late ? 'Atrasada · ' : 'Prazo '}${fmtShort(t.due_date)}</span>
        ${['incompleta', 'nao_realizada', 'em_alteracao'].includes(t.status) ? `<span class="tag ${t.status === 'em_alteracao' ? 'solid' : t.status === 'incompleta' ? 'p-alta' : 'late'}">${STATUS[t.status]}</span>` : ''}
        ${inFlow && t.status === 'finalizada' ? `<span class="tag stage">${STAGE[t.stage]}</span>` : ''}
        ${t.carried_from ? '<span class="tag carry">Do dia anterior</span>' : ''}
      </span>
      ${t.status === 'em_alteracao' && t.review_note ? `<p class="just alt">Ajuste pedido: ${esc(t.review_note)}</p>` : ''}
      ${t.justification && !['finalizada', 'em_alteracao'].includes(t.status) ? `<p class="just">${esc(t.justification)}</p>` : ''}
    </span>
    ${showWho ? `<span class="who">${face(p, 30)}</span>` : ''}
  </button>`;
}

// Cartão do fluxo de conteúdo
export function kCard(t, i = 0) {
  const p = person(t.assigned_to);
  const cl = clientName(t.client_id);
  return `<button class="kcard card rise" style="--i:${i}" data-id="${t.id}">
    <span class="top-row"><span>${cl ? esc(cl) : 'Sem cliente'}</span><span class="tag p-${t.priority}">${PRIOS[t.priority]}</span></span>
    <h4>${esc(t.title)}</h4>
    ${t.post_format || t.post_at ? `<span class="meta" style="margin-top:6px">${t.post_format ? `<span class="tag">${FORMATS[t.post_format]}</span>` : ''}${t.post_at ? `<span class="tag">${I.calendar}${fmtPost(t.post_at)}</span>` : ''}</span>` : ''}
    ${t.stage === 'agendamento' ? `<span class="meta" style="margin-top:6px">${t.scheduled_at ? `<span class="tag solid">${I.check} Agendado</span>` : '<span class="tag late">Aguardando confirmação</span>'}</span>` : ''}
    ${t.stage === 'em_alteracao' && t.review_note ? `<p class="note">${esc(t.review_note)}</p>` : ''}
    <span class="foot">${face(p, 22)}<span>${esc(firstName(p.name))}</span><span class="tag ${isLate(t) && t.stage !== 'concluido' ? 'late' : ''}">${I.clock}${ago(t.stage_at)}</span></span>
  </button>`;
}

// ---------------------------------------------------------------------
// Anexos
// ---------------------------------------------------------------------
async function attachmentsBlock(root, rootId) {
  const box = $('#att', root);
  const draw = async () => {
    const list = await api.attachments(rootId).catch(() => []);
    box.innerHTML = list.length ? list.map((a) => `
      <div class="att-row" style="padding:0;border:0;background:none">
        <a href="${a.kind === 'link' ? esc(a.url) : '#'}" target="_blank" rel="noopener" data-file="${a.kind === 'file' ? esc(a.path) : ''}" style="flex:1">
          ${a.kind === 'link' ? I.link : /\.(png|jpe?g|gif|webp|heic)$/i.test(a.name) ? I.image : I.file}<span>${esc(a.name)}</span></a>
        ${isManager() || a.created_by === state.me.id ? `<button class="x" data-del="${a.id}" aria-label="Remover anexo">${I.x}</button>` : ''}
      </div>`).join('') : '<p class="muted" style="font-size:13px">Nenhum anexo ainda.</p>';
  };
  await draw();
  box.onclick = async (e) => {
    const f = e.target.closest('[data-file]');
    if (f && f.dataset.file) {
      e.preventDefault();
      const w = window.open('', '_blank');
      try { const url = await api.fileUrl(f.dataset.file); if (w) w.location = url; else location.href = url; } catch (er) { w && w.close(); toast(er.message); }
    }
    const d = e.target.closest('[data-del]');
    if (d && confirm('Remover este anexo?')) { await api.deleteAttachment(d.dataset.del); draw(); }
  };
  $('#att-link', root).onclick = () => {
    const url = prompt('Cole o link (Drive, Figma, Canva…):');
    if (!url) return;
    const full = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    api.addLink(rootId, full.trim(), '').then(draw).catch((er) => toast(er.message));
  };
  $('#att-file-in', root).onchange = async (e) => {
    const files = [...e.target.files]; e.target.value = '';
    for (const file of files) {
      if (file.size > 50 * 1024 * 1024) { toast(`${file.name} passa de 50 MB.`); continue; }
      toast(`Enviando ${file.name}…`);
      try { await api.addFile(rootId, file); } catch (er) { toast(er.message); }
    }
    draw();
  };
}
const attachmentsHtml = () => `
  <div class="field"><label>Anexos</label>
    <div class="att" id="att"></div>
    <div class="att-add">
      <button type="button" class="btn btn-ghost btn-sm" id="att-link" style="width:100%">${I.link} Link</button>
      <label class="btn btn-ghost btn-sm" style="width:100%;cursor:pointer">${I.clip} Imagem ou arquivo
        <input type="file" id="att-file-in" class="sr" multiple accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt"></label>
    </div>
  </div>`;

// ---------------------------------------------------------------------
// Link temporário para o cliente aprovar
// ---------------------------------------------------------------------
export const approvalUrl = (token) => `${location.origin}${location.pathname.replace(/[^/]*$/, '')}aprovacao.html?t=${token}${api.demo ? '&demo' : ''}`;

async function approvalBlock(root, t) {
  const box = $('#appr', root);
  const draw = (l) => {
    const valid = l && !l.used_at && new Date(l.expires_at) > new Date();
    const url = valid ? approvalUrl(l.token) : '';
    const days = valid ? Math.max(1, Math.ceil((new Date(l.expires_at) - Date.now()) / 86400e3)) : 0;
    const cl = clientName(t.client_id);
    const msg = `Olá! Segue o conteúdo "${t.title}" para sua aprovação: ${url}`;
    box.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b>${I.link} Link de aprovação do cliente</b>${valid ? `<span class="tag solid">expira em ${days} dia${days > 1 ? 's' : ''}</span>` : ''}</div>
      ${valid ? `<p class="muted" style="font-size:13px;margin:8px 0 10px;line-height:1.45">Envie para ${cl ? esc(cl) : 'o cliente'}. Ele vê o conteúdo e responde <b>Aprovado</b> ou <b>Alteração</b>, sem precisar de cadastro.</p>
        <input class="input" readonly value="${esc(url)}" id="appr-url" style="font-size:13px;height:44px">
        <div class="att-add" style="grid-template-columns:1fr 1fr 1fr">
          <button class="btn btn-white btn-sm" id="appr-copy" style="width:100%">Copiar</button>
          <a class="btn btn-ghost btn-sm" style="width:100%;text-decoration:none" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(msg)}">WhatsApp</a>
          <a class="btn btn-ghost btn-sm" style="width:100%;text-decoration:none" target="_blank" rel="noopener" href="${esc(url)}">Abrir</a>
        </div>`
      : `<p class="muted" style="font-size:13px;margin:8px 0 10px">${l?.used_at ? 'O cliente já respondeu este link.' : 'O link expirou ou ainda não foi criado.'}</p>`}
      <button class="btn btn-ghost btn-sm" id="appr-new" style="width:100%;margin-top:6px">Gerar novo link</button>`;
    const cp = $('#appr-copy', box);
    if (cp) cp.onclick = async () => {
      try { await navigator.clipboard.writeText(url); } catch { $('#appr-url', box).select(); document.execCommand('copy'); }
      toast('Link copiado!');
    };
    $('#appr-new', box).onclick = (e) => busy(e.currentTarget, async () => {
      try { await api.newApprovalLink(t.id); draw(await api.approvalLink(t.root_id || t.id)); toast('Novo link gerado. O anterior deixou de funcionar.'); }
      catch (er) { toast(er.message); }
    });
  };
  try { draw(await api.approvalLink(t.root_id || t.id)); } catch (er) { box.innerHTML = `<p class="err">${esc(er.message)}</p>`; }
}

// ---------------------------------------------------------------------
// Detalhe da tarefa: status do dia + ações do fluxo + anexos
// ---------------------------------------------------------------------
export function taskSheet(t, onDone) {
  const done = onDone || (() => state.render());
  const mine = t.assigned_to === state.me.id;
  const canMark = mine || (isManager() && ['a_fazer', 'em_alteracao'].includes(t.stage));
  const canEdit = isManager();
  const canDelete = isManager() || t.created_by === state.me.id;
  const rev = isReviewer();
  let status = ['pendente', 'em_alteracao'].includes(t.status) ? null : t.status;
  const opts = [
    ['finalizada', 'Finalizada', 'Entreguei. Vai para a revisão interna.'],
    ['incompleta', 'Incompleta', 'Volta amanhã para terminar.'],
    ['nao_realizada', 'Não realizada', 'Volta amanhã na sua lista.']
  ];
  const p = person(t.assigned_to);
  const cl = clientName(t.client_id);
  const flowIdx = ['revisao_interna', 'revisao_cliente', 'agendamento', 'concluido'].indexOf(t.stage);
  const flowActions = {
    revisao_interna: [['aprovar', 'Aprovar e enviar ao cliente', 'btn-red'], ['alterar', 'Pedir alteração', 'btn-ghost']],
    revisao_cliente: [['aprovar', 'Cliente aprovou', 'btn-red'], ['alterar', 'Cliente pediu alteração', 'btn-ghost']],
  }[t.stage] || [];
  const cli = clientOf(t.client_id);
  const fmtSel = t.post_format || '';
  const pubInfo = t.post_format || t.post_at || t.caption ? `
    <div class="pub card">
      <div class="pub-h"><b>${I.insta} Publicação</b>${cli?.instagram ? `<span class="muted">@${esc(cli.instagram)}</span>` : ''}</div>
      <div class="meta">${t.post_format ? `<span class="tag">${FORMATS[t.post_format]}</span>` : ''}${t.post_at ? `<span class="tag">${I.calendar}${fmtPost(t.post_at)}</span>` : ''}${t.scheduled_at ? `<span class="tag solid">${I.check} Agendado</span>` : ''}</div>
      ${t.caption ? `<p class="pub-cap">${esc(t.caption)}</p>` : ''}
    </div>` : '';
  const schedBlock = rev && t.stage === 'agendamento' ? (t.scheduled_at ? `
    <div class="pub card glow" id="sched">
      <div class="pub-h"><b>${I.check} Agendamento confirmado</b><span class="muted">por ${esc(firstName(person(t.scheduled_by).name))}</span></div>
      <p style="margin-top:8px;line-height:1.5">${FORMATS[t.post_format] || 'Post'} para <b>${fmtPost(t.post_at)}</b>${cli?.instagram ? ` no <b>@${esc(cli.instagram)}</b>` : ''}.</p>
      ${t.caption ? `<p class="pub-cap">${esc(t.caption)}</p>` : ''}
      <div class="err" id="sc-err"></div>
      <div class="actions" style="margin-top:10px"><button class="btn btn-red" id="posted">Marcar como postado ${I.arrow}</button><button class="btn btn-ghost" id="unsched">Editar agendamento</button></div>
    </div>` : `
    <div class="pub card glow" id="sched">
      <div class="pub-h"><b>${I.calendar} Confirmar agendamento nas redes</b></div>
      <p class="muted" style="font-size:13px;margin:6px 0 12px;line-height:1.45">O cliente aprovou. Confira os dados e confirme para agendar ${cli?.instagram ? `no <b style="color:var(--white)">@${esc(cli.instagram)}</b>` : 'no Instagram do cliente'}.</p>
      ${cli && !cli.instagram ? `<p class="just" style="margin-bottom:12px">Este cliente ainda não tem o @ do Instagram. Cadastre em Equipe → Clientes.</p>` : ''}
      <div class="field"><label>Formato</label><div class="seg" id="sc-fmt">${Object.entries(FORMATS).map(([k, v]) => `<button type="button" data-v="${k}" class="${fmtSel === k ? 'on' : ''}">${v}</button>`).join('')}</div></div>
      <div class="field"><label for="sc-at">Data e hora da postagem</label><input class="input" type="datetime-local" id="sc-at" value="${toLocalInput(t.post_at)}"></div>
      <div class="field"><label for="sc-cap">Legenda</label><textarea class="input" id="sc-cap" rows="5" maxlength="2200">${esc(t.caption || '')}</textarea></div>
      <div class="err" id="sc-err"></div>
      <div class="actions" style="margin-top:4px"><button class="btn btn-red" id="sc-ok">Confirmar agendamento ${I.arrow}</button></div>
    </div>`) : '';

  openSheet(`
    <div class="sheet-head"><div><small class="muted">${cl ? esc(cl) + ' · ' : ''}${STAGE[t.stage]}</small><h2>${esc(t.title)}</h2></div><button class="icon-btn" data-close aria-label="Fechar">${I.x}</button></div>
    <div class="stage-steps" title="Etapa do fluxo">${[0, 1, 2, 3].map((k) => `<i class="${k < flowIdx ? 'on' : k === flowIdx ? 'cur' : ''}"></i>`).join('')}</div>
    <div class="meta" style="margin:-6px 0 14px">
      <span class="tag p-${t.priority}">${PRIOS[t.priority]}</span>
      <span class="tag">Dia ${fmtShort(t.task_date)}</span>
      <span class="tag ${isLate(t) ? 'late' : ''}">Prazo ${fmtShort(t.due_date)}</span>
      ${t.carried_from ? '<span class="tag carry">Do dia anterior</span>' : ''}
    </div>
    ${t.description ? `<p style="line-height:1.5;margin-bottom:16px;color:#cfcfcf;white-space:pre-wrap">${esc(t.description)}</p>` : ''}
    ${t.review_note && ['em_alteracao'].includes(t.stage) ? `<p class="just alt" style="border-left:2px solid var(--white);padding-left:10px;margin-bottom:16px;line-height:1.5"><b>Ajuste pedido:</b> ${esc(t.review_note)}</p>` : ''}
    ${!mine ? `<div class="person card" style="margin-bottom:16px">${face(p, 36)}<span class="info"><b>${esc(p.name)}</b><small>${ROLES[p.role]}</small></span></div>` : ''}
    ${schedBlock || pubInfo}

    ${rev && flowActions.length ? `
    <div class="section-title" style="margin-top:8px"><h2>Fluxo de conteúdo</h2><span>${STAGE[t.stage]}</span></div>
    <div class="field hidden" id="nf"><label for="note">O que precisa mudar? <span class="red">*</span></label>
      <textarea class="input" id="note" placeholder="Descreva o ajuste para ${esc(firstName(p.name))}"></textarea></div>
    <div class="err" id="fl-err"></div>
    <div class="actions" style="margin-top:4px" id="fl">${flowActions.map(([a, l, c]) => `<button class="btn ${c}" data-a="${a}">${l}${a === 'aprovar' ? ' ' + I.arrow : ''}</button>`).join('')}</div>` : ''}

    ${canMark && t.stage !== 'concluido' ? `
    <div class="field"><label>Como ficou essa demanda hoje?</label>
      <div class="status-opts" id="so">${opts.map(([k, l, h]) => `<button type="button" data-v="${k}" class="${status === k ? 'on' : ''}"><span class="chk"></span><span><b>${l}</b><small>${h}</small></span></button>`).join('')}</div>
    </div>
    <div class="field ${status && status !== 'finalizada' ? '' : 'hidden'}" id="jf">
      <label for="just">Por que não foi finalizada? <span class="red">*</span></label>
      <textarea class="input" id="just" placeholder="Ex.: aguardando aprovação do cliente">${esc(t.justification)}</textarea>
    </div>
    <div class="err" id="ts-err"></div>
    <div class="actions" style="margin-top:4px"><button class="btn btn-red" id="save">Salvar status ${I.arrow}</button></div>` : ''}

    ${rev && t.stage === 'revisao_cliente' ? `<div class="appr card glow" id="appr"><p class="muted" style="font-size:13px">Carregando link do cliente…</p></div>` : ''}

    <div style="margin-top:22px">${attachmentsHtml()}</div>

    <div class="actions">
      ${canEdit ? `<button class="btn btn-ghost" id="edit">Editar tarefa</button>` : ''}
      ${canDelete ? `<button class="btn btn-ghost" id="del" style="color:var(--red-hi)">Excluir tarefa</button>` : ''}
    </div>`,
  (root, close) => {
    attachmentsBlock(root, t.root_id || t.id);
    if ($('#appr', root)) approvalBlock(root, t);
    const fmt = $('#sc-fmt', root); let scFmt = fmtSel;
    if (fmt) fmt.onclick = (e) => { const b = e.target.closest('[data-v]'); if (!b) return; scFmt = b.dataset.v; fmt.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); };
    const scOk = $('#sc-ok', root);
    if (scOk) scOk.onclick = () => {
      const at = $('#sc-at', root).value;
      if (!scFmt) return ($('#sc-err', root).textContent = 'Escolha o formato.');
      if (!at) return ($('#sc-err', root).textContent = 'Informe a data e a hora da postagem.');
      busy(scOk, async () => {
        try { await api.confirmSchedule(t.id, fromLocalInput(at), $('#sc-cap', root).value.trim(), scFmt); close(); toast(`Agendamento confirmado para ${fmtPost(fromLocalInput(at))}.`); done(); }
        catch (er) { $('#sc-err', root).textContent = er.message; }
      });
    };
    const posted = $('#posted', root);
    if (posted) posted.onclick = () => busy(posted, async () => {
      try { await api.review(t.id, 'aprovar'); close(); toast('Postado! Conteúdo concluído.'); done(); } catch (er) { $('#sc-err', root).textContent = er.message; }
    });
    const uns = $('#unsched', root);
    if (uns) uns.onclick = () => busy(uns, async () => {
      try { await api.unconfirmSchedule(t.id); close(); taskSheet({ ...t, scheduled_at: null, scheduled_by: null }, onDone); } catch (er) { $('#sc-err', root).textContent = er.message; }
    });
    const so = $('#so', root);
    if (so) {
      so.onclick = (e) => {
        const b = e.target.closest('[data-v]'); if (!b) return;
        status = b.dataset.v;
        so.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
        $('#jf', root).classList.toggle('hidden', status === 'finalizada');
        if (status !== 'finalizada') $('#just', root).focus();
      };
      $('#save', root).onclick = (e) => {
        const just = $('#just', root).value.trim();
        if (!status) return ($('#ts-err', root).textContent = 'Escolha um status.');
        if (status !== 'finalizada' && !just) return ($('#ts-err', root).textContent = 'Conte o motivo para seguir.');
        busy(e.currentTarget, async () => {
          try {
            await api.updateTask(t.id, { status, justification: status === 'finalizada' ? '' : just });
            close(); toast(status === 'finalizada' ? 'Boa! Foi para a revisão interna.' : 'Status salvo. Ela volta amanhã.'); done();
          } catch (er) { $('#ts-err', root).textContent = er.message; }
        });
      };
    }
    const fl = $('#fl', root);
    if (fl) {
      let asking = false;
      fl.onclick = (e) => {
        const b = e.target.closest('[data-a]'); if (!b) return;
        const a = b.dataset.a;
        if (a === 'alterar' && !asking) {
          asking = true; $('#nf', root).classList.remove('hidden'); $('#note', root).focus();
          b.textContent = 'Enviar pedido de alteração'; b.classList.replace('btn-ghost', 'btn-white'); return;
        }
        const note = a === 'alterar' ? $('#note', root).value.trim() : '';
        if (a === 'alterar' && !note) return ($('#fl-err', root).textContent = 'Descreva o ajuste.');
        busy(b, async () => {
          try {
            await api.review(t.id, a, note);
            close();
            toast(a === 'alterar' ? `Voltou para ${firstName(p.name)} com o pedido de ajuste.` : t.stage === 'agendamento' ? 'Postado! Conteúdo concluído.' : 'Aprovado. Próxima etapa!');
            done();
          } catch (er) { $('#fl-err', root).textContent = er.message; }
        });
      };
    }
    const ed = $('#edit', root); if (ed) ed.onclick = () => { close(); newTaskSheet(t, done); };
    const dl = $('#del', root); if (dl) dl.onclick = async () => {
      if (!confirm('Excluir esta tarefa?')) return;
      try { await api.deleteTask(t.id); close(); toast('Tarefa excluída.'); done(); } catch (er) { toast(er.message); }
    };
  });
}

// ---------------------------------------------------------------------
// Nova tarefa / editar
// ---------------------------------------------------------------------
export function newTaskSheet(pre = {}, onDone) {
  const done = onDone || (() => state.render());
  const editing = !!pre.id;
  const t = { title: '', description: '', priority: 'media', task_date: state.tab === 'hoje' ? state.date : todayBR(), due_date: '', assigned_to: state.me.id, client_id: '', ...pre };
  if (!t.due_date) t.due_date = t.task_date;
  const ppl = isManager() ? state.people : [];
  const queue = { links: [], files: [] };
  const activeClients = state.clients.filter((c) => c.active || c.id === t.client_id);
  openSheet(`
    <div class="sheet-head"><h2>${editing ? 'Editar tarefa' : 'Nova tarefa'}</h2><button class="icon-btn" data-close aria-label="Fechar">${I.x}</button></div>
    <form id="tf">
      <div class="field"><label for="tf-title">O que precisa ser feito?</label><input class="input" id="tf-title" name="title" required maxlength="140" value="${esc(t.title)}" placeholder="Ex.: Carrossel de dezembro"></div>
      <div class="field"><label for="tf-client">Cliente</label>
        <select class="input" id="tf-client" name="client_id"><option value="">Sem cliente / interno</option>
          ${activeClients.map((c) => `<option value="${c.id}" ${t.client_id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
          <option value="__novo">+ Novo cliente…</option></select>
        <div class="hidden" id="nc" style="display:grid;grid-template-columns:1fr auto;gap:8px">
          <input class="input" id="nc-name" placeholder="Nome do novo cliente" maxlength="80">
          <button type="button" class="btn btn-red" id="nc-ok" style="width:auto">Criar</button>
        </div></div>
      <div class="field"><label for="tf-desc">Detalhes (opcional)</label><textarea class="input" id="tf-desc" name="description" maxlength="2000">${esc(t.description)}</textarea></div>
      <fieldset class="pub-form">
        <legend>${I.insta} Publicação <small>(opcional)</small></legend>
        <div class="field"><label>Formato</label>
          <div class="seg" id="tf-fmt"><button type="button" data-v="" class="${t.post_format ? '' : 'on'}">—</button>${Object.entries(FORMATS).map(([k, v]) => `<button type="button" data-v="${k}" class="${t.post_format === k ? 'on' : ''}">${v}</button>`).join('')}</div></div>
        <div class="field"><label for="tf-at">Data e hora da postagem</label><input class="input" type="datetime-local" id="tf-at" name="post_at" value="${toLocalInput(t.post_at)}"></div>
        <div class="field" style="margin-bottom:0"><label for="tf-cap">Legenda</label><textarea class="input" id="tf-cap" name="caption" rows="4" maxlength="2200" placeholder="Texto que vai no post, com hashtags">${esc(t.caption || '')}</textarea></div>
      </fieldset>
      <div class="field"><label>Prioridade</label>
        <div class="seg" id="prio">${Object.entries(PRIOS).map(([k, v]) => `<button type="button" data-v="${k}" class="${t.priority === k ? 'on' : ''}">${v}</button>`).join('')}</div></div>
      <div class="row2">
        <div class="field"><label for="tf-d">Data da demanda</label><input class="input" id="tf-d" type="date" name="task_date" required value="${t.task_date}"></div>
        <div class="field"><label for="tf-p">Prazo de entrega</label><input class="input" id="tf-p" type="date" name="due_date" required value="${t.due_date}"></div>
      </div>
      ${ppl.length ? `<div class="field"><label>Responsável</label>
        <div class="people" id="who">${ppl.map((x) => `<button type="button" data-p="${x.id}" class="${t.assigned_to === x.id ? 'on' : ''}">${face(x, 40)}${esc(firstName(x.name))}${x.id === state.me.id ? ' (eu)' : ''}</button>`).join('')}</div></div>`
      : '<p class="muted" style="font-size:13px;margin-bottom:14px">Esta tarefa será adicionada à sua lista.</p>'}
      ${editing ? '' : `<div class="field"><label>Anexos</label>
        <div class="att" id="q-list"></div>
        <div class="att-add">
          <button type="button" class="btn btn-ghost btn-sm" id="q-link" style="width:100%">${I.link} Link</button>
          <label class="btn btn-ghost btn-sm" style="width:100%;cursor:pointer">${I.clip} Imagem ou arquivo
            <input type="file" id="q-file" class="sr" multiple accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt"></label>
        </div></div>`}
      <div class="err" id="tf-err"></div>
      <div class="actions"><button class="btn btn-red" type="submit">${editing ? 'Salvar alterações' : 'Criar tarefa'} ${I.arrow}</button></div>
    </form>`,
  (root, close) => {
    const tfFmt = $('#tf-fmt', root);
    tfFmt.onclick = (e) => { const b = e.target.closest('[data-v]'); if (!b) return; t.post_format = b.dataset.v || null; tfFmt.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); };
    const seg = $('#prio', root);
    seg.onclick = (e) => { const b = e.target.closest('[data-v]'); if (!b) return; t.priority = b.dataset.v; seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); };
    const who = $('#who', root);
    if (who) who.onclick = (e) => { const b = e.target.closest('[data-p]'); if (!b) return; t.assigned_to = b.dataset.p; who.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); };
    const sel = $('#tf-client', root), nc = $('#nc', root);
    let lastClient = sel.value;
    sel.onchange = () => {
      if (sel.value === '__novo') { nc.classList.remove('hidden'); $('#nc-name', root).focus(); sel.value = lastClient; }
      else { lastClient = sel.value; nc.classList.add('hidden'); }
    };
    const createClient = (e) => {
      const name = $('#nc-name', root).value.trim();
      if (!name) return $('#nc-name', root).focus();
      busy($('#nc-ok', root), async () => {
        try {
          const c = await api.createClient(name);
          state.clients.push(c); state.clients.sort((a, b) => a.name.localeCompare(b.name));
          const o = new Option(c.name, c.id, true, true);
          sel.insertBefore(o, sel.querySelector('[value="__novo"]'));
          lastClient = c.id; nc.classList.add('hidden'); $('#nc-name', root).value = '';
          toast(`${c.name} adicionado aos clientes.`);
        } catch (er) { toast(er.message); }
      });
    };
    $('#nc-ok', root).onclick = createClient;
    $('#nc-name', root).onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); createClient(); } };
    const td = root.querySelector('[name=task_date]'), dd = root.querySelector('[name=due_date]');
    td.onchange = () => { if (dd.value < td.value) dd.value = td.value; };
    const drawQ = () => {
      const ql = $('#q-list', root); if (!ql) return;
      ql.innerHTML = [...queue.links.map((u, k) => `<div class="att-row">${I.link}<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(u)}</span><button type="button" class="x" data-ql="${k}">${I.x}</button></div>`),
        ...queue.files.map((f, k) => `<div class="att-row">${I.file}<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(f.name)}</span><button type="button" class="x" data-qf="${k}">${I.x}</button></div>`)].join('');
    };
    if (!editing) {
      $('#q-link', root).onclick = () => { const u = prompt('Cole o link (Drive, Figma, Canva…):'); if (u) { queue.links.push(/^https?:\/\//i.test(u) ? u.trim() : `https://${u.trim()}`); drawQ(); } };
      $('#q-file', root).onchange = (e) => { queue.files.push(...[...e.target.files].filter((f) => f.size <= 50 * 1024 * 1024)); e.target.value = ''; drawQ(); };
      $('#q-list', root).onclick = (e) => {
        const l = e.target.closest('[data-ql]'); if (l) { queue.links.splice(+l.dataset.ql, 1); drawQ(); }
        const f = e.target.closest('[data-qf]'); if (f) { queue.files.splice(+f.dataset.qf, 1); drawQ(); }
      };
    }
    $('#tf', root).onsubmit = (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      if (f.due_date < f.task_date) return ($('#tf-err', root).textContent = 'O prazo não pode ser antes da data da demanda.');
      const payload = {
        title: f.title.trim(), description: f.description.trim(), priority: t.priority, task_date: f.task_date, due_date: f.due_date,
        assigned_to: isManager() ? t.assigned_to : state.me.id, client_id: f.client_id && f.client_id !== '__novo' ? f.client_id : null,
        post_format: t.post_format || null, post_at: fromLocalInput(f.post_at), caption: (f.caption || '').trim()
      };
      busy(e.submitter || e.target.querySelector('[type=submit]'), async () => {
        try {
          if (editing) await api.updateTask(t.id, payload);
          else {
            const created = await api.createTask({ ...payload, created_by: state.me.id });
            const rootId = created.root_id || created.id;
            for (const u of queue.links) await api.addLink(rootId, u, '').catch(() => {});
            for (const file of queue.files) await api.addFile(rootId, file).catch((er) => toast(er.message));
          }
          close();
          const who2 = person(payload.assigned_to);
          toast(editing ? 'Tarefa atualizada.' : payload.assigned_to === state.me.id ? 'Tarefa criada.' : `Tarefa enviada para ${firstName(who2.name)}.`);
          done();
        } catch (er) { $('#tf-err', root).textContent = er.message; }
      });
    };
  });
}
