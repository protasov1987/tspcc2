const http = require('http');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const DATA_PATH = path.join(__dirname, 'db.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

function loadDb() {
  if (!fs.existsSync(DATA_PATH)) {
    const initial = { routeCards: [], isolation: [], logs: [] };
    fs.writeFileSync(DATA_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
  try {
    const content = fs.readFileSync(DATA_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error('Failed to load db', err);
    return { routeCards: [], isolation: [], logs: [] };
  }
}

function saveDb(db) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(db, null, 2));
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function notFound(res) {
  res.writeHead(404);
  res.end('Not found');
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
  });
}

function logEvent(card, message) {
  const entry = { id: randomUUID(), ts: new Date().toISOString(), message };
  card.logs = card.logs || [];
  card.logs.unshift(entry);
}

function findCard(db, id) {
  return db.routeCards.find(c => c.id === id);
}

function ensureIdentifiersUnique(card, ids) {
  const existing = new Set();
  card.details.forEach(d => {
    if (d.identifier) existing.add(d.identifier);
  });
  for (const val of ids) {
    if (existing.has(val)) return false;
  }
  return true;
}

function createReworkCard(db, sourceCard, detail) {
  const newId = randomUUID();
  const newCard = {
    id: newId,
    number: `${sourceCard.number}-R-${Math.floor(Math.random() * 1000)}`,
    product: `${sourceCard.product} (переделка)`,
    order: sourceCard.order,
    note: `Переделка детали ${detail.identifier || detail.internalId} из ${sourceCard.number}`,
    author: 'system',
    status: 'draft',
    approvals: { techLead: null, qualityLead: null, productionHead: null },
    operations: sourceCard.operations.map(op => ({ ...op })),
    batchSize: 1,
    createdAt: new Date().toISOString(),
    details: [
      {
        internalId: randomUUID(),
        sourceDetail: detail.internalId,
        identifier: detail.identifier,
        state: 'awaiting',
        operationIndex: 0,
      },
    ],
    gate: {},
    assignments: {},
    sessions: [],
    delayed: [],
    logs: [],
    links: { fromDefect: sourceCard.id },
  };
  logEvent(newCard, 'Создана МК переделки автоматически из изолятора брака');
  db.routeCards.push(newCard);
  logEvent(sourceCard, `Создана МК переделки ${newCard.number} для детали ${detail.identifier || detail.internalId}`);
  return newCard;
}

const code128Chars = [
  ' ', '!', '"', '#', '$', '%', '&', '\'', '(', ')', '*', '+', ',', '-', '.', '/',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', ':', ';', '<', '=', '>', '?',
  '@', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O',
  'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '[', '\\', ']', '^', '_',
  '`', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o',
  'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '{', '|', '}', '~', '\x7f'
];
const codePatterns = [
  '11011001100', '11001101100', '11001100110', '10010011000', '10010001100', '10001001100', '10011001000', '10011000100', '10001100100', '11001001000',
  '11001000100', '11000100100', '10110011100', '10011011100', '10011001110', '10111001100', '10011101100', '10011100110', '11001110010', '11001011100',
  '11001001110', '11011100100', '11001110100', '11101101110', '11101001100', '11100101100', '11100100110', '11101100100', '11100110100', '11100110010',
  '11011011000', '11011000110', '11000110110', '10100011000', '10001011000', '10001000110', '10110001000', '10001101000', '10001100010', '11010001000',
  '11000101000', '11000100010', '10110111000', '10110001110', '10001101110', '10111011000', '10111000110', '10001110110', '11101110110', '11010001110',
  '11000101110', '11011101000', '11011100010', '11011101110', '11101011000', '11101000110', '11100010110', '11101101000', '11101100010', '11100011010',
  '11101111010', '11001000010', '11110001010', '10100110000', '10100001100', '10010110000', '10010000110', '10000101100', '10000100110', '10110010000',
  '10110000100', '10011010000', '10011000010', '10000110100', '10000110010', '11000010010', '11001010000', '11110111010', '11000010100', '10001111010', '10100111100',
  '10010111100', '10010011110', '10111100100', '10011110100', '10011110010', '11110100100', '11110010100', '11110010010', '11011011110', '11011110110', '11110110110',
  '10101111000', '10100011110', '10001011110', '10111101000', '10111100010', '11110101000', '11110100010', '10111011110', '10111101110', '11101011110',
  '11110101110', '11010000100', '11010010000', '11010011100', '1100011101011'
];

function encodeCode128B(text) {
  const startCode = 104; // start B
  const stopCode = 106;
  let values = [startCode];
  for (const ch of text) {
    const idx = code128Chars.indexOf(ch);
    if (idx === -1) throw new Error('Unsupported character for Code128B');
    values.push(idx);
  }
  let checksum = startCode;
  for (let i = 1; i < values.length; i++) {
    checksum += values[i] * i;
  }
  checksum = checksum % 103;
  values.push(checksum);
  values.push(stopCode);
  const pattern = values
    .map(v => codePatterns[v])
    .join('');
  return pattern;
}

function code128Svg(text) {
  const pattern = encodeCode128B(text);
  const barWidth = 2;
  const height = 80;
  let x = 10;
  let svgBars = '';
  for (const bit of pattern) {
    if (bit === '1') {
      svgBars += `<rect x="${x}" y="10" width="${barWidth}" height="${height}" fill="black" />`;
    }
    x += barWidth;
  }
  const width = x + 10;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="110">${svgBars}<text x="10" y="105" font-family="monospace" font-size="12">${text}</text></svg>`;
}

function serveStatic(req, res) {
  let filePath = req.url === '/' ? '/index.html' : req.url;
  if (filePath.startsWith('/api/')) return false;
  if (filePath.startsWith('/print/')) return false;
  const resolved = path.join(PUBLIC_DIR, filePath.split('?')[0]);
  if (!resolved.startsWith(PUBLIC_DIR)) return false;
  if (!fs.existsSync(resolved)) return false;
  const content = fs.readFileSync(resolved);
  const ext = path.extname(resolved);
  const map = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.svg': 'image/svg+xml',
  };
  res.writeHead(200, { 'Content-Type': map[ext] || 'application/octet-stream' });
  res.end(content);
  return true;
}

function route(req, res, db) {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/state' && req.method === 'GET') {
    return sendJson(res, 200, db);
  }

  if (url.pathname === '/api/cards' && req.method === 'POST') {
    return parseBody(req)
      .then(body => {
        const id = randomUUID();
        const details = Array.from({ length: body.batchSize || 0 }).map(() => ({
          internalId: randomUUID(),
          identifier: null,
          state: 'awaiting',
          operationIndex: 0,
        }));
        const card = {
          id,
          number: body.number || `MK-${Date.now()}`,
          product: body.product || 'Изделие',
          order: body.order || '',
          note: body.note || '',
          author: body.author || 'unknown',
          status: 'draft',
          approvals: { techLead: null, qualityLead: null, productionHead: null },
          operations: body.operations || [],
          batchSize: body.batchSize || 0,
          createdAt: new Date().toISOString(),
          details,
          gate: {},
          assignments: {},
          sessions: [],
          delayed: [],
          logs: [],
          links: body.links || {},
        };
        logEvent(card, 'МК создана');
        db.routeCards.push(card);
        saveDb(db);
        sendJson(res, 200, card);
      })
      .catch(err => sendJson(res, 400, { error: err.message }));
  }

  if (url.pathname.match(/^\/api\/cards\/[^/]+$/) && req.method === 'GET') {
    const id = url.pathname.split('/')[3];
    const card = findCard(db, id);
    if (!card) return notFound(res);
    return sendJson(res, 200, card);
  }

  if (url.pathname.match(/^\/api\/cards\/[^/]+\/approve$/) && req.method === 'POST') {
    const id = url.pathname.split('/')[3];
    const card = findCard(db, id);
    if (!card) return notFound(res);
    return parseBody(req).then(body => {
      const { role, decision, comment } = body;
      if (!['techLead', 'qualityLead', 'productionHead'].includes(role)) {
        return sendJson(res, 400, { error: 'bad role' });
      }
      card.approvals[role] = { decision, comment, ts: new Date().toISOString() };
      logEvent(card, `Согласование ${role}: ${decision}` + (comment ? ` (${comment})` : ''));
      const approved = Object.values(card.approvals).every(v => v && v.decision === 'approved');
      card.status = approved ? 'approved' : card.status;
      saveDb(db);
      sendJson(res, 200, card);
    });
  }

  if (url.pathname.match(/^\/api\/cards\/[^/]+\/gate$/) && req.method === 'POST') {
    const id = url.pathname.split('/')[3];
    const card = findCard(db, id);
    if (!card) return notFound(res);
    return parseBody(req).then(body => {
      const { operationId, open } = body;
      if (!card.gate) card.gate = {};
      card.gate[operationId] = !!open;
      logEvent(card, `Gate операции ${operationId} ${open ? 'открыт' : 'закрыт'}`);
      saveDb(db);
      sendJson(res, 200, card.gate);
    });
  }

  if (url.pathname.match(/^\/api\/cards\/[^/]+\/assign$/) && req.method === 'POST') {
    const id = url.pathname.split('/')[3];
    const card = findCard(db, id);
    if (!card) return notFound(res);
    return parseBody(req).then(body => {
      const { operationId, executors } = body;
      card.assignments = card.assignments || {};
      card.assignments[operationId] = executors || [];
      logEvent(card, `Назначены исполнители на операцию ${operationId}`);
      saveDb(db);
      sendJson(res, 200, card.assignments[operationId]);
    });
  }

  if (url.pathname.match(/^\/api\/cards\/[^/]+\/session\/start$/) && req.method === 'POST') {
    const id = url.pathname.split('/')[4];
    const card = findCard(db, id);
    if (!card) return notFound(res);
    return parseBody(req).then(body => {
      const { operationId, executor, count } = body;
      const opIndex = card.operations.findIndex(o => o.id === operationId);
      if (opIndex === -1) return sendJson(res, 400, { error: 'operation not found' });
      if (!card.gate || !card.gate[operationId]) return sendJson(res, 400, { error: 'gate closed' });
      const assigned = (card.assignments && card.assignments[operationId]) || [];
      if (!assigned.includes(executor)) return sendJson(res, 400, { error: 'executor not assigned' });
      const available = card.details.filter(d => d.operationIndex === opIndex && d.state === 'awaiting');
      if (available.length < count) return sendJson(res, 400, { error: 'not enough details' });
      const details = available.slice(0, count);
      details.forEach(d => (d.state = 'in_work'));
      const sessionId = randomUUID();
      const session = { id: sessionId, executor, operationId, opIndex, detailIds: details.map(d => d.internalId), startedAt: new Date().toISOString() };
      card.sessions.push(session);
      logEvent(card, `Сессия ${sessionId} начата исполнителем ${executor} на операции ${operationId} (${count} деталей)`);
      saveDb(db);
      sendJson(res, 200, session);
    });
  }

  if (url.pathname.match(/^\/api\/cards\/[^/]+\/session\/finish$/) && req.method === 'POST') {
    const id = url.pathname.split('/')[4];
    const card = findCard(db, id);
    if (!card) return notFound(res);
    return parseBody(req).then(body => {
      const { sessionId, good, delayed, defect, identifiers } = body;
      const session = (card.sessions || []).find(s => s.id === sessionId);
      if (!session) return sendJson(res, 400, { error: 'session not found' });
      const total = (good || 0) + (delayed || 0) + (defect || 0);
      if (total !== session.detailIds.length) return sendJson(res, 400, { error: 'sum mismatch' });
      const op = card.operations[session.opIndex];
      if (op && op.isIdentification && good > 0) {
        if (!identifiers || identifiers.length !== good) {
          return sendJson(res, 400, { error: 'identifiers required' });
        }
        if (!ensureIdentifiersUnique(card, identifiers)) {
          return sendJson(res, 400, { error: 'duplicate identifiers' });
        }
      }
      const details = card.details.filter(d => session.detailIds.includes(d.internalId));
      let identIdx = 0;
      details.forEach((d, idx) => {
        if (idx < good) {
          if (op && op.isIdentification) {
            d.identifier = identifiers[identIdx++];
          }
          d.operationIndex += 1;
          d.state = d.operationIndex >= card.operations.length ? 'done' : 'awaiting';
        } else if (idx < good + delayed) {
          d.state = 'delayed';
          card.delayed.push({ detailId: d.internalId, operationId: session.operationId, ts: new Date().toISOString() });
        } else {
          d.state = 'defect_isolated';
          db.isolation = db.isolation || [];
          const caseId = randomUUID();
          db.isolation.push({ id: caseId, cardId: card.id, detailId: d.internalId, operationId: session.operationId, status: 'pending', ts: new Date().toISOString() });
          logEvent(card, `Деталь ${d.identifier || d.internalId} отправлена в изолятор брака (case ${caseId})`);
        }
      });
      logEvent(card, `Сессия ${sessionId} завершена: good=${good}, delayed=${delayed}, defect=${defect}`);
      card.sessions = card.sessions.filter(s => s.id !== sessionId);
      saveDb(db);
      sendJson(res, 200, { ok: true });
    });
  }

  if (url.pathname.match(/^\/api\/cards\/[^/]+\/delayed\/resolve$/) && req.method === 'POST') {
    const id = url.pathname.split('/')[4];
    const card = findCard(db, id);
    if (!card) return notFound(res);
    return parseBody(req).then(body => {
      const { detailId, decision } = body;
      const detail = card.details.find(d => d.internalId === detailId);
      if (!detail || detail.state !== 'delayed') return sendJson(res, 400, { error: 'detail not delayed' });
      card.delayed = (card.delayed || []).filter(d => d.detailId !== detailId);
      if (decision === 'continue') {
        detail.operationIndex += 1;
        detail.state = detail.operationIndex >= card.operations.length ? 'done' : 'awaiting';
        logEvent(card, `Решение по задержанной детали ${detail.identifier || detail.internalId}: продолжить`);
      } else if (decision === 'defect') {
        detail.state = 'defect_isolated';
        db.isolation = db.isolation || [];
        const caseId = randomUUID();
        db.isolation.push({ id: caseId, cardId: card.id, detailId: detail.internalId, operationId: card.operations[detail.operationIndex]?.id, status: 'pending', ts: new Date().toISOString() });
        logEvent(card, `Решение по задержанной детали ${detail.identifier || detail.internalId}: признать браком (case ${caseId})`);
      } else {
        return sendJson(res, 400, { error: 'unknown decision' });
      }
      saveDb(db);
      sendJson(res, 200, { ok: true });
    });
  }

  if (url.pathname.startsWith('/api/isolation/') && req.method === 'POST') {
    const caseId = url.pathname.split('/')[3];
    db.isolation = db.isolation || [];
    const item = db.isolation.find(i => i.id === caseId);
    if (!item) return notFound(res);
    const card = findCard(db, item.cardId);
    if (!card) return notFound(res);
    return parseBody(req).then(body => {
      const { decision } = body; // final / rework
      const detail = card.details.find(d => d.internalId === item.detailId);
      if (!detail) return sendJson(res, 400, { error: 'detail missing' });
      if (decision === 'final') {
        detail.state = 'defect_final';
        item.status = 'final';
        logEvent(card, `Деталь ${detail.identifier || detail.internalId} списана как окончательный брак`);
      } else if (decision === 'rework') {
        detail.state = 'moved_to_rework';
        item.status = 'rework';
        const newCard = createReworkCard(db, card, detail);
        item.reworkCardId = newCard.id;
      } else {
        return sendJson(res, 400, { error: 'bad decision' });
      }
      saveDb(db);
      sendJson(res, 200, item);
    });
  }

  if (url.pathname.startsWith('/print/code128/') && req.method === 'GET') {
    const text = decodeURIComponent(url.pathname.replace('/print/code128/', ''));
    try {
      const svg = code128Svg(text);
      res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
      res.end(svg);
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  if (url.pathname.startsWith('/print/card/') && req.method === 'GET') {
    const id = url.pathname.split('/')[3];
    const card = findCard(db, id);
    if (!card) return notFound(res);
    const svgUrl = `/print/code128/${encodeURIComponent(card.number)}`;
    const operations = card.operations
      .map((op, idx) => `<tr><td>${idx + 1}</td><td>${op.name}</td><td>${op.isControl ? 'Контроль' : ''}</td><td>${op.isIdentification ? 'ID' : ''}</td></tr>`)
      .join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>table,td,th{border:1px solid #000;border-collapse:collapse;padding:4px;}body{font-family:Arial;}</style></head><body><h2>Маршрутная карта ${card.number}</h2><p>Изделие: ${card.product}</p><p>Партия: ${card.batchSize}</p><img src="${svgUrl}"><table><tr><th>#</th><th>Операция</th><th>Контроль</th><th>Идентификация</th></tr>${operations}</table></body></html>`;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
    return;
  }

  return notFound(res);
}

const db = loadDb();

const server = http.createServer((req, res) => {
  if (serveStatic(req, res)) return;
  route(req, res, db);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
