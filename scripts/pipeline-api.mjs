import http from 'http';
import https from 'https';
import { execSync, spawn } from 'child_process';
import fs from 'fs';

const PORT = 4000;
const BASE = '/opt/hyperframes';

// ── Cargar .env ──────────────────────────────────────────────────────────────
const envPath = `${BASE}/.env`;
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([^#=]+?)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const TELEGRAM_TOKEN   = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID   || '';

// ── Telegram ─────────────────────────────────────────────────────────────────
function sendTelegram(text) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) return;
  const body = JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'HTML' });
  const req = https.request({
    hostname: 'api.telegram.org',
    path: `/bot${TELEGRAM_TOKEN}/sendMessage`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  });
  req.on('error', () => {}); // silencioso — no queremos que un fallo de Telegram rompa la API
  req.write(body);
  req.end();
}

function notifyError(project, phase, errorMsg) {
  const short = String(errorMsg).slice(0, 400);
  const ts = new Date().toLocaleTimeString('es-ES', { timeZone: 'America/Bogota', hour12: false });
  sendTelegram(
    `❌ <b>Error en pipeline</b>\n` +
    `📁 Proyecto: <code>${project}</code>\n` +
    `🔧 Fase: <b>${phase}</b>\n` +
    `⏰ Hora: ${ts}\n\n` +
    `<pre>${short}</pre>`
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
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

function runSync(script, args, project, timeoutMs = 600000) {
  fs.mkdirSync(`${BASE}/projects/${project}`, { recursive: true });
  const logFile = `${BASE}/projects/${project}/pipeline.log`;
  try {
    const output = execSync(`bash ${script} ${args.map(a => `"${a}"`).join(' ')}`, {
      timeout: timeoutMs,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    fs.appendFileSync(logFile, output);
    return { ok: true, output };
  } catch (err) {
    const errMsg = err.stderr || err.stdout || err.message;
    fs.appendFileSync(logFile, `\nERROR: ${errMsg}\n`);
    return { ok: false, error: String(errMsg) };
  }
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch(e) { reject(e); } });
    req.on('error', reject);
  });
}

function json(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// Unifica: guarda estado de error + notifica Telegram + responde HTTP 500
function fail(res, project, phase, errorMsg) {
  setStatus(project, { status: 'error', phase, error: String(errorMsg).slice(0, 500) });
  notifyError(project, phase, errorMsg);
  return json(res, 500, { error: errorMsg });
}

// ── Servidor ──────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const parts = url.pathname.split('/').filter(Boolean);

  try {
    // ── GET /status/:project ─────────────────────────────────────────────────
    if (req.method === 'GET' && parts[0] === 'status' && parts[1]) {
      const s = getStatus(parts[1]);
      return s ? json(res, 200, s) : json(res, 404, { error: 'Proyecto no encontrado' });
    }

    // ── GET /log/:project ────────────────────────────────────────────────────
    if (req.method === 'GET' && parts[0] === 'log' && parts[1]) {
      const logFile = `${BASE}/projects/${parts[1]}/pipeline.log`;
      if (!fs.existsSync(logFile)) return json(res, 404, { error: 'Log no encontrado' });
      const lines = fs.readFileSync(logFile, 'utf8').split('\n').slice(-80).join('\n');
      return json(res, 200, { log: lines });
    }

    if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
    const body = await parseBody(req);
    const { project } = body;
    if (!project) return json(res, 400, { error: 'project es obligatorio' });

    // ── POST /init ───────────────────────────────────────────────────────────
    if (url.pathname === '/init') {
      const { client_name, style } = body;
      if (!client_name) return json(res, 400, { error: 'client_name es obligatorio' });

      fs.mkdirSync(`${BASE}/projects/${project}`, { recursive: true });
      fs.mkdirSync(`${BASE}/input`, { recursive: true });
      fs.mkdirSync(`${BASE}/output/compositions`, { recursive: true });

      const styleFile = fs.existsSync(`${BASE}/styles/client-style-${style}.md`)
        ? `${BASE}/styles/client-style-${style}.md`
        : `${BASE}/styles/client-style.md`;

      const styles = {
        client_style:      fs.existsSync(styleFile) ? fs.readFileSync(styleFile, 'utf8') : '',
        motion_philosophy: fs.existsSync(`${BASE}/styles/motion-philosophy.md`) ? fs.readFileSync(`${BASE}/styles/motion-philosophy.md`, 'utf8') : '',
        triggers:          fs.existsSync(`${BASE}/styles/triggers.md`) ? fs.readFileSync(`${BASE}/styles/triggers.md`, 'utf8') : '',
        effects_catalog:   fs.existsSync(`${BASE}/styles/effects-catalog.md`) ? fs.readFileSync(`${BASE}/styles/effects-catalog.md`, 'utf8') : '',
        aspect_ratios:     fs.existsSync(`${BASE}/styles/aspect-ratios.md`) ? fs.readFileSync(`${BASE}/styles/aspect-ratios.md`, 'utf8') : '',
      };

      setStatus(project, { status: 'initialized', client_name, style: style || 'default' });
      return json(res, 200, { ok: true, project, styles });
    }

    // ── POST /download ───────────────────────────────────────────────────────
    if (url.pathname === '/download') {
      const { client_name } = body;
      if (!client_name) return json(res, 400, { error: 'client_name es obligatorio' });

      setStatus(project, { status: 'downloading', phase: 'download' });
      const result = runSync(`${BASE}/scripts/phase-download.sh`, [client_name, project], project, 300000);
      if (!result.ok) return fail(res, project, 'download', result.error);

      const info = getStatus(project);
      const scriptPath = `${BASE}/projects/${project}/script.json`;
      const script = fs.existsSync(scriptPath)
        ? JSON.parse(fs.readFileSync(scriptPath, 'utf8'))
        : null;

      return json(res, 200, { ok: true, ...info, script });
    }

    // ── POST /transcribe ─────────────────────────────────────────────────────
    if (url.pathname === '/transcribe') {
      setStatus(project, { status: 'transcribing', phase: 'transcribe' });
      const result = runSync(`${BASE}/scripts/phase-transcribe.sh`, [project], project, 600000);
      if (!result.ok) return fail(res, project, 'transcribe', result.error);

      const transcriptPath = `${BASE}/projects/${project}/transcript.json`;
      if (!fs.existsSync(transcriptPath)) return fail(res, project, 'transcribe', 'Transcript no generado');

      const transcript = JSON.parse(fs.readFileSync(transcriptPath, 'utf8'));
      setStatus(project, { status: 'transcribed' });
      return json(res, 200, {
        ok: true,
        text: transcript.text || '',
        duration: transcript.duration || 0,
        segments: transcript.segments || [],
        words: transcript.words || []
      });
    }

    // ── POST /cut ────────────────────────────────────────────────────────────
    if (url.pathname === '/cut') {
      setStatus(project, { status: 'cutting', phase: 'cut' });
      const result = runSync(`${BASE}/scripts/phase-cut.sh`, [project], project, 300000);
      if (!result.ok) return fail(res, project, 'cut', result.error);

      setStatus(project, { status: 'cut_done' });
      return json(res, 200, { ok: true, edited_video: `${BASE}/output/${project}_edited.mp4` });
    }

    // ── POST /html ───────────────────────────────────────────────────────────
    if (url.pathname === '/html') {
      const { beats, video_w, video_h, fps } = body;
      if (!beats || !Array.isArray(beats)) return json(res, 400, { error: 'beats[] es obligatorio' });

      setStatus(project, { status: 'generating_html', phase: 'html' });

      fs.writeFileSync(
        `${BASE}/projects/${project}/beats.json`,
        JSON.stringify({ beats, video_w, video_h, fps }, null, 2)
      );

      const result = runSync(`${BASE}/scripts/phase-generate-html.sh`, [project], project, 120000);
      if (!result.ok) return fail(res, project, 'html', result.error);

      const compDir = `${BASE}/output/compositions/${project}/compositions`;
      const htmlFiles = fs.existsSync(compDir)
        ? fs.readdirSync(compDir).filter(f => f.endsWith('.html'))
        : [];

      setStatus(project, { status: 'html_ready' });
      return json(res, 200, { ok: true, html_files: htmlFiles, count: htmlFiles.length });
    }

    // ── POST /render ─────────────────────────────────────────────────────────
    if (url.pathname === '/render') {
      setStatus(project, { status: 'rendering', phase: 'render' });
      const result = runSync(`${BASE}/scripts/phase-render.sh`, [project], project, 600000);
      if (!result.ok) return fail(res, project, 'render', result.error);

      const previews = [1, 2, 3].map(n => {
        const f = `${BASE}/projects/${project}/preview_${n}.png`;
        return fs.existsSync(f) ? fs.readFileSync(f).toString('base64') : null;
      }).filter(Boolean);

      setStatus(project, { status: 'rendered' });
      return json(res, 200, {
        ok: true,
        final_video: `${BASE}/output/${project}_final.mp4`,
        preview_frames: previews
      });
    }

    // ── POST /upload ─────────────────────────────────────────────────────────
    if (url.pathname === '/upload') {
      const { client_name } = body;
      if (!client_name) return json(res, 400, { error: 'client_name es obligatorio' });

      setStatus(project, { status: 'uploading', phase: 'upload' });
      const result = runSync(`${BASE}/scripts/phase-upload.sh`, [client_name, project], project, 120000);
      if (!result.ok) return fail(res, project, 'upload', result.error);

      const driveUrl = `hf:${client_name}/Output/${project}_final.mp4`;
      setStatus(project, { status: 'done', drive_output: driveUrl });
      return json(res, 200, { ok: true, drive_output: driveUrl });
    }

    // ── POST /correct ─────────────────────────────────────────────────────────
    if (url.pathname === '/correct') {
      const { beats, video_w, video_h, fps, correction_note } = body;
      if (!beats || !Array.isArray(beats)) return json(res, 400, { error: 'beats[] es obligatorio' });

      setStatus(project, { status: 'correcting', correction_note });

      fs.writeFileSync(
        `${BASE}/projects/${project}/beats.json`,
        JSON.stringify({ beats, video_w, video_h, fps }, null, 2)
      );

      const htmlResult = runSync(`${BASE}/scripts/phase-generate-html.sh`, [project], project, 120000);
      if (!htmlResult.ok) return fail(res, project, 'correct/html', htmlResult.error);

      const renderResult = runSync(`${BASE}/scripts/phase-render.sh`, [project], project, 600000);
      if (!renderResult.ok) return fail(res, project, 'correct/render', renderResult.error);

      const previews = [1, 2, 3].map(n => {
        const f = `${BASE}/projects/${project}/preview_${n}.png`;
        return fs.existsSync(f) ? fs.readFileSync(f).toString('base64') : null;
      }).filter(Boolean);

      setStatus(project, { status: 'rendered', correction_applied: correction_note });
      return json(res, 200, { ok: true, preview_frames: previews });
    }

    json(res, 404, { error: 'Endpoint no encontrado' });

  } catch (err) {
    // Error inesperado (excepción no capturada en el handler)
    const project = req._parsedBody?.project || 'desconocido';
    const phase = url?.pathname?.replace('/', '') || 'api';
    notifyError(project, phase, err.message);
    json(res, 500, { error: err.message });
  }
});

// Guardar body parseado para acceso en el catch global
server.on('request', (req) => { req._parsedBody = null; });

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Pipeline API v2 corriendo en puerto ${PORT}`);
  if (!TELEGRAM_TOKEN) console.warn('AVISO: TELEGRAM_BOT_TOKEN no configurado — las notificaciones de error están desactivadas');
});
