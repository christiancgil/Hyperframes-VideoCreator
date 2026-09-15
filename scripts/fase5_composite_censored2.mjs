// FASE 5 — Composite censored_smile beats over new video_completo.mp4
// Run: node scripts/fase5_composite_censored2.mjs

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const FFMPEG  = process.env.FFMPEG_BIN  || 'C:\\Users\\cgil\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffmpeg.exe';
const FFPROBE = process.env.FFPROBE_BIN || 'C:\\Users\\cgil\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffprobe.exe';

const BASE    = path.join(ROOT, 'input', 'video_completo.mp4');
const RENDERS = path.join(ROOT, 'output', 'compositions', 'censored_smile', 'renders');
const OUTPUT  = path.join(ROOT, 'output', 'censored_smile_final.mp4');

// Beat overlay windows — aligned to censored2_transcript.json segments
const OVERLAYS = [
  { file: 'index.mov',   start:  0.00, end:  6.50 },
  { file: 'beat_02.mov', start:  6.32, end: 12.02 },
  { file: 'beat_03.mov', start: 12.34, end: 18.44 },
  { file: 'beat_04.mov', start: 18.16, end: 23.36 },
  { file: 'beat_05.mov', start: 23.36, end: 28.66 },
  { file: 'beat_06.mov', start: 28.58, end: 36.18 },
];

for (const ov of OVERLAYS) {
  const p = path.join(RENDERS, ov.file);
  if (!fs.existsSync(p)) { console.error(`ERROR: falta ${p}`); process.exit(1); }
}

const inputs = ['-i', BASE];
for (const ov of OVERLAYS) inputs.push('-i', path.join(RENDERS, ov.file));

let filterLines = [];
for (let i = 0; i < OVERLAYS.length; i++) {
  filterLines.push(`[${i + 1}:v]setpts=PTS-STARTPTS+${OVERLAYS[i].start}/TB[ov${i}]`);
}

let lastLabel = '0:v';
let chainParts = [];
for (let i = 0; i < OVERLAYS.length; i++) {
  const ov = OVERLAYS[i];
  const outLabel = i < OVERLAYS.length - 1 ? `v${i + 1}` : 'vout';
  chainParts.push(`[${lastLabel}][ov${i}]overlay=0:0:enable='between(t,${ov.start},${ov.end})'[${outLabel}]`);
  lastLabel = outLabel;
}

const filterComplex = [...filterLines, ...chainParts].join(';\n');
const filterFile = path.join(ROOT, 'output', 'censored2_filter.txt');
fs.writeFileSync(filterFile, filterComplex, 'utf8');
console.log('Filter escrito en:', filterFile);

const cmd = [
  `"${FFMPEG}"`,
  ...inputs.map(x => `"${x}"`),
  `-filter_complex_script "${filterFile}"`,
  `-map "[vout]"`,
  `-map 0:a`,
  `-c:v libx264 -preset slow -crf 18`,
  `-c:a aac -b:a 192k`,
  `-movflags +faststart`,
  `"${OUTPUT}" -y`,
].join(' ');

console.log('Compositing...');
execSync(cmd, { stdio: 'inherit' });

const dur = execSync(
  `"${FFPROBE}" -v quiet -show_entries format=duration -of csv=p=0 "${OUTPUT}"`
).toString().trim();
console.log(`\n✓ ${path.basename(OUTPUT)} — duración: ${parseFloat(dur).toFixed(2)}s`);

const silCount = execSync(
  `"${FFMPEG}" -i "${OUTPUT}" -af silencedetect=n=-50dB:d=2 -f null - 2>&1`
).toString().split('\n').filter(l => l.includes('silence_start')).length;
console.log(`✓ Silencios largos: ${silCount} (≤5 es OK)`);

const verifyDir = path.join(ROOT, 'output');
execSync(
  `"${FFMPEG}" -i "${OUTPUT}" -vf "select='eq(n,30)+eq(n,360)+eq(n,720)'" ` +
  `-vsync 0 "${verifyDir}/censored2_verify_%d.png" -y`,
  { stdio: 'inherit' }
);
console.log(`✓ Frames: ${verifyDir}/censored2_verify_1.png, _2.png, _3.png`);
