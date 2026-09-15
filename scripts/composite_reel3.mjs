// DM Seguros Reel 3 — composite 9 ProRes overlays sobre el vídeo editado
// Run: node scripts/composite_reel3.mjs

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const FFMPEG  = process.env.FFMPEG_BIN  || 'C:\\Users\\cgil\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffmpeg.exe';
const FFPROBE = process.env.FFPROBE_BIN || 'C:\\Users\\cgil\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffprobe.exe';

const BASE    = path.join(ROOT, 'output', 'edl_reel3', 'reel3_edited.mp4');
const RENDERS = path.join(ROOT, 'output', 'compositions', 'edl_reel3', 'renders');
const OUTPUT  = path.join(ROOT, 'output', 'edl_reel3', 'reel3_final.mp4');

const BEATS = [
  { file: 'beat_01_intro.mov',      start:  0.50, end:  9.80 },
  { file: 'beat_02_factores.mov',   start: 10.42, end: 15.32 },
  { file: 'beat_03_stat.mov',       start: 15.70, end: 21.50 },
  { file: 'beat_04_prima.mov',      start: 22.46, end: 28.30 },
  { file: 'beat_05_cotizacion.mov', start: 29.30, end: 33.60 },
  { file: 'beat_06_nocuanto.mov',   start: 33.92, end: 40.50 },
  { file: 'beat_07_preguntas.mov',  start: 41.38, end: 51.60 },
  { file: 'beat_08_quote.mov',      start: 51.82, end: 56.60 },
  { file: 'beat_09_cierre.mov',     start: 57.22, end: 64.50 },
];

for (const b of BEATS) {
  const p = path.join(RENDERS, b.file);
  if (!fs.existsSync(p)) { console.error(`ERROR: falta ${p}`); process.exit(1); }
}

const inputs = ['-i', BASE];
for (const b of BEATS) inputs.push('-i', path.join(RENDERS, b.file));

const ptsLines = BEATS.map((b, i) =>
  `[${i + 1}:v]setpts=PTS-STARTPTS+${b.start}/TB[ov${i}]`
);

let lastLabel = '0:v';
const chainLines = BEATS.map((b, i) => {
  const outLabel = i < BEATS.length - 1 ? `v${i + 1}` : 'vout';
  const line = `[${lastLabel}][ov${i}]overlay=0:0:enable='between(t,${b.start},${b.end})'[${outLabel}]`;
  lastLabel = outLabel;
  return line;
});

const filterFile = path.join(ROOT, 'output', 'edl_reel3', 'reel3_filter.txt');
fs.writeFileSync(filterFile, [...ptsLines, ...chainLines].join(';\n'), 'utf8');
console.log('Filter escrito ✓');

const cmd = [
  `"${FFMPEG}"`,
  ...inputs.map(x => `"${x}"`),
  `-filter_complex_script "${filterFile}"`,
  `-map "[vout]" -map 0:a`,
  `-c:v libx264 -preset slow -crf 18`,
  `-c:a aac -b:a 192k -movflags +faststart`,
  `"${OUTPUT}" -y`,
].join(' ');

console.log('Compositing...');
execSync(cmd, { stdio: 'inherit' });

const dur = execSync(`"${FFPROBE}" -v quiet -show_entries format=duration -of csv=p=0 "${OUTPUT}"`).toString().trim();
console.log(`\n✓ ${path.basename(OUTPUT)} — ${parseFloat(dur).toFixed(2)}s`);

execSync(
  `"${FFMPEG}" -i "${OUTPUT}" -vf "select='eq(n,15)+eq(n,180)+eq(n,900)+eq(n,1500)'" -vsync 0 "${path.join(ROOT, 'output', 'edl_reel3')}/reel3_verify_%d.png" -y`,
  { stdio: 'inherit' }
);
console.log('✓ Frames de verificación generados');
