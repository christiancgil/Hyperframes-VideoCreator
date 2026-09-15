import http from 'http';
import { spawn } from 'child_process';
import fs from 'fs';

const PORT = 4000;
const BASE = '/opt/hyperframes';

function getStatus(project) {
  const f = `${BASE}/projects/${project}/status.json`;
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); }
  catch { return null; }
}

function setStatus(project, data) {
  fs.mkdirSync(`${BASE}/projects/${project}`, { recursive: true });
  const current = getStatus(project) || {};
  fs.writeFileSync(
    `${BASE}/projects/${project}/status.json`,
    JSON.stringify({ ...current, ...data, updated_at: new Date().toISOString() }, null, 2)
  );
}

function runBackground(script, args, project) {
  fs.mkdirSync(`${BASE}/projects/${project}`, { recursive: true });
  const logFile = `${BASE}/projects/${project}/pipeline.log`;
  const out = fs.openSync(logFile, 'a');
  const proc = spawn('bash', [script, ...args], {
    detached: true,
    stdio: ['ignore', out, out]
  });
  proc.unref();
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch(e) { reject(e); } });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  const url = new URL(req.url, `http://localhost`);
  const parts = url.pathname.split('/').filter(Boolean);

  try {
    // POST /start — inicia pipeline completo
    if (req.method === 'POST' && url.pathname === '/start') {
      const { client_name, project, callback_url, style } = await parseBody(req);
      if (!client_name || !project) {
        res.writeHead(400);
        return res.end(JSON.stringify({ error: 'client_name y project son obligatorios' }));
      }

      const existing = getStatus(project);
      if (existing?.status === 'running') {
        res.writeHead(409);
        return res.end(JSON.stringify({ error: 'Pipeline ya en ejecución para este proyecto' }));
      }

      setStatus(project, { status: 'queued', client_name, callback_url, style: style || 'default' });
      runBackground(
        `${BASE}/scripts/run-pipeline.sh`,
        [client_name, project, callback_url || '', style || 'default'],
        project
      );

      res.writeHead(202);
      return res.end(JSON.stringify({ status: 'started', project }));
    }

    // GET /status/:project
    if (req.method === 'GET' && parts[0] === 'status' && parts[1]) {
      const status = getStatus(parts[1]);
      if (!status) { res.writeHead(404); return res.end(JSON.stringify({ error: 'Proyecto no encontrado' })); }
      res.writeHead(200);
      return res.end(JSON.stringify(status));
    }

    // GET /log/:project — últimas 50 líneas del log
    if (req.method === 'GET' && parts[0] === 'log' && parts[1]) {
      const logFile = `${BASE}/projects/${parts[1]}/pipeline.log`;
      if (!fs.existsSync(logFile)) { res.writeHead(404); return res.end(JSON.stringify({ error: 'Log no encontrado' })); }
      const lines = fs.readFileSync(logFile, 'utf8').split('\n').slice(-50).join('\n');
      res.writeHead(200);
      return res.end(JSON.stringify({ log: lines }));
    }

    // POST /correct/:project — aplica corrección y re-renderiza
    if (req.method === 'POST' && parts[0] === 'correct' && parts[1]) {
      const project = parts[1];
      const { correction, callback_url } = await parseBody(req);
      if (!correction) { res.writeHead(400); return res.end(JSON.stringify({ error: 'correction es obligatorio' })); }

      const current = getStatus(project);
      if (!current) { res.writeHead(404); return res.end(JSON.stringify({ error: 'Proyecto no encontrado' })); }

      const cb = callback_url || current.callback_url || '';
      setStatus(project, { status: 'correcting', correction });
      runBackground(
        `${BASE}/scripts/apply-correction.sh`,
        [project, correction, cb],
        project
      );

      res.writeHead(202);
      return res.end(JSON.stringify({ status: 'correcting', project }));
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Endpoint no encontrado' }));

  } catch (err) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Pipeline API corriendo en puerto ${PORT}`);
});
