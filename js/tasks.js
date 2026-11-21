import { api, todayBR } from './api.js';
import {
  I, PRIOS, STATUS, STAGE, ROLES, state, isManager, isReviewer, person, clientName, $, esc, firstName,
  fmtShort, isLate, ago, face, toast, openSheet, busy
} from './ui.js';

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
    agendamento: [['aprovar', 'Marcar como postado', 'btn-red']]
  }[t.stage] || [];

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

    <div style="margin-top:22px">${attachmentsHtml()}</div>

    <div class="actions">
      ${canEdit ? `<button class="btn btn-ghost" id="edit">Editar tarefa</button>` : ''}
      ${canDelete ? `<button class="btn btn-ghost" id="del" style="color:var(--red-hi)">Excluir tarefa</button>` : ''}
    </div>`,
  (root, close) => {
    attachmentsBlock(root, t.root_id || t.id);
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
          ${activeClients.map((c) => `<option value="${c.id}" ${t.client_id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
      <div class="field"><label for="tf-desc">Detalhes (opcional)</label><textarea class="input" id="tf-desc" name="description" maxlength="2000">${esc(t.description)}</textarea></div>
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
    const seg = $('#prio', root);
    seg.onclick = (e) => { const b = e.target.closest('[data-v]'); if (!b) return; t.priority = b.dataset.v; seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); };
    const who = $('#who', root);
    if (who) who.onclick = (e) => { const b = e.target.closest('[data-p]'); if (!b) return; t.assigned_to = b.dataset.p; who.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); };
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
        assigned_to: isManager() ? t.assigned_to : state.me.id, client_id: f.client_id || null
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
