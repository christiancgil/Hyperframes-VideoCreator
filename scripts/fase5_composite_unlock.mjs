import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const FFMPEG  = process.env.FFMPEG_BIN  || 'C:\\Users\\cgil\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffmpeg.exe';
const FFPROBE = process.env.FFPROBE_BIN || 'C:\\Users\\cgil\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffprobe.exe';

const BASE    = path.join(ROOT, 'input', 'video_completo.mp4');
const RENDERS = path.join(ROOT, 'output', 'compositions', 'unlock_smile', 'renders');
const OUTPUT  = path.join(ROOT, 'output', 'unlock_smile_final.mp4');

const OVERLAYS = [
  { file: 'index.mov',   start:  0.40, end:  5.50 },
  { file: 'beat_02.mov', start:  5.50, end: 12.30 },
  { file: 'beat_03.mov', start: 12.30, end: 17.20 },
  { file: 'beat_04.mov', start: 17.20, end: 21.70 },
  { file: 'beat_05.mov', start: 21.44, end: 27.30 },
  { file: 'beat_06.mov', start: 27.18, end: 36.17 },
];

for (const ov of OVERLAYS) {
  const p = path.join(RENDERS, ov.file);
  if (!fs.existsSync(p)) { console.error(`ERROR: falta ${p}`); process.exit(1); }
}

const inputs = ['-i', BASE];
for (const ov of OVERLAYS) inputs.push('-i', path.join(RENDERS, ov.file));

const filterLines = OVERLAYS.map((ov, i) =>
  `[${i + 1}:v]setpts=PTS-STARTPTS+${ov.start}/TB[ov${i}]`
);

let lastLabel = '0:v';
const chainParts = OVERLAYS.map((ov, i) => {
  const outLabel = i < OVERLAYS.length - 1 ? `v${i + 1}` : 'vout';
  const part = `[${lastLabel}][ov${i}]overlay=0:0:enable='between(t,${ov.start},${ov.end})'[${outLabel}]`;
  lastLabel = outLabel;
  return part;
});

const filterFile = path.join(ROOT, 'output', 'unlock_filter.txt');
fs.writeFileSync(filterFile, [...filterLines, ...chainParts].join(';\n'), 'utf8');
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

const silCount = execSync(`"${FFMPEG}" -i "${OUTPUT}" -af silencedetect=n=-50dB:d=2 -f null - 2>&1`).toString().split('\n').filter(l => l.includes('silence_start')).length;
console.log(`✓ Silencios largos: ${silCount}`);

execSync(
  `"${FFMPEG}" -i "${OUTPUT}" -vf "select='eq(n,30)+eq(n,360)+eq(n,720)'" -vsync 0 "${path.join(ROOT, 'output')}/unlock_verify_%d.png" -y`,
  { stdio: 'inherit' }
);
console.log(`✓ Frames de verificación generados`);
