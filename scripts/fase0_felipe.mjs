// FASE 0 — concat 3 clips Unlock_Your_Natural_Smile
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT   = path.join(__dirname, '..');
const INPUT  = path.join(ROOT, 'input');
const FFMPEG = 'C:\\Users\\cgil\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffmpeg.exe';
const FFPROBE= 'C:\\Users\\cgil\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffprobe.exe';

const CLIPS = [
  'Unlock_Your_Natural_Smile_Part1.mp4',
  'Unlock_Your_Natural_Smile_Part2.mp4',
  'Unlock_Your_Natural_Smile_Part3.mp4',
];

// Build clip_offsets.json
let offset = 0;
const offsets = [];
for (const clip of CLIPS) {
  const p = path.join(INPUT, clip);
  const dur = parseFloat(execSync(`"${FFPROBE}" -v quiet -show_entries format=duration -of csv=p=0 "${p}"`).toString().trim());
  offsets.push({ file: clip, start_in_merged: offset, duration: dur });
  offset += dur;
}
fs.writeFileSync(path.join(INPUT, 'clip_offsets.json'), JSON.stringify(offsets, null, 2));
console.log('clip_offsets.json guardado:');
offsets.forEach(o => console.log(`  ${o.file}: start=${o.start_in_merged.toFixed(3)}s dur=${o.duration.toFixed(3)}s`));
console.log(`  Total estimado: ${offset.toFixed(3)}s\n`);

// Concat list
const concatList = path.join(INPUT, 'concat_list.txt');
fs.writeFileSync(concatList, CLIPS.map(c => `file '${path.join(INPUT, c).replace(/\\/g, '/')}'`).join('\n'));

// Concat — same codec/res/fps → stream copy for video
const merged = path.join(INPUT, 'video_completo.mp4');
console.log('Concatenando clips...');
execSync(
  `"${FFMPEG}" -f concat -safe 0 -i "${concatList}" -c:v copy -c:a aac -b:a 192k "${merged}" -y`,
  { stdio: 'inherit' }
);

// Validate duration
const mergedDur = parseFloat(execSync(`"${FFPROBE}" -v quiet -show_entries format=duration -of csv=p=0 "${merged}"`).toString().trim());
console.log(`\n✓ video_completo.mp4 — ${mergedDur.toFixed(3)}s`);

// Check for freezes at join points
console.log('\nVerificando freezes en fronteras...');
execSync(`"${FFMPEG}" -i "${merged}" -vf freezedetect=n=0.001:d=0.5 -f null - 2>&1 | grep freeze_start || echo "Sin freezes detectados"`, { stdio: 'inherit', shell: true });
