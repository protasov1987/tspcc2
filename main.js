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

function createId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2, 10);
}

function code128Svg(text) {
  const chars = [
    ' ', '!', '"', '#', '$', '%', '&', "'", '(', ')', '*', '+', ',', '-', '.', '/',
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', ':', ';', '<', '=', '>', '?',
    '@', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O',
    'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '[', '\\', ']', '^', '_',
    '`', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o',
    'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '{', '|', '}', '~', '\x7f'
  ];
  const patterns = [
    '11011001100','11001101100','11001100110','10010011000','10010001100','10001001100','10011001000','10011000100','10001100100','11001001000',
    '11001000100','11000100100','10110011100','10011011100','10011001110','10111001100','10011101100','10011100110','11001110010','11001011100',
    '11001001110','11011100100','11001110100','11101101110','11101001100','11100101100','11100100110','11101100100','11100110100','11100110010',
    '11011011000','11011000110','11000110110','10100011000','10001011000','10001000110','10110001000','10001101000','10001001010','11010001000',
    '11000101000','11000100010','10110111000','10110001110','10001101110','10111011000','10111000110','10001110110','11101110110','11010001110',
    '11000101110','11011101000','11011100010','11011101110','11101011000','11101000110','11100010110','11101101000','11101100010','11100011010',
    '11101111010','11001000010','11110001010','10100110000','10100001100','10010110000','10010000110','10000101100','10000100110','10110010000',
    '10110000100','10011010000','10011000010','10000110100','10000110010','11000010010','11001010000','11110111010','11000010100','10001111010','10100111100',
    '10010111100','10010011110','10111100100','10011110100','10011110010','11110100100','11110010100','11110010010','11011011110','11011110110','11110110110',
    '10101111000','10100011110','10001011110','10111101000','10111100010','11110101000','11110100010','10111011110','10111101110','11101011110',
    '11110101110','11010000100','11010010000','11010011100','1100011101011'
  ];
  const start = 104; const stop = 106;
  const values = [start];
  for (const ch of text) {
    const idx = chars.indexOf(ch);
    if (idx === -1) throw new Error('Недопустимый символ для Code128B');
    values.push(idx);
  }
  let checksum = start;
  for (let i = 1; i < values.length; i++) checksum += values[i] * i;
  checksum %= 103;
  values.push(checksum); values.push(stop);
  const pattern = values.map(v => patterns[v]).join('');
  const barWidth = 2; const height = 80;
  let x = 10; let svg = '';
  for (const bit of pattern) { if (bit === '1') svg += `<rect x="${x}" y="10" width="${barWidth}" height="${height}" fill="black" />`; x += barWidth; }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${x + 10}" height="110">${svg}<text x="10" y="105" font-family="monospace" font-size="12">${text}</text></svg>`;
}

class LocalStore {
  constructor() {
    this.state = this.load();
  }

  load() {
    const raw = localStorage.getItem('mes-state');
    if (raw) return JSON.parse(raw);
    const sample = {
      routeCards: [],
      isolation: [],
    };
    localStorage.setItem('mes-state', JSON.stringify(sample));
    return sample;
  }

  save() {
    localStorage.setItem('mes-state', JSON.stringify(this.state));
  }

  log(card, message) {
    card.logs = card.logs || [];
    card.logs.unshift({ id: createId(), ts: new Date().toISOString(), message });
  }

  createCard(payload) {
    const id = createId();
    const details = Array.from({ length: payload.batchSize || 0 }).map(() => ({
      internalId: createId(),
      identifier: null,
      state: 'awaiting',
      operationIndex: 0,
    }));
    const card = {
      id,
      number: payload.number,
      product: payload.product,
      order: payload.order,
      note: payload.note,
      author: payload.author,
      status: 'draft',
      approvals: { techLead: null, qualityLead: null, productionHead: null },
      operations: payload.operations,
      batchSize: payload.batchSize,
      createdAt: new Date().toISOString(),
      details,
      gate: {},
      assignments: {},
      sessions: [],
      delayed: [],
      logs: [],
      links: {},
    };
    this.log(card, 'Создана МК');
    this.state.routeCards.push(card);
    this.save();
  }

  findCard(cardId) { return this.state.routeCards.find(c => c.id === cardId); }

  toggleGate(cardId, opId, open) {
    const card = this.findCard(cardId);
    card.gate = card.gate || {};
    card.gate[opId] = open;
    this.log(card, `${open ? 'Открыт' : 'Закрыт'} gate на операции ${opId}`);
    this.save();
  }

  setAssignments(cardId, opId, executors) {
    const card = this.findCard(cardId);
    card.assignments = card.assignments || {};
    card.assignments[opId] = executors;
    this.log(card, `Назначены исполнители ${executors.join(', ') || '—'} на ${opId}`);
    this.save();
  }

  startSession(cardId, opId, executor, count) {
    const card = this.findCard(cardId);
    const opIndex = card.operations.findIndex(o => o.id === opId);
    if (opIndex === -1) throw new Error('Операция не найдена');
    const gateOpen = card.gate?.[opId];
    const assigned = (card.assignments?.[opId] || []).includes(executor);
    if (!gateOpen || !assigned) throw new Error('Gate закрыт или исполнитель не назначен');
    const free = card.details.filter(d => d.operationIndex === opIndex && d.state === 'awaiting').slice(0, count);
    if (free.length !== count) throw new Error('Недостаточно деталей');
    const session = { id: createId(), opId, opIndex, executor, detailIds: free.map(d => d.internalId), startedAt: new Date().toISOString() };
    card.sessions.push(session);
    free.forEach(d => (d.state = 'in_work'));
    this.log(card, `Старт сессии ${session.id} на ${opId} исполнителем ${executor}`);
    this.save();
  }

  finishSession(cardId, sessionId, { good, delayed, defect, identifiers }) {
    const card = this.findCard(cardId);
    const session = card.sessions.find(s => s.id === sessionId);
    if (!session) throw new Error('Сессия не найдена');
    const total = session.detailIds.length;
    if (good + delayed + defect !== total) throw new Error('Сумма не равна N');
    const op = card.operations[session.opIndex];
    const details = session.detailIds.map(id => card.details.find(d => d.internalId === id));
    if (op.isIdentification && good > 0) {
      if (!identifiers || identifiers.length !== good) throw new Error('Требуются идентификаторы');
      const existing = new Set(card.details.map(d => d.identifier).filter(Boolean));
      for (const id of identifiers) if (existing.has(id)) throw new Error('Дубликат идентификатора');
    }
    let idxGood = 0;
    details.forEach((d, i) => {
      if (i < good) {
        d.state = 'awaiting';
        d.operationIndex += 1;
        if (op.isIdentification) { d.identifier = identifiers[idxGood]; idxGood += 1; }
        if (d.operationIndex >= card.operations.length) d.state = 'done';
      } else if (i < good + delayed) {
        d.state = 'delayed';
        const existing = card.delayed || [];
        existing.push({ detailId: d.internalId, operationId: op.id });
        card.delayed = existing;
      } else {
        d.state = 'defect_isolation';
        this.state.isolation.push({ id: createId(), cardId: card.id, detailId: d.internalId, status: 'pending' });
      }
    });
    card.sessions = card.sessions.filter(s => s.id !== sessionId);
    this.log(card, `Завершена сессия ${sessionId}: good ${good}, delayed ${delayed}, defect ${defect}`);
    this.save();
  }

  resolveDelayed(cardId, detailId, decision) {
    const card = this.findCard(cardId);
    card.delayed = (card.delayed || []).filter(d => !(d.detailId === detailId));
    const detail = card.details.find(d => d.internalId === detailId);
    if (!detail) return;
    if (decision === 'continue') {
      detail.state = 'awaiting';
      detail.operationIndex += 1;
      if (detail.operationIndex >= card.operations.length) detail.state = 'done';
    } else {
      detail.state = 'defect_isolation';
      this.state.isolation.push({ id: createId(), cardId: card.id, detailId: detail.internalId, status: 'pending' });
    }
    this.log(card, `Решение по задержке: ${decision}`);
    this.save();
  }

  isolationDecision(caseId, decision) {
    const iso = this.state.isolation.find(i => i.id === caseId);
    if (!iso) return;
    const card = this.findCard(iso.cardId);
    const detail = card?.details.find(d => d.internalId === iso.detailId);
    if (!detail) return;
    if (decision === 'final') {
      iso.status = 'final';
      detail.state = 'defect_final';
    } else {
      iso.status = 'rework';
      detail.state = 'moved_to_rework';
      this.createReworkCard(card, detail);
    }
    this.log(card, `Решение по браку ${decision}`);
    this.save();
  }

  createReworkCard(sourceCard, detail) {
    const newCard = {
      id: createId(),
      number: `${sourceCard.number}-R-${Math.floor(Math.random() * 1000)}`,
      product: `${sourceCard.product} (переделка)`,
      order: sourceCard.order,
      note: `Переделка детали ${detail.identifier || detail.internalId}`,
      author: 'system',
      status: 'draft',
      approvals: { techLead: null, qualityLead: null, productionHead: null },
      operations: sourceCard.operations.map(op => ({ ...op })),
      batchSize: 1,
      createdAt: new Date().toISOString(),
      details: [{ internalId: createId(), identifier: detail.identifier, state: 'awaiting', operationIndex: 0 }],
      gate: {}, assignments: {}, sessions: [], delayed: [], logs: [], links: { fromDefect: sourceCard.id },
    };
    this.log(newCard, 'Создана МК переделки');
    this.state.routeCards.push(newCard);
  }

  approve(cardId, role, decision) {
    const card = this.findCard(cardId);
    const map = { techLead: 'ЗГД по технологиям', qualityLead: 'ЗГД по качеству', productionHead: 'Начальник производства' };
    card.approvals[role] = { decision, by: map[role], ts: new Date().toISOString() };
    if (Object.values(card.approvals).every(v => v?.decision === 'approved')) card.status = 'approved';
    if (decision === 'rejected') card.status = 'rejected';
    this.log(card, `Согласование ${role}: ${decision}`);
    this.save();
  }
}

const store = new LocalStore();
let state = store.state;
let currentRole = localStorage.getItem('role');
let currentTab = null;

function qs(sel) { return document.querySelector(sel); }

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

function fetchState() {
  state = store.state;
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

function openPrint(card) {
  const win = window.open('', '_blank');
  const svg = code128Svg(card.number);
  const ops = card.operations.map((o, i) => `${i + 1}. ${o.name}${o.isControl ? ' (контроль)' : ''}${o.isIdentification ? ' (ID)' : ''}`).join('<br>');
  win.document.write(`<html><head><title>Печать МК ${card.number}</title></head><body>${svg}<h2>${card.number}</h2><div>${card.product}</div><div>Партия: ${card.batchSize}</div><div>${ops}</div></body></html>`);
  win.document.close();
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
    <button class="print" data-card="${card.id}">Печать</button>
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
  container.querySelectorAll('.print').forEach(btn => btn.onclick = () => openPrint(state.routeCards.find(c=>c.id===btn.dataset.card)));
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
    <label>Операции (по одной на строке, *К для контроля, *ID для идентификации)</label>
    <textarea id="mk-ops" rows="5">Входной контроль*ID\nОперация 2\nСКК*К\nСборка</textarea>
    <button id="mk-create">Создать</button>`;
  container.appendChild(form);
  qs('#mk-create').onclick = () => {
    const opsRaw = qs('#mk-ops').value.split('\n').filter(Boolean);
    const operations = opsRaw.map((name, idx) => ({ id: `op${idx+1}`, name: name.replace('*К','').replace('*K','').replace('*ID',''), isControl: name.includes('*К') || name.includes('*K'), isIdentification: name.includes('*ID') }));
    store.createCard({
      number: qs('#mk-number').value,
      product: qs('#mk-product').value,
      batchSize: Number(qs('#mk-batch').value),
      order: qs('#mk-order').value,
      note: qs('#mk-note').value,
      author: currentRole,
      operations,
    });
    fetchState();
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
      </div><button class="print" data-card="${card.id}">Печать</button></div>`;
  }).join('');
  container.appendChild(list);
  list.querySelectorAll('.print').forEach(btn => btn.onclick = () => openPrint(state.routeCards.find(c=>c.id===btn.dataset.card)));
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
    btn.onclick = () => {
      const opId = btn.dataset.op;
      const cardId = btn.dataset.card;
      const input = section.querySelector(`input[data-card="${cardId}"][data-op="${opId}"]`);
      try {
        store.startSession(cardId, opId, currentRole, Number(input.value));
        fetchState(); render();
      } catch (e) { alert(e.message); }
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
    btn.onclick = () => {
      const sessionId = btn.dataset.session;
      const cardId = btn.dataset.card;
      const good = Number(active.querySelector(`.good[data-session="${sessionId}"]`).value);
      const delayed = Number(active.querySelector(`.delayed[data-session="${sessionId}"]`).value);
      const defect = Number(active.querySelector(`.defect[data-session="${sessionId}"]`).value);
      const identInput = active.querySelector(`.idents[data-session="${sessionId}"]`);
      const identifiers = identInput ? identInput.value.split(',').map(s=>s.trim()).filter(Boolean) : undefined;
      try {
        store.finishSession(cardId, sessionId, { good, delayed, defect, identifiers });
        fetchState(); render();
      } catch (e) { alert(e.message); }
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
    btn.onclick = () => { store.toggleGate(btn.dataset.card, btn.dataset.op, btn.dataset.open === 'true'); fetchState(); render(); };
  });
  section.querySelectorAll('.assign-btn').forEach(btn => {
    btn.onclick = () => {
      const input = section.querySelector(`.assign[data-card="${btn.dataset.card}"][data-op="${btn.dataset.op}"]`);
      const executors = input.value.split(',').map(s=>s.trim()).filter(Boolean);
      store.setAssignments(btn.dataset.card, btn.dataset.op, executors);
      fetchState(); render();
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
    btn.onclick = () => { store.resolveDelayed(btn.dataset.card, btn.dataset.detail, btn.dataset.decision); fetchState(); render(); };
  });

  const iso = document.createElement('div');
  iso.className = 'section';
  iso.innerHTML = '<h3>Изолятор брака</h3>' + (state.isolation||[]).filter(i=>i.status==='pending').map(i=>{
    return `<div class="section">Case ${i.id} (МК ${i.cardId}, деталь ${i.detailId})
      <button class="iso" data-case="${i.id}" data-decision="final">Окончательный бак</button>
      <button class="iso" data-case="${i.id}" data-decision="rework">Переделка</button>
    </div>`;
  }).join('') || '<p>Изолятор пуст</p>';
  container.appendChild(iso);
  iso.querySelectorAll('.iso').forEach(btn => {
    btn.onclick = () => { store.isolationDecision(btn.dataset.case, btn.dataset.decision); fetchState(); render(); };
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
    btn.onclick = () => {
      const role = mapApprovalRole(currentRole);
      if (!role) return alert('Нет прав на согласование');
      store.approve(btn.dataset.card, role, btn.dataset.decision);
      fetchState(); render();
    };
  });
}

function mapApprovalRole(role) {
  if (role === 'ЗГД по технологиям') return 'techLead';
  if (role === 'ЗГД по качеству') return 'qualityLead';
  if (role === 'Начальник производства') return 'productionHead';
  return null;
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
  container.querySelectorAll('.print').forEach(btn => btn.onclick = () => openPrint(state.routeCards.find(c=>c.id===btn.dataset.card)));
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

function init() {
  setupRoleControls();
  fetchState();
  renderTabs();
  render();
}

if (!currentRole) {
  showRoleModal();
} else {
  init();
}
