/**
 * rebuild_clean.mjs
 * 1. Re-corta merged.mp4 quitando TODOS los silencios detectados:
 *    - Startup con brazo (0→2.23s)
 *    - Gaps entre clips (14-17s, 28-31s, 41-45.65s, 67-70.65s)
 *    - Micro-pausas > 0.5s
 * 2. Genera merged_clean.mp4
 * 3. Re-renderiza reel_instagram_v2.mp4 con 14 tarjetas corporativas (~cada 5s)
 *    basadas en el texto real del transcript
 */
import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE   = path.join(__dirname, '..');
const FFMPEG = 'C:/Users/cgil/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.1-full_build/bin/ffmpeg.exe';
const FB     = "'C\\:/Windows/Fonts/arialbd.ttf'";
const FR     = "'C\\:/Windows/Fonts/arial.ttf'";

const run = (args) => execFileSync(FFMPEG, args, { stdio: 'inherit' });

// ──────────────────────────────────────────────
// PASO 1: Re-cortar merged.mp4 → merged_clean.mp4
// Intervalos a MANTENER (del silencedetect -35dB):
//   [2.23, 14.15]  → seg 0-1 "Hay una decisión..." + "Ha sido la mayor..."
//   [17.0,  29.15] → seg 2-3 "Existen miles..." + "sugieren y realizan..."
//   [30.65, 41.14] → seg 4-5 "Con un proceso..." + "también revisamos..."
//   [45.65, 67.15] → seg 6-9 "Con un solo proceso..." + toda la sección central
//   [70.65, 86.63] → seg 10-12 "En la valoración..." hasta final
// ──────────────────────────────────────────────
const MERGED_IN  = path.join(BASE, 'output', 'merged.mp4');
const MERGED_OUT = path.join(BASE, 'output', 'merged_clean.mp4');

const keeps = [
  [2.23,  14.15],
  [17.0,  29.15],
  [30.65, 41.14],
  [45.65, 67.15],
  [70.65, 86.63],
];

// Calcular timestamps en el nuevo video para tarjetas
const newStarts = [];
let cursor = 0;
for (const [s, e] of keeps) {
  newStarts.push({ oldStart: s, oldEnd: e, newStart: cursor });
  cursor += (e - s);
}
const newTotalDur = cursor;
console.log(`Duración nueva: ${newTotalDur.toFixed(2)}s`);
newStarts.forEach(k => console.log(
  `  old [${k.oldStart}→${k.oldEnd}]  →  new [${k.newStart.toFixed(2)}→${(k.newStart + k.oldEnd - k.oldStart).toFixed(2)}]`
));

// Construir filter_complex
const vParts = [], aParts = [], concatIn = [];
keeps.forEach(([s, e], i) => {
  vParts.push(`[0:v]trim=start=${s}:end=${e},setpts=PTS-STARTPTS[v${i}]`);
  aParts.push(`[0:a]atrim=start=${s}:end=${e},asetpts=PTS-STARTPTS[a${i}]`);
  concatIn.push(`[v${i}][a${i}]`);
});
const fc = [...vParts, ...aParts, `${concatIn.join('')}concat=n=${keeps.length}:v=1:a=1[vo][ao]`].join(';');

console.log('\n[1/2] Re-cortando merged.mp4...');
run(['-i', MERGED_IN, '-filter_complex', fc, '-map', '[vo]', '-map', '[ao]',
     '-c:v', 'libx264', '-crf', '18', '-preset', 'fast',
     '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart',
     MERGED_OUT, '-y']);
console.log('merged_clean.mp4 generado OK\n');

// ──────────────────────────────────────────────
// PASO 2: Render final con 14 tarjetas cada ~5s
// Texto basado en el transcript real del video
// ──────────────────────────────────────────────

// Función fade in/out (0.4s cada uno)
const fade = (s, e) =>
  `'if(lt(t-${s},0.4),(t-${s})/0.4,if(lt(t,${e}-0.4),1,(${e}-t)/0.4))'`;

// Tarjetas: [start, end, titulo, subtitulo, footnote?]
// Cada tarjeta dura 4s, separadas 0.5s entre sí
const cards = [
  // Grupo 1: "Hay una decisión..." → "Ha sido la mayor diferencia..."
  { s: 0.5,  e: 4.5,  t: 'DISENO DE SONRISA',        b: 'Una decision que lo cambia todo',               f: null },
  { s: 5.0,  e: 9.0,  t: 'RECUPERA TU SEGURIDAD',    b: 'La mayor diferencia en los ultimos meses',      f: null },
  // Grupo 2: "Existen miles de casos..."
  { s: 12.0, e: 16.0, t: 'EL PROBLEMA',               b: 'Tratamientos costosos sin diagnostico correcto',f: null },
  { s: 17.0, e: 21.0, t: 'FUNCION NATURAL',            b: 'Danada por tratamientos genericos',             f: null },
  // Grupo 3: "Con un proceso simple..."
  { s: 24.5, e: 28.5, t: 'VALORACION INTEGRAL',       b: 'Dientes - Radiografias - Examenes - Rostro',    f: null },
  { s: 29.5, e: 33.5, t: 'TU ROSTRO TAMBIEN',         b: 'Armonia facial completa incluida',              f: null },
  // Grupo 4: "Con un solo proceso..." + "Esto te da la oportunidad..."
  { s: 35.0, e: 39.0, t: 'UN SOLO PROCESO',           b: 'Simple, completo y sin pasos innecesarios',     f: null },
  { s: 40.0, e: 44.0, t: 'RESULTADO NATURAL',         b: 'Sin dientes que parecen chicles',               f: null },
  { s: 45.5, e: 49.5, t: 'MAS CARO NO ES MEJOR',      b: 'El diagnostico correcto es lo que importa',     f: null },
  // Grupo 5: "En la valoracion te dare..."
  { s: 57.0, e: 61.0, t: 'DIAGNOSTICO EXACTO',        b: 'Personalizado para tu caso',                    f: null },
  { s: 62.0, e: 66.0, t: '1, 2 O 3 OPCIONES',         b: 'Segun el motivo de tu consulta',                f: null },
  { s: 67.5, e: 71.5, t: 'PLANES FLEXIBLES',          b: 'Ajustados a las membresias que manejamos',      f: null },
  { s: 73.0, e: 77.0, t: 'ACCEDE A TODO',             b: 'Todos los tratamientos a tu alcance',           f: null },
  { s: 78.5, e: newTotalDur - 0.5, t: 'AGENDA TU VALORACION', b: 'Diagnostico + plan de tratamiento hoy', f: 'Ajustado a tus necesidades y presupuesto' },
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
const AF = 'highpass=f=80,afftdn=nf=-25,equalizer=f=2500:width_type=o:width=2:g=5,loudnorm=I=-16:TP=-1.5:LRA=11';
const OUT = path.join(BASE, 'output', 'final', 'reel_instagram_v2.mp4');

console.log(`[2/2] Renderizando ${cards.length} tarjetas → 1080x1920...`);
run(['-i', MERGED_OUT, '-vf', VF, '-af', AF,
     '-c:v', 'libx264', '-crf', '18', '-preset', 'slow',
     '-c:a', 'aac', '-b:a', '192k',
     '-movflags', '+faststart', '-pix_fmt', 'yuv420p',
     OUT, '-y']);
console.log(`\nRender completado: ${OUT}`);
