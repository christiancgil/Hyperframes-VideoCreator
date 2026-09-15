import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const FFPROBE = 'C:\\Users\\cgil\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffprobe.exe';
const NORM_DIR = path.join(ROOT, 'input', 'normalized');
const CLIPS = [
  'IMG_0786.MP4','IMG_0787.MP4','IMG_0789.MP4','IMG_0790.MP4','IMG_0791.MP4',
  'IMG_0792.MP4','IMG_0793.MP4','IMG_0794.MP4','IMG_0796.MP4','IMG_0797.MP4'
];

let offsets = [];
let total = 0;
for (const clip of CLIPS) {
  const p = path.join(NORM_DIR, clip);
  const dur = parseFloat(execSync(`"${FFPROBE}" -v quiet -show_entries format=duration -of csv=p=0 "${p}"`).toString().trim());
  offsets.push({ file: `normalized/${clip}`, start_in_merged: Math.round(total * 1e6) / 1e6, duration: Math.round(dur * 1e6) / 1e6 });
  console.log(`  ${clip}: start=${total.toFixed(3)}s dur=${dur.toFixed(3)}s`);
  total += dur;
}
console.log(`Total: ${total.toFixed(3)}s`);
fs.writeFileSync(path.join(ROOT, 'input', 'clip_offsets.json'), JSON.stringify(offsets, null, 2));
console.log('clip_offsets.json guardado');
