// FASE 5 — Composite felipe_smile beats over video_completo.mp4
// Run: node scripts/fase5_composite_felipe.mjs

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const FFMPEG  = process.env.FFMPEG_BIN  || 'C:\\Users\\cgil\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffmpeg.exe';
const FFPROBE = process.env.FFPROBE_BIN || 'C:\\Users\\cgil\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffprobe.exe';

const BASE    = path.join(ROOT, 'input', 'video_completo.mp4');
const RENDERS = path.join(ROOT, 'output', 'compositions', 'felipe_smile', 'renders');
const OUTPUT  = path.join(ROOT, 'output', 'felipe_smile_final.mp4');

// Beat overlay windows (aligned to transcript segments)
// Format: { file, start, end }  — times in seconds in the base video timeline
const OVERLAYS = [
  { file: 'index.mov',   start:  0.00, end:  6.50 },
  { file: 'beat_02.mov', start:  6.32, end: 12.02 },
  { file: 'beat_03.mov', start: 12.34, end: 18.44 },
  { file: 'beat_04.mov', start: 18.40, end: 23.40 },
  { file: 'beat_05.mov', start: 23.36, end: 28.66 },
  { file: 'beat_06.mov', start: 28.58, end: 36.18 },
];

// Verify all MOV files exist
for (const ov of OVERLAYS) {
  const p = path.join(RENDERS, ov.file);
  if (!fs.existsSync(p)) {
    console.error(`ERROR: falta ${p} — ejecuta capture.js primero`);
    process.exit(1);
  }
}

// Build ffmpeg inputs: [0] = base, [1..N] = MOVs
const inputs = ['-i', BASE];
for (const ov of OVERLAYS) {
  inputs.push('-i', path.join(RENDERS, ov.file));
}

// Build filter_complex
// Each MOV: normalize PTS, then chain overlays
let filterLines = [];
for (let i = 0; i < OVERLAYS.length; i++) {
  const ov = OVERLAYS[i];
  const inputIdx = i + 1;
  filterLines.push(
    `[${inputIdx}:v]setpts=PTS-STARTPTS+${ov.start}/TB[ov${i}]`
  );
}

// Chain overlays: [0:v] → [v0] after first overlay, etc.
let chainParts = [];
let lastLabel = '0:v';
for (let i = 0; i < OVERLAYS.length; i++) {
  const ov = OVERLAYS[i];
  const outLabel = i < OVERLAYS.length - 1 ? `v${i + 1}` : 'vout';
  chainParts.push(
    `[${lastLabel}][ov${i}]overlay=0:0:enable='between(t,${ov.start},${ov.end})'[${outLabel}]`
  );
  lastLabel = outLabel;
}

const filterComplex = [...filterLines, ...chainParts].join(';\n');
const filterFile = path.join(ROOT, 'output', 'felipe_filter.txt');
fs.writeFileSync(filterFile, filterComplex, 'utf8');
console.log('Filter escrito en:', filterFile);

// Build ffmpeg command
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

// Verify output
const dur = execSync(
  `"${FFPROBE}" -v quiet -show_entries format=duration -of csv=p=0 "${OUTPUT}"`
).toString().trim();
console.log(`\n✓ ${path.basename(OUTPUT)} — duración: ${parseFloat(dur).toFixed(2)}s`);

// Silence check
const silCount = execSync(
  `"${FFMPEG}" -i "${OUTPUT}" -af silencedetect=n=-50dB:d=2 -f null - 2>&1`
).toString().split('\n').filter(l => l.includes('silence_start')).length;
console.log(`✓ Silencios largos detectados: ${silCount} (≤5 es OK)`);

// Extract 3 verification frames
const verifyDir = path.join(ROOT, 'output');
execSync(
  `"${FFMPEG}" -i "${OUTPUT}" -vf "select='eq(n,30)+eq(n,360)+eq(n,720)'" ` +
  `-vsync 0 "${verifyDir}/felipe_verify_%d.png" -y`,
  { stdio: 'inherit' }
);
console.log(`✓ Frames de verificación: ${verifyDir}/felipe_verify_1.png, _2.png, _3.png`);
