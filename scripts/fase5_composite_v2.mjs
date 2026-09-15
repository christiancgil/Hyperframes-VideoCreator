// fase5_composite_v2.mjs — overlay ProRes beats on edl_v2_edited.mp4
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT    = path.join(__dirname, '..');
const RENDERS = path.join(ROOT, 'output', 'compositions', 'edl_v2', 'renders');
const EDITED  = path.join(ROOT, 'output', 'edl_v2_edited.mp4');
const FINAL   = path.join(ROOT, 'output', 'edl_v2_final.mp4');
const FILTER  = path.join(ROOT, 'output', 'edl_v2_filter.txt');
const FFMPEG  = 'C:\\Users\\cgil\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffmpeg.exe';
const FFPROBE = 'C:\\Users\\cgil\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffprobe.exe';

// Beat placement in edited timeline (seconds)
const BEATS = [
  { file: 'index.mov',   start: 0.00,  end: 9.46  },
  { file: 'beat_02.mov', start: 9.46,  end: 27.96 },
  { file: 'beat_03.mov', start: 27.96, end: 32.96 },
  { file: 'beat_04.mov', start: 32.96, end: 44.10 },
  { file: 'beat_05.mov', start: 44.10, end: 59.22 },
  { file: 'beat_06.mov', start: 59.22, end: 68.38 },
  { file: 'beat_07.mov', start: 68.38, end: 75.02 },
  { file: 'beat_08.mov', start: 75.02, end: 85.00 },
  { file: 'beat_09.mov', start: 85.00, end: 93.05 },
];

// Verify renders exist and have alpha
console.log('Verificando renders...');
for (const b of BEATS) {
  const p = path.join(RENDERS, b.file);
  if (!fs.existsSync(p)) { console.error(`FALTA: ${b.file}`); process.exit(1); }
  const pix = execSync(`"${FFPROBE}" -v quiet -select_streams v:0 -show_entries stream=pix_fmt -of csv=p=0 "${p}"`).toString().trim();
  console.log(`  ${b.file}: ${pix} ${pix.startsWith('yuva') ? '✓' : '❌'}`);
  if (!pix.startsWith('yuva')) { console.error('Alpha incorrecto'); process.exit(1); }
}

// Build filter_complex
let filterLines = [];
let prevLabel = '[0:v]';

for (let i = 0; i < BEATS.length; i++) {
  const b = BEATS[i];
  const idx = i + 1;
  const outLabel = i === BEATS.length - 1 ? '[vout]' : `[v${i+1}]`;
  filterLines.push(`[${idx}:v]setpts=PTS-STARTPTS+${b.start}/TB[ov${i}]`);
  filterLines.push(`${prevLabel}[ov${i}]overlay=0:0:enable='between(t,${b.start},${b.end})'${outLabel}`);
  prevLabel = outLabel;
}

fs.writeFileSync(FILTER, filterLines.join(';\n'), 'utf8');
console.log(`\nFilter script: ${FILTER}`);

const cmd = [
  `"${FFMPEG}"`,
  `-i "${EDITED}"`,
  ...BEATS.map(b => `-i "${path.join(RENDERS, b.file)}"`),
  `-filter_complex_script "${FILTER}"`,
  `-map "[vout]"`,
  `-map 0:a`,
  `-c:v libx264 -preset slow -crf 18`,
  `-c:a copy`,
  `"${FINAL}" -y`
].join(' ');

console.log('\nCompositing (varios minutos)...');
execSync(cmd, { stdio: 'inherit' });

const dur = parseFloat(execSync(`"${FFPROBE}" -v quiet -show_entries format=duration -of csv=p=0 "${FINAL}"`).toString().trim());
console.log(`\n✓ edl_v2_final.mp4 — Duración: ${dur.toFixed(2)}s`);
console.log(`  Archivo: ${FINAL}`);
