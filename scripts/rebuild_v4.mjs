/**
 * rebuild_v4.mjs
 * Trimea directamente desde trimmed_1..5.mp4 — evita el problema de PTS
 * en fronteras de concat de merged.mp4 que causaba freeze en t=26-32s.
 *
 * Keeps en tiempo de cada clip fuente (= merged_time - clip_start_in_merged):
 *   trimmed_1: merged 0-16.08    → keep merged [2.23,14.15]  → clip [2.23,14.15]
 *   trimmed_2: merged 16.08-31.67 → keep merged [17.0,29.15]  → clip [0.92,13.07]
 *   trimmed_3: merged 31.67-43.65 → keep merged [32.5,41.14]  → clip [0.83,9.47]
 *   trimmed_4: merged 43.65-68.70 → keep merged [45.65,67.15] → clip [2.00,23.50]
 *   trimmed_5: merged 68.70-87.51 → keep merged [70.65,86.63] → clip [1.95,17.93]
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

// ── PASO 1: merged_clean_v4.mp4 desde clips fuente directamente ──────────
const TRIMMED_DIR = path.join(BASE, 'output', 'trimmed');
const MERGED_OUT  = path.join(BASE, 'output', 'merged_clean_v4.mp4');

// [clip_index, clip_start, clip_end] — en tiempo del clip fuente
const clips = [
  { file: 'trimmed_1.mp4', s: 2.23,  e: 14.15 },
  { file: 'trimmed_2.mp4', s: 0.92,  e: 13.07 },
  { file: 'trimmed_3.mp4', s: 0.83,  e: 9.47  },
  { file: 'trimmed_4.mp4', s: 2.00,  e: 23.50 },
  { file: 'trimmed_5.mp4', s: 1.95,  e: 17.93 },
];

let cursor = 0;
const newKeeps = clips.map(c => {
  const dur   = c.e - c.s;
  const start = cursor;
  cursor += dur;
  return { ...c, newS: start, newE: cursor };
});
const newTotalDur = cursor;

console.log(`Nueva duración: ${newTotalDur.toFixed(2)}s`);
newKeeps.forEach(k =>
  console.log(`  ${k.file} [${k.s}→${k.e}]  →  new [${k.newS.toFixed(2)}→${k.newE.toFixed(2)}]`)
);

// filter_complex con múltiples inputs — cada clip tiene sus propias PTSs limpias
const inputs  = clips.map(c => ['-i', path.join(TRIMMED_DIR, c.file)]).flat();
const vParts  = [], aParts = [], concatIn = [];
clips.forEach((c, i) => {
  vParts.push(`[${i}:v]trim=start=${c.s}:end=${c.e},setpts=PTS-STARTPTS[v${i}]`);
  aParts.push(`[${i}:a]atrim=start=${c.s}:end=${c.e},asetpts=PTS-STARTPTS[a${i}]`);
  concatIn.push(`[v${i}][a${i}]`);
});
const fc = [...vParts, ...aParts,
  `${concatIn.join('')}concat=n=${clips.length}:v=1:a=1[vo][ao]`
].join(';');

console.log('\n[1/2] Generando merged_clean_v4.mp4 (desde clips fuente)...');
run([...inputs, '-filter_complex', fc, '-map', '[vo]', '-map', '[ao]',
     '-c:v', 'libx264', '-crf', '18', '-preset', 'fast', '-r', '30',
     '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart',
     MERGED_OUT, '-y']);
console.log('merged_clean_v4.mp4 OK\n');

// ── PASO 2: Render final con 14 tarjetas ─────────────────────────────────
// Timestamps basados en los nuevos keeps:
// new [0.00→11.92]  ← trimmed_1 seg0+1 "Hay una decisión..." + "Ha sido la mayor..."
// new [11.92→24.07] ← trimmed_2 seg2+3 "Existen miles..." + "dañando la función..."
// new [24.07→32.71] ← trimmed_3 seg4+5 "Con un proceso simple..." + "también tu rostro"
// new [32.71→54.21] ← trimmed_4 seg6-9 "Con un solo proceso..." + resultados + "no más caro"
// new [54.21→70.19] ← trimmed_5 seg10-12 "En la valoración..." + planes + accede

const fade = (s, e) =>
  `'if(lt(t-${s},0.4),(t-${s})/0.4,if(lt(t,${e}-0.4),1,(${e}-t)/0.4))'`;

const cards = [
  { s: 0.5,  e: 4.5,  t: 'DISENO DE SONRISA',        b: 'Una decision que lo cambia todo',               f: null },
  { s: 5.5,  e: 9.5,  t: 'RECUPERA TU SEGURIDAD',    b: 'La mayor diferencia en los ultimos meses',      f: null },
  { s: 12.5, e: 16.5, t: 'EL PROBLEMA',               b: 'Tratamientos costosos sin diagnostico correcto',f: null },
  { s: 18.0, e: 22.0, t: 'FUNCION NATURAL',            b: 'Danada por tratamientos genericos',             f: null },
  { s: 24.5, e: 28.5, t: 'VALORACION INTEGRAL',       b: 'Dientes - Radiografias - Examenes - Rostro',    f: null },
  { s: 29.2, e: 32.2, t: 'TU ROSTRO TAMBIEN',         b: 'Armonia facial completa incluida',              f: null },
  { s: 33.5, e: 37.5, t: 'UN SOLO PROCESO',           b: 'Simple, completo y sin pasos innecesarios',     f: null },
  { s: 38.5, e: 42.5, t: 'RESULTADO NATURAL',         b: 'Sin dientes que parecen chicles',               f: null },
  { s: 44.0, e: 48.0, t: 'MAS CARO NO ES MEJOR',      b: 'El diagnostico correcto es lo que importa',     f: null },
  { s: 49.5, e: 53.5, t: 'CADA CASO ES UNICO',        b: 'El tratamiento ideal depende de tu diagnostico',f: null },
  { s: 55.0, e: 59.0, t: 'EN LA VALORACION',          b: 'Tu diagnostico exacto y planes incluidos',      f: null },
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
const AF = 'aresample=async=1,highpass=f=80,afftdn=nf=-25,equalizer=f=2500:width_type=o:width=2:g=5,loudnorm=I=-16:TP=-1.5:LRA=11';
const OUT = path.join(BASE, 'output', 'final', 'reel_instagram_v4.mp4');

console.log(`[2/2] Renderizando ${cards.length} tarjetas → 1080x1920...`);
run(['-i', MERGED_OUT, '-vf', VF, '-af', AF,
     '-c:v', 'libx264', '-crf', '18', '-preset', 'slow',
     '-c:a', 'aac', '-b:a', '192k',
     '-movflags', '+faststart', '-pix_fmt', 'yuv420p',
     OUT, '-y']);
console.log(`\nRender completado: ${OUT}`);
