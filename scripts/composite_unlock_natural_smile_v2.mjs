import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const FFMPEG = 'C:\\Users\\cgil\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffmpeg.exe';

const RENDERS = path.join(ROOT, 'output', 'compositions', 'unlock-natural-smile', 'renders');
const baseVideo = path.join(ROOT, 'output', 'unlock-natural-smile_edited.mp4');
const outputFinal = path.join(ROOT, 'output', 'unlock-natural-smile_final_v2.mp4');

// [startTime, duration, file] — startTime = timestamp absoluto en el video editado
//
// NOTA: los timestamps originales (derivados de generate_beats.py /
// transcript_clean.json) están en la línea de tiempo PRE-iteración (36.18s).
// El vídeo base actual (unlock-natural-smile_edited.mp4) ya tiene 2 pausas
// eliminadas (ver projects/unlock-natural-smile/notes.md):
//   Pausa 1: 8.679s-9.340s (0.661s) — cae dentro del beat "dolor"
//   Pausa 2: 23.920s-24.819s (0.899s) — cae dentro del beat "solucion"
// Se han desplazado hacia atrás todos los timestamps posteriores a cada
// pausa (y acortado la duración de los beats que la contienen) para
// alinear con el vídeo base real de 34.67s.
const BEATS = [
  [0.0,   5.8,   'hook.mov'],
  [5.8,   7.039, 'dolor.mov'],
  [12.84, 4.8,   'consecuencia.mov'],
  [17.64, 4.6,   'reencuadre.mov'],
  [22.24, 2.601, 'solucion.mov'],
  [24.84, 3.0,   'urgencia.mov'],
  [26.24, 1.4,   'badge-gratis.mov'],
  [27.84, 3.2,   'impacto-cierre-parcial.mov'],
  [31.04, 3.5,   'cta-cierre.mov'],
];

let filterParts = [`[0:v]null[base]`];
let inputArgs = ['-i', baseVideo];

BEATS.forEach(([startTime, duration, file], i) => {
  inputArgs.push('-i', path.join(RENDERS, file));
  const prev = i === 0 ? 'base' : `v${i}`;
  const next = i === BEATS.length - 1 ? 'vout' : `v${i + 1}`;
  filterParts.push(
    `[${i + 1}:v]setpts=PTS+${startTime}/TB[ov${i}];` +
    `[${prev}][ov${i}]overlay=0:0:enable='between(t,${startTime},${startTime + duration})'[${next}]`
  );
});

const filter = filterParts.join('; ');

console.log('Compositando unlock-natural-smile v2 (sin karaoke plano)...');
execFileSync(FFMPEG, [
  ...inputArgs,
  '-filter_complex', filter,
  '-map', '[vout]', '-map', '0:a',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
  '-c:a', 'aac', '-b:a', '192k',
  outputFinal, '-y',
], { stdio: 'inherit' });
console.log(`\n✓ Vídeo final v2: ${outputFinal}`);
