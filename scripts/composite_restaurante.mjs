// EDL Restaurante — composite 13 ProRes overlays over base video
// Run: node scripts/composite_restaurante.mjs

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const FFMPEG  = process.env.FFMPEG_BIN  || 'C:\\Users\\cgil\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffmpeg.exe';
const FFPROBE = process.env.FFPROBE_BIN || 'C:\\Users\\cgil\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffprobe.exe';

const BASE    = path.join(ROOT, 'output', 'edl_restaurante_v2_base.mp4');
const RENDERS = path.join(ROOT, 'output', 'compositions', 'edl_restaurante', 'renders');
const OUTPUT  = path.join(ROOT, 'output', 'edl_restaurante_v2_final.mp4');

// Cumulative timestamps — TTS durations (ElevenLabs v2)
const SCENES = [
  { file: 'scene_01.mov', start:  0.00, end:   4.32 },
  { file: 'scene_02.mov', start:  4.32, end:  11.66 },
  { file: 'scene_03.mov', start: 11.66, end:  17.56 },
  { file: 'scene_04.mov', start: 17.56, end:  23.46 },
  { file: 'scene_05.mov', start: 23.46, end:  29.87 },
  { file: 'scene_06.mov', start: 29.87, end:  34.79 },
  { file: 'scene_07.mov', start: 34.79, end:  40.55 },
  { file: 'scene_08.mov', start: 40.55, end:  50.77 },
  { file: 'scene_09.mov', start: 50.77, end:  58.67 },
  { file: 'scene_10.mov', start: 58.67, end:  66.10 },
  { file: 'scene_11.mov', start: 66.10, end:  73.76 },
  { file: 'scene_12.mov', start: 73.76, end:  87.97 },
  { file: 'scene_13.mov', start: 87.97, end:  91.64 },
];

// Verify all renders exist
for (const s of SCENES) {
  const p = path.join(RENDERS, s.file);
  if (!fs.existsSync(p)) { console.error(`ERROR: falta ${p}`); process.exit(1); }
}

// Build inputs: [0]=base, [1..13]=overlays
const inputs = ['-i', BASE];
for (const s of SCENES) inputs.push('-i', path.join(RENDERS, s.file));

// Build filter_complex
// Step 1: setpts for each overlay (shift to its start time in the base timeline)
const ptsLines = SCENES.map((s, i) =>
  `[${i + 1}:v]setpts=PTS-STARTPTS+${s.start}/TB[ov${i}]`
);

// Step 2: chain overlays sequentially
let lastLabel = '0:v';
const chainLines = SCENES.map((s, i) => {
  const outLabel = i < SCENES.length - 1 ? `v${i + 1}` : 'vout';
  const line = `[${lastLabel}][ov${i}]overlay=0:0:enable='between(t,${s.start},${s.end})'[${outLabel}]`;
  lastLabel = outLabel;
  return line;
});

const filterFile = path.join(ROOT, 'output', 'restaurante_filter.txt');
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
  `"${FFMPEG}" -i "${OUTPUT}" -vf "select='eq(n,24)+eq(n,200)+eq(n,400)+eq(n,1800)'" -vsync 0 "${path.join(ROOT, 'output')}/restaurante_v2_verify_%d.png" -y`,
  { stdio: 'inherit' }
);
console.log('✓ Frames de verificación generados');
