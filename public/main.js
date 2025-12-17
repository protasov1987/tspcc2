const roles = [
  'Технолог',
  'Мастер',
  'Исполнитель',
  'СКК',
  'ИЛ',
  'ЗГД по технологиям',
  'ЗГД по качеству',
  'Начальник производства',
  'Руководство/Планирование',
  'Админ',
];

const roleTabs = {
  'Исполнитель': ['dashboard', 'tracker', 'workspace'],
  'Мастер': ['dashboard', 'tracker', 'master'],
  'Технолог': ['dashboard', 'mk', 'tracker', 'quality', 'archive'],
  'СКК': ['dashboard', 'quality'],
  'ИЛ': ['dashboard', 'quality'],
  'ЗГД по технологиям': ['dashboard', 'approval', 'mk', 'tracker'],
  'ЗГД по качеству': ['dashboard', 'approval', 'mk', 'tracker'],
  'Начальник производства': ['dashboard', 'approval', 'mk', 'tracker'],
  'Руководство/Планирование': ['dashboard', 'plan', 'tracker', 'archive'],
  'Админ': ['dashboard', 'mk', 'tracker', 'workspace', 'master', 'quality', 'approval', 'plan', 'archive'],
};

const tabLabels = {
  dashboard: 'Dashboard',
  mk: 'МК',
  tracker: 'Трекер',
  workspace: 'Рабочее место',
  master: 'Пост мастера',
  quality: 'Качество',
  approval: 'Согласование',
  plan: 'План/Отчёты',
  archive: 'Архив',
};

let currentRole = localStorage.getItem('role');
let currentTab = null;
let state = { routeCards: [], isolation: [] };

function qs(id) { return document.querySelector(id); }

function showRoleModal() {
  const modal = qs('#role-modal');
  modal.style.display = 'flex';
  const select = qs('#role-select');
  select.innerHTML = roles.map(r => `<option value="${r}">${r}</option>`).join('');
  if (currentRole) select.value = currentRole;
  qs('#role-save').onclick = () => {
    currentRole = select.value;
    localStorage.setItem('role', currentRole);
    modal.style.display = 'none';
    init();
  };
}

function setupRoleControls() {
  qs('#current-role').textContent = currentRole || '—';
  qs('#change-role').onclick = showRoleModal;
}

async function fetchState() {
  const res = await fetch('/api/state');
  state = await res.json();
}

function renderTabs() {
  const tabs = roleTabs[currentRole] || [];
  const nav = qs('#tabs');
  nav.innerHTML = '';
  tabs.forEach(t => {
    const btn = document.createElement('button');
    btn.textContent = tabLabels[t];
    btn.className = currentTab === t ? 'active' : '';
    btn.onclick = () => { currentTab = t; render(); };
    nav.appendChild(btn);
  });
  if (!currentTab || !tabs.includes(currentTab)) currentTab = tabs[0];
}

function summaryCard(card) {
  const done = card.details.filter(d => d.state === 'done').length;
  const delayed = card.details.filter(d => d.state === 'delayed').length;
  const defect = card.details.filter(d => d.state.startsWith('defect')).length;
  const awaiting = card.details.filter(d => d.state === 'awaiting').length;
  return `<div class="section"><h3>${card.number} — ${card.product}</h3>
    <p>Партия: ${card.batchSize} | Статус: ${card.status}</p>
    <div class="tag">Ожидают: ${awaiting}</div>
    <div class="tag">Задержаны: ${delayed}</div>
    <div class="tag">Брак: ${defect}</div>
    <div class="tag">Готово: ${done}</div>
    <div>Печать: <a href="/print/card/${card.id}" target="_blank">МК</a> | <a href="/print/code128/${encodeURIComponent(card.number)}" target="_blank">Штрихкод</a></div>
  </div>`;
}

function renderDashboard(container) {
  const inWork = state.routeCards.filter(c => c.status === 'approved');
  const waitingApproval = state.routeCards.filter(c => c.status === 'draft');
  const finished = state.routeCards.filter(c => c.details.every(d => ['done','defect_final','moved_to_rework'].includes(d.state)));
  container.innerHTML = `
    <div class="section"><h3>Сводка</h3>
      <div class="tag">В работе: ${inWork.length}</div>
      <div class="tag">На согласовании: ${waitingApproval.length}</div>
      <div class="tag">Завершено/архив: ${finished.length}</div>
    </div>
    <div class="section"><h3>Проблемы</h3>
      <div>Задержки: ${state.routeCards.reduce((acc,c)=>acc+c.details.filter(d=>d.state==='delayed').length,0)}</div>
      <div>Брак/изоляция: ${state.isolation?.filter(i=>i.status==='pending').length || 0}</div>
    </div>
    <div class="section"><h3>МК</h3>${state.routeCards.slice(0,6).map(summaryCard).join('')}</div>
  `;
}

function renderMk(container) {
  const form = document.createElement('div');
  form.className = 'section';
  form.innerHTML = `<h3>Создание МК</h3>
    <div class="flex">
      <label>Номер <input id="mk-number"></label>
      <label>Изделие <input id="mk-product"></label>
      <label>Партия <input id="mk-batch" type="number" value="1" min="1"></label>
    </div>
    <label>Заказ/договор <input id="mk-order"></label>
    <label>Примечание <textarea id="mk-note"></textarea></label>
    <label>Операции (по одной на строку, *К для контроля, *ID для идентификации)</label>
    <textarea id="mk-ops" rows="5">Входной контроль*ID
Операция 2
СКК*К
Сборка</textarea>
    <button id="mk-create">Создать</button>`;
  container.appendChild(form);
  qs('#mk-create').onclick = async () => {
    const opsRaw = qs('#mk-ops').value.split('\n').filter(Boolean);
    const operations = opsRaw.map((name, idx) => ({ id: `op${idx+1}`, name: name.replace('*K','').replace('*ID',''), isControl: name.includes('*К') || name.includes('*K'), isIdentification: name.includes('*ID') }));
    await fetch('/api/cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        number: qs('#mk-number').value,
        product: qs('#mk-product').value,
        batchSize: Number(qs('#mk-batch').value),
        order: qs('#mk-order').value,
        note: qs('#mk-note').value,
        author: currentRole,
        operations,
      }),
    });
    await fetchState();
    render();
  };

  const list = document.createElement('div');
  list.className = 'section';
  list.innerHTML = '<h3>Все МК</h3>' + state.routeCards.map(card => {
    const ops = card.operations.map((o,i)=>`<div>${i+1}. ${o.name} ${o.isControl?'(контроль)':''} ${o.isIdentification?'(ID)':''}</div>`).join('');
    const approvals = Object.entries(card.approvals||{}).map(([k,v])=>`<div>${k}: ${v? v.decision : 'ожидает'}</div>`).join('');
    const log = (card.logs||[]).slice(0,5).map(l=>`<div>${l.ts}: ${l.message}</div>`).join('');
    return `<div class="section"><strong>${card.number}</strong> — ${card.product}<div class="flex">
      <div><div class="badge">Партия ${card.batchSize}</div><div>${ops}</div></div>
      <div><h4>Согласование</h4>${approvals}</div>
      <div><h4>Лог</h4><div class="list">${log}</div></div>
      </div></div>`;
  }).join('');
  container.appendChild(list);
}

function renderTracker(container) {
  const section = document.createElement('div');
  section.className = 'section';
  section.innerHTML = '<h3>Трекер</h3>';
  const rows = state.routeCards.map(card => {
    const perOp = card.operations.map((op, idx) => {
      const onOp = card.details.filter(d => d.operationIndex === idx && ['awaiting','in_work','delayed'].includes(d.state));
      const delayed = onOp.filter(d=>d.state==='delayed').length;
      const inWork = onOp.filter(d=>d.state==='in_work').length;
      const awaiting = onOp.filter(d=>d.state==='awaiting').length;
      const passed = card.details.filter(d => d.operationIndex>idx).length;
      const defect = card.details.filter(d => d.state.startsWith('defect') && d.operationIndex===idx).length;
      return `<div class="section"><strong>${idx+1}. ${op.name}</strong> <div class="tag">Ожидают ${awaiting}</div><div class="tag">В работе ${inWork}</div><div class="tag">Задержаны ${delayed}</div><div class="tag">Ушли дальше ${passed}</div><div class="tag">Брак ${defect}</div></div>`;
    }).join('');
    return `<div class="section"><h4>${card.number}</h4>${perOp}</div>`;
  }).join('');
  section.innerHTML += rows;
  container.appendChild(section);
}

function renderWorkspace(container) {
  const cards = state.routeCards.filter(c => c.status === 'approved' || currentRole === 'Админ');
  const section = document.createElement('div');
  section.className = 'section';
  section.innerHTML = '<h3>Рабочие сессии</h3>';
  const available = [];
  cards.forEach(card => {
    card.operations.forEach((op, idx) => {
      const gateOpen = card.gate && card.gate[op.id];
      const assigned = (card.assignments||{})[op.id]||[];
      const can = gateOpen && assigned.includes(currentRole);
      if (can) {
        const free = card.details.filter(d=>d.operationIndex===idx && d.state==='awaiting');
        available.push({card, op, idx, free});
      }
    });
  });
  section.innerHTML += available.map(item => `<div class="section"><strong>${item.card.number}</strong> — ${item.op.name} (свободно ${item.free.length})
      <label>Взять N <input type="number" min="1" max="${item.free.length}" value="1" data-card="${item.card.id}" data-op="${item.op.id}" class="take-count"></label>
      <button class="start-btn" data-card="${item.card.id}" data-op="${item.op.id}" data-idx="${item.idx}">Старт</button>
    </div>`).join('') || '<p>Нет назначенных операций</p>';
  container.appendChild(section);

  section.querySelectorAll('.start-btn').forEach(btn => {
    btn.onclick = async () => {
      const opId = btn.dataset.op;
      const cardId = btn.dataset.card;
      const input = section.querySelector(`input[data-card="${cardId}"][data-op="${opId}"]`);
      await fetch(`/api/cards/${cardId}/session/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operationId: opId, executor: currentRole, count: Number(input.value) })
      });
      await fetchState();
      render();
    };
  });

  const active = document.createElement('div');
  active.className = 'section';
  active.innerHTML = '<h3>Активные сессии</h3>';
  const sessions = state.routeCards.flatMap(card => (card.sessions||[]).map(s => ({card, s, op: card.operations[s.opIndex]})));
  active.innerHTML += sessions.map(({card,s,op}) => {
    const opIsId = op && op.isIdentification;
    const idField = opIsId ? '<label>Идентификаторы (через запятую) <input class="idents" data-session="'+s.id+'"></label>' : '';
    return `<div class="section"><strong>${card.number}</strong> — ${op?.name}
      <div>Деталей: ${s.detailIds.length}</div>
      <label>good <input class="good" data-session="${s.id}" type="number" min="0" value="${s.detailIds.length}"></label>
      <label>delayed <input class="delayed" data-session="${s.id}" type="number" min="0" value="0"></label>
      <label>defect <input class="defect" data-session="${s.id}" type="number" min="0" value="0"></label>
      ${idField}
      <button class="finish" data-card="${card.id}" data-session="${s.id}">Завершить</button>
    </div>`;
  }).join('') || '<p>Нет активных сессий</p>';
  container.appendChild(active);

  active.querySelectorAll('.finish').forEach(btn => {
    btn.onclick = async () => {
      const sessionId = btn.dataset.session;
      const cardId = btn.dataset.card;
      const good = Number(active.querySelector(`.good[data-session="${sessionId}"]`).value);
      const delayed = Number(active.querySelector(`.delayed[data-session="${sessionId}"]`).value);
      const defect = Number(active.querySelector(`.defect[data-session="${sessionId}"]`).value);
      const identInput = active.querySelector(`.idents[data-session="${sessionId}"]`);
      const identifiers = identInput ? identInput.value.split(',').map(s=>s.trim()).filter(Boolean) : undefined;
      await fetch(`/api/cards/${cardId}/session/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, good, delayed, defect, identifiers })
      });
      await fetchState();
      render();
    };
  });
}

function renderMaster(container) {
  const section = document.createElement('div');
  section.className = 'section';
  section.innerHTML = '<h3>Управление gate и назначениями</h3>';
  section.innerHTML += state.routeCards.map(card => {
    const ops = card.operations.map(op => {
      const open = card.gate && card.gate[op.id];
      const assigned = (card.assignments||{})[op.id] || [];
      return `<div class="section">${op.name}
        <div>Gate: <button class="gate" data-card="${card.id}" data-op="${op.id}" data-open="${!open}">${open?'Закрыть':'Открыть'}</button></div>
        <label>Назначить исполнителей (через запятую)
          <input class="assign" data-card="${card.id}" data-op="${op.id}" value="${assigned.join(',')}">
        </label>
        <button class="assign-btn" data-card="${card.id}" data-op="${op.id}">Сохранить назначения</button>
      </div>`;
    }).join('');
    const delayed = (card.delayed||[]).map(d=>`<div>Деталь ${d.detailId} на ${d.operationId}</div>`).join('') || 'Нет';
    const isolation = (state.isolation||[]).filter(i=>i.cardId===card.id && i.status==='pending').map(i=>`<div>Брак case ${i.id} по детали ${i.detailId}</div>`).join('') || 'Нет';
    return `<div class="section"><h4>${card.number}</h4><div class="flex">${ops}</div><div class="notice">Задержки: ${delayed}</div><div class="notice">Брак: ${isolation}</div></div>`;
  }).join('');
  container.appendChild(section);
  section.querySelectorAll('.gate').forEach(btn => {
    btn.onclick = async () => {
      await fetch(`/api/cards/${btn.dataset.card}/gate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operationId: btn.dataset.op, open: btn.dataset.open === 'true' })
      });
      await fetchState(); render();
    };
  });
  section.querySelectorAll('.assign-btn').forEach(btn => {
    btn.onclick = async () => {
      const input = section.querySelector(`.assign[data-card="${btn.dataset.card}"][data-op="${btn.dataset.op}"]`);
      const executors = input.value.split(',').map(s=>s.trim()).filter(Boolean);
      await fetch(`/api/cards/${btn.dataset.card}/assign`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operationId: btn.dataset.op, executors })
      });
      await fetchState(); render();
    };
  });
}

function renderQuality(container) {
  const controlOps = state.routeCards.flatMap(card => card.operations.map((op,idx)=>({card, op, idx})).filter(o=>o.op.isControl));
  const control = document.createElement('div');
  control.className = 'section';
  control.innerHTML = '<h3>Контрольные операции</h3>' + controlOps.map(item => `<div class="section"><strong>${item.card.number}</strong> — ${item.op.name}</div>`).join('') || '<p>Нет контрольных операций</p>';
  container.appendChild(control);

  const delayedBlock = document.createElement('div');
  delayedBlock.className = 'section';
  delayedBlock.innerHTML = '<h3>Задержанные</h3>' + state.routeCards.flatMap(card => (card.delayed||[]).map(d=>({card,d}))).map(({card,d})=>{
    return `<div class="section">${card.number}: деталь ${d.detailId} на ${d.operationId}
      <button class="delay-action" data-card="${card.id}" data-detail="${d.detailId}" data-decision="continue">Продолжить</button>
      <button class="delay-action" data-card="${card.id}" data-detail="${d.detailId}" data-decision="defect">Признать браком</button>
    </div>`;
  }).join('') || '<p>Нет задержанных</p>';
  container.appendChild(delayedBlock);

  delayedBlock.querySelectorAll('.delay-action').forEach(btn => {
    btn.onclick = async () => {
      await fetch(`/api/cards/${btn.dataset.card}/delayed/resolve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ detailId: btn.dataset.detail, decision: btn.dataset.decision })
      });
      await fetchState(); render();
    };
  });

  const iso = document.createElement('div');
  iso.className = 'section';
  iso.innerHTML = '<h3>Изолятор брака</h3>' + (state.isolation||[]).filter(i=>i.status==='pending').map(i=>{
    return `<div class="section">Case ${i.id} (МК ${i.cardId}, деталь ${i.detailId})
      <button class="iso" data-case="${i.id}" data-decision="final">Окончательный брак</button>
      <button class="iso" data-case="${i.id}" data-decision="rework">Переделка</button>
    </div>`;
  }).join('') || '<p>Изолятор пуст</p>';
  container.appendChild(iso);
  iso.querySelectorAll('.iso').forEach(btn => {
    btn.onclick = async () => {
      await fetch(`/api/isolation/${btn.dataset.case}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: btn.dataset.decision })
      });
      await fetchState(); render();
    };
  });
}

function renderApproval(container) {
  const waiting = state.routeCards.filter(c => c.status === 'draft');
  container.innerHTML = '<div class="section"><h3>Очередь согласования</h3>' + waiting.map(card => {
    const ops = card.operations.map((o,i)=>`${i+1}. ${o.name}`).join('<br>');
    return `<div class="section"><strong>${card.number}</strong><div>${ops}</div>
      <button class="approve" data-card="${card.id}" data-decision="approved">Согласовать</button>
      <button class="approve" data-card="${card.id}" data-decision="rejected">Отклонить</button></div>`;
  }).join('') + '</div>';
  container.querySelectorAll('.approve').forEach(btn => {
    btn.onclick = async () => {
      await fetch(`/api/cards/${btn.dataset.card}/approve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: mapApprovalRole(currentRole), decision: btn.dataset.decision, comment: '' })
      });
      await fetchState(); render();
    };
  });
}

function mapApprovalRole(role) {
  if (role === 'ЗГД по технологиям') return 'techLead';
  if (role === 'ЗГД по качеству') return 'qualityLead';
  return 'productionHead';
}

function renderPlan(container) {
  const block = document.createElement('div');
  block.className = 'section';
  const total = state.routeCards.length;
  const defect = (state.isolation||[]).length;
  block.innerHTML = `<h3>План/отчёты</h3><div>Всего МК: ${total}</div><div>Кейсов брака: ${defect}</div>`;
  container.appendChild(block);
}

function renderArchive(container) {
  const finished = state.routeCards.filter(c => c.details.every(d => ['done','defect_final','moved_to_rework'].includes(d.state)));
  container.innerHTML = '<div class="section"><h3>Архив</h3>' + finished.map(summaryCard).join('') + '</div>';
}

function render() {
  setupRoleControls();
  renderTabs();
  const content = qs('#content');
  content.innerHTML = '';
  switch (currentTab) {
    case 'dashboard':
      renderDashboard(content); break;
    case 'mk':
      renderMk(content); break;
    case 'tracker':
      renderTracker(content); break;
    case 'workspace':
      renderWorkspace(content); break;
    case 'master':
      renderMaster(content); break;
    case 'quality':
      renderQuality(content); break;
    case 'approval':
      renderApproval(content); break;
    case 'plan':
      renderPlan(content); break;
    case 'archive':
      renderArchive(content); break;
    default:
      content.innerHTML = '<p>Нет доступных вкладок</p>';
  }
}

async function init() {
  setupRoleControls();
  await fetchState();
  renderTabs();
  render();
}

if (!currentRole) {
  showRoleModal();
} else {
  init();
}
