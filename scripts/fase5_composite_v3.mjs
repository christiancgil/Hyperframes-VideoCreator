// fase5_composite_v3.mjs — composite centered beats on edl_v2_final.mp4
// Strategy: base = existing final (has old bottom cards baked in),
// add dark gradient mask at y>=640 to cover old cards, overlay new centered MOVs on top.
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT    = path.join(__dirname, '..');
const RENDERS = path.join(ROOT, 'output', 'compositions', 'edl_v2', 'renders');
const BASE    = path.join(ROOT, 'output', 'edl_v2_final.mp4');
const OUTPUT  = path.join(ROOT, 'output', 'edl_v2_final_v2.mp4');
const FILTER  = path.join(ROOT, 'output', 'edl_v2_filter_v3.txt');
const FFMPEG  = 'C:\\Users\\cgil\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffmpeg.exe';
const FFPROBE = 'C:\\Users\\cgil\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffprobe.exe';

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

// Verify base and renders
if (!fs.existsSync(BASE)) { console.error(`FALTA base: ${BASE}`); process.exit(1); }
const baseDur = parseFloat(execSync(`"${FFPROBE}" -v quiet -show_entries format=duration -of csv=p=0 "${BASE}"`).toString().trim());
console.log(`Base: edl_v2_final.mp4 — ${baseDur.toFixed(2)}s`);

console.log('\nVerificando renders...');
for (const b of BEATS) {
  const p = path.join(RENDERS, b.file);
  if (!fs.existsSync(p)) { console.error(`FALTA: ${b.file}`); process.exit(1); }
  const pix = execSync(`"${FFPROBE}" -v quiet -select_streams v:0 -show_entries stream=pix_fmt -of csv=p=0 "${p}"`).toString().trim();
  console.log(`  ${b.file}: ${pix} ${pix.startsWith('yuva') ? '✓' : '❌'}`);
  if (!pix.startsWith('yuva')) { console.error('Alpha incorrecto'); process.exit(1); }
}

// Build filter_complex:
// Step 1: apply dark gradient mask at bottom (y>=640) to cover old baked-in cards
// Step 2: chain overlay of each new centered beat
const filterLines = [];

// Dark mask gradient: transparent at y=580, fully black at y=800, covering old card zone
// Using geq to create a smooth gradient alpha mask, then overlay it on base video
filterLines.push(
  `[0:v]geq=r='0':g='0':b='0':a='255*max(0,min(1,(Y-580)/120))*0.88'[grad]`
);
filterLines.push(`[0:v][grad]overlay=0:0:format=auto[base_masked]`);

// Chain overlays for each beat
let prevLabel = '[base_masked]';
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
  `-i "${BASE}"`,
  ...BEATS.map(b => `-i "${path.join(RENDERS, b.file)}"`),
  `-/filter_complex "${FILTER}"`,
  `-map "[vout]"`,
  `-map 0:a`,
  `-c:v libx264 -preset slow -crf 18`,
  `-c:a copy`,
  `"${OUTPUT}" -y`
].join(' ');

console.log('\nCompositing (varios minutos)...');
execSync(cmd, { stdio: 'inherit' });

const dur = parseFloat(execSync(`"${FFPROBE}" -v quiet -show_entries format=duration -of csv=p=0 "${OUTPUT}"`).toString().trim());
console.log(`\n✓ edl_v2_final_v2.mp4 — Duración: ${dur.toFixed(2)}s`);
console.log(`  Archivo: ${OUTPUT}`);
