// generate_reel2_beats.mjs — genera 8 beats para reel2_seguros
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const COMP = path.join(ROOT, 'output', 'compositions', 'reel2_seguros');
const COMP_HF = path.join(ROOT, 'skills', 'hyperframes', 'packages', 'studio', 'data', 'projects', 'reel2_seguros');

const logoB64 = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'brand', 'logo', 'logo-transparent.png')).toString('base64');

const FONTS = `<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">`;

const BASE_STYLE = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 720px; height: 1280px; background: transparent !important; overflow: hidden; font-family: 'Inter', sans-serif; }
  .scene { position: absolute; inset: 0; }
`;

const CARD_TOP = `
    position: absolute; left: 50%; transform: translateX(-50%); width: 88%; top: 16%;
    background: rgba(15,23,42,0.62); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    border: 1px solid rgba(251,146,60,0.30); border-radius: 14px; padding: 32px 30px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.5);
    animation: slideDown 0.28s cubic-bezier(0.16,1,0.3,1) forwards;
`;
const CARD_BOTTOM = `
    position: absolute; left: 50%; transform: translateX(-50%); width: 88%; bottom: 10%;
    background: rgba(15,23,42,0.62); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    border: 1px solid rgba(251,146,60,0.30); border-radius: 14px; padding: 30px 28px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.5);
    animation: slideUp 0.28s cubic-bezier(0.16,1,0.3,1) forwards;
`;
const CARD_CENTER = `
    position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%); width: 82%;
    background: rgba(15,23,42,0.72); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    border: 1px solid rgba(251,146,60,0.40); border-radius: 14px; padding: 42px 34px;
    box-shadow: 0 0 40px rgba(251,146,60,.15),0 4px 24px rgba(0,0,0,.6);
    text-align: center; animation: slamIn 0.35s cubic-bezier(.34,1.56,.64,1) forwards;
`;

const KF = `
  @keyframes slideDown { from { opacity:0; transform:translateX(-50%) translateY(-22px) scale(0.97); } to { opacity:1; transform:translateX(-50%) translateY(0) scale(1); } }
  @keyframes slideUp   { from { opacity:0; transform:translateX(-50%) translateY(24px) scale(0.97); }  to { opacity:1; transform:translateX(-50%) translateY(0) scale(1); } }
  @keyframes slamIn    { from { opacity:0; transform:translate(-50%,-50%) scale(1.10); } to { opacity:1; transform:translate(-50%,-50%) scale(1); } }
  @keyframes popIn     { from { opacity:0; transform:scale(0.78) translateX(-10px); } to { opacity:1; transform:scale(1) translateX(0); } }
  @keyframes fadeIn    { from { opacity:0; } to { opacity:1; } }
`;

function html(style, body) {
  return `<!DOCTYPE html>\n<html lang="es">\n<head>\n<meta charset="UTF-8">\n${FONTS}\n<style>${BASE_STYLE}${KF}${style}</style>\n</head>\n<body>\n<div class="scene">\n${body}\n</div>\n</body>\n</html>`;
}

// ── B01 INTRO — Hook pregunta impacto ─────────────────────────────────────
const b01 = html(`
  .card { ${CARD_TOP} }
  .tag  { font:600 17px/1 'Inter',sans-serif; letter-spacing:.12em; text-transform:uppercase; color:#fb923c; margin-bottom:14px; }
  .title{ font:700 50px/1.1 'Space Grotesk',sans-serif; color:#f8fafc; }
  .title .accent { color:#fb923c; }
  .sub  { font:500 23px/1.4 'Inter',sans-serif; color:#94a3b8; margin-top:14px; }
`, `<div class="card">
  <div class="tag">🚗 Situación de emergencia</div>
  <div class="title">Si mañana <span class="accent">chocas</span> tu carro...</div>
  <div class="sub">¿Sabes exactamente qué tienes que hacer?</div>
</div>`);

// ── B02 HIGHLIGHT — La mayoría se equivoca ─────────────────────────────────
const b02 = html(`
  .card { ${CARD_BOTTOM} border-left:3px solid #fb923c; }
  .pre  { font:600 20px/1 'Inter',sans-serif; color:#94a3b8; letter-spacing:.06em; text-transform:uppercase; margin-bottom:14px; }
  .text { font:700 42px/1.2 'Space Grotesk',sans-serif; color:#f8fafc; margin-bottom:16px; }
  .text .accent{ color:#fb923c; }
  .sub  { font:500 22px/1.5 'Inter',sans-serif; color:#94a3b8; }
  .sub em { color:#f8fafc; font-style:normal; font-weight:600; }
`, `<div class="card">
  <div class="pre">El error más común</div>
  <div class="text">Llamar a la aseguradora <span class="accent">primero</span></div>
  <div class="sub">Hay varias cosas que deberías hacer <em>antes</em></div>
</div>`);

// ── B03 STEPS — 4 pasos numerados ─────────────────────────────────────────
// Delays calibrados al timeline editado desde 12.34s:
// Paso 1: 12.34s → delay 0s
// Paso 2: 16.12s → delay 3.78s
// Paso 3: 19.98s (20.80-0.82) → delay 7.64s
// Paso 4: 23.18s (24.00-0.82) → delay 10.84s
const b03 = html(`
  .card  { ${CARD_BOTTOM} }
  .label { font:600 18px/1 'Inter',sans-serif; letter-spacing:.10em; text-transform:uppercase; color:#fb923c; margin-bottom:20px; }
  .step  { display:flex; align-items:flex-start; gap:14px; margin-bottom:16px; opacity:0; animation:popIn .25s cubic-bezier(.34,1.56,.64,1) forwards; }
  .num   { font:700 22px/1 'Space Grotesk',sans-serif; color:#0f172a; background:#fb923c; border-radius:50%; width:36px; height:36px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .txt   { font:700 28px/1.3 'Space Grotesk',sans-serif; color:#f8fafc; }
  .step:nth-child(2){ animation-delay:0s; }
  .step:nth-child(3){ animation-delay:3.78s; }
  .step:nth-child(4){ animation-delay:7.64s; }
  .step:nth-child(5){ animation-delay:10.84s; }
`, `<div class="card">
  <div class="label">Qué hacer si chocas:</div>
  <div class="step"><div class="num">1</div><div class="txt">Mantén la calma. Verifica que todos estén bien</div></div>
  <div class="step"><div class="num">2</div><div class="txt">Toma fotos y videos del lugar</div></div>
  <div class="step"><div class="num">3</div><div class="txt">No aceptes acuerdos por afán</div></div>
  <div class="step"><div class="num">4</div><div class="txt">Contacta a tu aseguradora o asesor</div></div>
</div>`);

// ── B04 BRIDGE — Nervioso en el accidente ─────────────────────────────────
const b04 = html(`
  .card { ${CARD_CENTER} }
  .emoji{ font-size:52px; margin-bottom:20px; display:block; }
  .text { font:700 40px/1.2 'Space Grotesk',sans-serif; color:#f8fafc; margin-bottom:16px; }
  .text .accent{ color:#fb923c; }
  .sub  { font:500 22px/1.5 'Inter',sans-serif; color:#94a3b8; }
`, `<div class="card">
  <span class="emoji">😰</span>
  <div class="text">En un accidente<br><span class="accent">probablemente estás nervioso</span></div>
  <div class="sub">Tener claro qué hacer puede evitarte muchos problemas</div>
</div>`);

// ── B05 PIVOT — Lo que casi nadie revisa ──────────────────────────────────
const b05 = html(`
  .card { ${CARD_BOTTOM} border-left:3px solid #fb923c; }
  .pre  { font:600 19px/1 'Inter',sans-serif; color:#94a3b8; letter-spacing:.06em; text-transform:uppercase; margin-bottom:14px; }
  .text { font:700 40px/1.2 'Space Grotesk',sans-serif; color:#f8fafc; }
  .text .accent{ color:#fb923c; }
  .sub  { margin-top:16px; font:500 22px/1.5 'Inter',sans-serif; color:#94a3b8; }
  .sub em { color:#f8fafc; font-style:normal; font-weight:600; }
`, `<div class="card">
  <div class="pre">⚠️ Antes de comprar un seguro</div>
  <div class="text">Hay algo que <span class="accent">casi nadie revisa</span></div>
  <div class="sub">¿Qué tipo de <em>asistencia</em> vas a recibir cuando realmente lo necesites?</div>
</div>`);

// ── B06 PREGUNTAS — ¿Tienes grúa? ─────────────────────────────────────────
const b06 = html(`
  .card  { ${CARD_BOTTOM} }
  .label { font:600 18px/1 'Inter',sans-serif; letter-spacing:.10em; text-transform:uppercase; color:#fb923c; margin-bottom:18px; }
  .q     { display:flex; align-items:center; gap:14px; margin-bottom:16px; opacity:0; font:700 32px/1.2 'Space Grotesk',sans-serif; color:#f8fafc; animation:popIn .22s cubic-bezier(.34,1.56,.64,1) forwards; }
  .q .icon{ font-size:30px; flex-shrink:0; }
  .q:nth-child(2){ animation-delay:0s; }
  .q:nth-child(3){ animation-delay:0.8s; }
  .q:nth-child(4){ animation-delay:1.6s; }
`, `<div class="card">
  <div class="label">¿Tu seguro incluye...?</div>
  <div class="q"><span class="icon">🚛</span> ¿Tienes grúa?</div>
  <div class="q"><span class="icon">🛠️</span> ¿Asistencia en carretera?</div>
  <div class="q"><span class="icon">🚗</span> ¿Carro de reemplazo?</div>
</div>`);

// ── B07 IMPACT — Verdadero valor del seguro ───────────────────────────────
const b07 = html(`
  .card { ${CARD_CENTER} }
  .icon { font-size:54px; margin-bottom:18px; display:block; }
  .text { font:700 38px/1.2 'Space Grotesk',sans-serif; color:#f8fafc; margin-bottom:16px; }
  .text .accent{ color:#fb923c; }
  .divider{ width:60px; height:3px; background:#fb923c; margin:18px auto; border-radius:2px; }
  .sub  { font:500 22px/1.5 'Inter',sans-serif; color:#94a3b8; }
  .sub em { color:#f8fafc; font-style:normal; font-weight:600; }
`, `<div class="card">
  <span class="icon">💡</span>
  <div class="text">El verdadero valor de un seguro<br>no lo ves <span class="accent">cuando lo compras</span></div>
  <div class="divider"></div>
  <div class="sub">Lo ves al día que <em>realmente necesites usarlo</em></div>
</div>`);

// ── B08 CTA CIERRE — Logo + enlace ────────────────────────────────────────
const b08 = html(`
  .card { position:absolute; left:50%; transform:translateX(-50%); width:85%; top:33%;
    background:rgba(15,23,42,0.80); backdrop-filter:blur(8px); border:2px solid rgba(251,146,60,.55);
    border-radius:18px; padding:42px 36px;
    box-shadow:0 0 48px rgba(251,146,60,.22),0 4px 32px rgba(0,0,0,.6);
    text-align:center; animation:slideUp 0.35s cubic-bezier(0.16,1,0.3,1) forwards; }
  @keyframes glowPulse {
    0%,100%{ box-shadow:0 0 48px rgba(251,146,60,.20),0 4px 32px rgba(0,0,0,.6); }
    50%    { box-shadow:0 0 70px rgba(251,146,60,.45),0 4px 32px rgba(0,0,0,.6); }
  }
  .logo    { width:44%; object-fit:contain; display:block; margin:0 auto 24px; }
  .cta-text{ font:700 34px/1.2 'Space Grotesk',sans-serif; color:#f8fafc; margin-bottom:12px; }
  .cta-sub { font:500 22px/1.4 'Inter',sans-serif; color:#94a3b8; margin-bottom:22px; }
  .cta-btn { display:inline-flex; align-items:center; gap:10px; background:#fb923c; color:#0f172a;
    font:700 22px/1 'Space Grotesk',sans-serif; padding:16px 32px; border-radius:100px;
    animation:glowPulse 2s ease-in-out infinite; }
`, `<div class="card">
  <img class="logo" src="${logoB64}" alt="DM Seguros">
  <div class="cta-text">Aprende a elegir mejor</div>
  <div class="cta-sub">Conoce más sobre seguros y toma decisiones informadas</div>
  <div class="cta-btn">👆 Enlace en mi perfil</div>
</div>`);

// ── Escribir todos ─────────────────────────────────────────────────────────
const files = [
  ['index.html', b01],
  ['compositions/beat_02.html', b02],
  ['compositions/beat_03.html', b03],
  ['compositions/beat_04.html', b04],
  ['compositions/beat_05.html', b05],
  ['compositions/beat_06.html', b06],
  ['compositions/beat_07.html', b07],
  ['compositions/beat_08.html', b08],
];

for (const [name, content] of files) {
  fs.mkdirSync(path.join(COMP, path.dirname(name)), { recursive: true });
  fs.mkdirSync(path.join(COMP_HF, path.dirname(name)), { recursive: true });
  fs.writeFileSync(path.join(COMP, name), content, 'utf8');
  fs.writeFileSync(path.join(COMP_HF, name), content, 'utf8');
  console.log('✓', name, `(${Math.round(content.length/1024)}KB)`);
}
console.log('\nTodos los beats de reel2_seguros generados.');
