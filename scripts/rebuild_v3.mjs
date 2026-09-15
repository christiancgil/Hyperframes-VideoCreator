/**
 * rebuild_v3.mjs
 * Fixes:
 * 1. Silence at second ~25: keep[2] now starts at 32.5 (skips clip-2/clip-3 boundary silence)
 * 2. Audio desync at 26-34s: forces CFR 30fps + aresample async to eliminate VFR drift
 */
import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE   = path.join(__dirname, '..');
const FFMPEG = 'C:/Users/cgil/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.1-full_build/bin/ffmpeg.exe';
const FB     = "'C\\:/Windows/Fonts/arialbd.ttf'";
const FR     = "'C\\:/Windows/Fonts/arial.ttf'";

const run = (args) => execFileSync(FFMPEG, args, { stdio: 'inherit' });

// ── PASO 1: merged_clean_v3.mp4 ──────────────────────────────────────────
// Keep intervals en merged.mp4:
//   keep[2] cambia de [30.65,41.14] → [32.5,41.14]
//   Esto salta el silencio en la frontera clip2/clip3 (31.67s en merged)
// Clip boundaries en merged.mp4:
//   clip1: 0-16.08  clip2: 16.08-31.67  clip3: 31.67-43.65
//   clip4: 43.65-68.70  clip5: 68.70-87.51
const MERGED_IN  = path.join(BASE, 'output', 'merged.mp4');
const MERGED_OUT = path.join(BASE, 'output', 'merged_clean_v3.mp4');

const keeps = [
  [2.23,  14.15],
  [17.0,  29.15],
  [32.5,  41.14],  // FIXED: era 30.65, ahora 32.5 — salta silencio en frontera clip2/3
  [45.65, 67.15],
  [70.65, 86.63],
];

// Calcular nuevos timestamps para las tarjetas
let cursor = 0;
const newKeeps = keeps.map(([s, e]) => {
  const start = cursor;
  cursor += (e - s);
  return { oldS: s, oldE: e, newS: start, newE: cursor };
});
const newTotalDur = cursor;
console.log(`Nueva duración: ${newTotalDur.toFixed(2)}s`);
newKeeps.forEach(k =>
  console.log(`  old [${k.oldS}→${k.oldE}]  →  new [${k.newS.toFixed(2)}→${k.newE.toFixed(2)}]`)
);

// Sin fps filter en el filter_complex — fps=fps=30 post-concat duplicaba frames en PTS gaps VFR
// -r 30 en el muxer ajusta timestamps sin duplicar frames
const vParts = [], aParts = [], concatIn = [];
keeps.forEach(([s, e], i) => {
  vParts.push(`[0:v]trim=start=${s}:end=${e},setpts=PTS-STARTPTS[v${i}]`);
  aParts.push(`[0:a]atrim=start=${s}:end=${e},asetpts=PTS-STARTPTS[a${i}]`);
  concatIn.push(`[v${i}][a${i}]`);
});
const fc = [...vParts, ...aParts,
  `${concatIn.join('')}concat=n=${keeps.length}:v=1:a=1[vo][ao]`
].join(';');

console.log('\n[1/2] Re-cortando merged.mp4 → merged_clean_v3.mp4...');
run(['-i', MERGED_IN, '-filter_complex', fc, '-map', '[vo]', '-map', '[ao]',
     '-c:v', 'libx264', '-crf', '18', '-preset', 'fast', '-r', '30',
     '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart',
     MERGED_OUT, '-y']);
console.log('merged_clean_v3.mp4 OK\n');

// ── PASO 2: Render final con 14 tarjetas ─────────────────────────────────
// Timestamps recalculados con los nuevos keeps:
//
// new [0.00→11.92]  ← seg0 (0-7s) + seg1 (7-14.15s)
// new [11.92→24.07] ← seg2 (17-23s) + seg3 (23-29.15s)
// new [24.07→32.71] ← seg4 mid (32.5-39s) + seg5 (39-41.14s)  ← 8.64s
// new [32.71→54.21] ← seg6 (46-52s) + seg7 (52-56s) + seg8 (56-62s) + seg9 (62-67.15s)
// new [54.21→70.19] ← seg10 (71-77s) + seg11 (77-83s) + seg12 (83-86.63s)

const fade = (s, e) =>
  `'if(lt(t-${s},0.4),(t-${s})/0.4,if(lt(t,${e}-0.4),1,(${e}-t)/0.4))'`;

const cards = [
  // Keep 1: 0.00–11.92s — "Hay una decisión..." + "Ha sido la mayor diferencia..."
  { s: 0.5,  e: 4.5,  t: 'DISENO DE SONRISA',        b: 'Una decision que lo cambia todo',               f: null },
  { s: 5.5,  e: 9.5,  t: 'RECUPERA TU SEGURIDAD',    b: 'La mayor diferencia en los ultimos meses',      f: null },
  // Keep 2: 11.92–24.07s — "Existen miles de casos..." + "dañando la función natural..."
  { s: 12.5, e: 16.5, t: 'EL PROBLEMA',               b: 'Tratamientos costosos sin diagnostico correcto',f: null },
  { s: 18.0, e: 22.0, t: 'FUNCION NATURAL',            b: 'Danada por tratamientos genericos',             f: null },
  // Keep 3: 24.07–32.71s — "Con un proceso simple..." + "también revisamos tu rostro"
  { s: 24.5, e: 28.5, t: 'VALORACION INTEGRAL',       b: 'Dientes - Radiografias - Examenes - Rostro',    f: null },
  { s: 29.2, e: 32.2, t: 'TU ROSTRO TAMBIEN',         b: 'Armonia facial completa incluida',              f: null },
  // Keep 4: 32.71–54.21s — "Con un solo proceso..." + resultados + "no más caro no es mejor"
  { s: 33.5, e: 37.5, t: 'UN SOLO PROCESO',           b: 'Simple, completo y sin pasos innecesarios',     f: null },
  { s: 38.5, e: 42.5, t: 'RESULTADO NATURAL',         b: 'Sin dientes que parecen chicles',               f: null },
  { s: 44.0, e: 48.0, t: 'MAS CARO NO ES MEJOR',      b: 'El diagnostico correcto es lo que importa',     f: null },
  { s: 49.5, e: 53.5, t: 'CADA CASO ES UNICO',        b: 'El tratamiento ideal depende de tu diagnostico',f: null },
  // Keep 5: 54.21–70.19s — "En la valoración te daré..." + planes + "para que puedas acceder..."
  { s: 55.0, e: 59.0, t: 'EN LA VALORACION',          b: 'Tu diagnostico exacto y planes de tratamiento', f: null },
  { s: 60.0, e: 64.0, t: '1, 2 O 3 OPCIONES',         b: 'Segun el motivo de tu consulta',                f: null },
  { s: 65.0, e: 69.0, t: 'PLANES FLEXIBLES',          b: 'Ajustados a las membresias que manejamos',      f: null },
  { s: 69.2, e: newTotalDur - 0.2,
    t: 'AGENDA TU VALORACION', b: 'Diagnostico + plan de tratamiento hoy', f: 'Ajustado a tus necesidades y presupuesto' },
];

const vfParts = ['scale=1080:1920:flags=lanczos'];

for (const c of cards) {
  const en = `'between(t,${c.s},${c.e})'`;
  const a  = fade(c.s, c.e);
  const boxH = c.f ? 210 : 170;
  const boxY = 1920 - 55 - boxH;

  vfParts.push(`drawbox=x=55:y=${boxY}:w=970:h=${boxH}:color=0x1e293b@0.78:t=fill:enable=${en}`);
  vfParts.push(`drawbox=x=55:y=${boxY}:w=5:h=${boxH}:color=0x60a5fa:t=fill:enable=${en}`);
  vfParts.push(`drawtext=fontfile=${FB}:text='${c.t}':x=(w-text_w)/2:y=${boxY+20}:fontsize=46:fontcolor=0x60a5fa:enable=${en}:alpha=${a}`);
  vfParts.push(`drawtext=fontfile=${FR}:text='${c.b}':x=(w-text_w)/2:y=${boxY+78}:fontsize=28:fontcolor=0xe0e0e0:enable=${en}:alpha=${a}`);
  if (c.f) {
    vfParts.push(`drawtext=fontfile=${FR}:text='${c.f}':x=(w-text_w)/2:y=${boxY+118}:fontsize=24:fontcolor=0x888888:enable=${en}:alpha=${a}`);
  }
}

const VF = vfParts.join(',');
// aresample=async=1 corrige micro-drift sin insertar silencios (sin first_pts)
const AF = 'aresample=async=1,highpass=f=80,afftdn=nf=-25,equalizer=f=2500:width_type=o:width=2:g=5,loudnorm=I=-16:TP=-1.5:LRA=11';
const OUT = path.join(BASE, 'output', 'final', 'reel_instagram_v3.mp4');

console.log(`[2/2] Renderizando ${cards.length} tarjetas → 1080x1920 (CFR 30fps)...`);
run(['-i', MERGED_OUT, '-vf', VF, '-af', AF,
     '-c:v', 'libx264', '-crf', '18', '-preset', 'slow',
     '-c:a', 'aac', '-b:a', '192k',
     '-movflags', '+faststart', '-pix_fmt', 'yuv420p',
     OUT, '-y']);
console.log(`\nRender completado: ${OUT}`);
