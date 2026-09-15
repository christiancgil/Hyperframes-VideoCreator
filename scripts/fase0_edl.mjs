// fase0_edl.mjs — FASE 0: normalizar rotation + concat 10 clips EDL
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const INPUT = path.join(ROOT, 'input');

const FFMPEG  = 'C:\\Users\\cgil\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffmpeg.exe';
const FFPROBE = 'C:\\Users\\cgil\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffprobe.exe';

// Crear carpetas
fs.mkdirSync(path.join(INPUT, 'originales'), { recursive: true });
fs.mkdirSync(path.join(INPUT, 'normalized'), { recursive: true });

const CLIPS = fs.readdirSync(INPUT)
  .filter(f => f.match(/\.(MP4|mp4)$/) && !f.startsWith('.'))
  .sort()
  .map(f => path.join(INPUT, f));

console.log(`\n── FASE 0: ${CLIPS.length} clips ──\n`);

const offsets = [];
let offset = 0;

// 1. Normalizar cada clip a portrait 720×1280
for (const clip of CLIPS) {
  const name = path.basename(clip, path.extname(clip));
  const outPath = path.join(INPUT, 'normalized', `${name}_portrait.mp4`);

  const dur = parseFloat(execSync(
    `"${FFPROBE}" -v quiet -show_entries format=duration -of csv=p=0 "${clip}"`
  ).toString().trim());

  process.stdout.write(`  ${path.basename(clip)} (${dur.toFixed(2)}s) → normalizing... `);
  execSync(
    `"${FFMPEG}" -i "${clip}" -c:v libx264 -preset fast -crf 18 -c:a aac -b:a 192k -metadata:s:v:0 rotate=0 -movflags +faststart "${outPath}" -y`,
    { stdio: 'pipe' }
  );
  console.log('✓');

  offsets.push({ file: path.basename(clip), normalized: path.basename(outPath), start_in_merged: parseFloat(offset.toFixed(3)), duration: parseFloat(dur.toFixed(3)) });
  offset += dur;
}

// 2. Guardar clip_offsets.json
fs.writeFileSync(path.join(INPUT, 'clip_offsets.json'), JSON.stringify(offsets, null, 2));
console.log(`\n✓ clip_offsets.json guardado (total: ${offset.toFixed(2)}s)`);

// 3. Concat lista
const listPath = path.join(INPUT, 'concat_list.txt');
const listContent = offsets.map(o =>
  `file '${path.join(INPUT, 'normalized', o.normalized).replace(/\\/g, '/')}'`
).join('\n');
fs.writeFileSync(listPath, listContent);

// 4. Concat con -c:v copy (todos normalizados → mismo formato)
const merged = path.join(INPUT, 'video_completo.mp4');
console.log('\nConcatenando clips normalizados...');
execSync(
  `"${FFMPEG}" -f concat -safe 0 -i "${listPath}" -c:v copy -c:a aac -b:a 192k "${merged}" -y`,
  { stdio: 'inherit' }
);

// 5. Verificar merged
const mergedDur = parseFloat(execSync(
  `"${FFPROBE}" -v quiet -show_entries format=duration -of csv=p=0 "${merged}"`
).toString().trim());
const mergedStart = execSync(
  `"${FFPROBE}" -v quiet -select_streams v:0 -show_entries stream=start_time -of csv=p=0 "${merged}"`
).toString().trim();

console.log(`\n✓ video_completo.mp4`);
console.log(`  Duración: ${mergedDur.toFixed(2)}s (esperado: ~${offset.toFixed(2)}s)`);
console.log(`  start_time: ${mergedStart}`);

// 6. Offsets table
console.log('\nOffsets de clips:');
offsets.forEach(o => console.log(`  [${o.start_in_merged.toFixed(2)}→${(o.start_in_merged+o.duration).toFixed(2)}s] ${o.file}`));
