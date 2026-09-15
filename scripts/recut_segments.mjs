// recut_segments.mjs — cut segments with PTS reset to fix concat duration issue
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const NORM_DIR = path.join(ROOT, 'input', 'normalized');
const SEG_DIR  = path.join(ROOT, 'output', 'segments_v2');
const FFMPEG   = 'C:\\Users\\cgil\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffmpeg.exe';
const FFPROBE  = 'C:\\Users\\cgil\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffprobe.exe';

// [clip, ss_in_clip, to_in_clip]
const SEGS = [
  ['IMG_0786.MP4', 1.58,  11.04],
  ['IMG_0787.MP4', 1.78,  11.26],
  ['IMG_0789.MP4', 0.133, 9.153],
  ['IMG_0790.MP4', 0.653, 5.653],
  ['IMG_0791.MP4', 0.913, 12.053],
  ['IMG_0792.MP4', 1.097, 16.217],
  ['IMG_0793.MP4', 1.141, 10.301],
  ['IMG_0794.MP4', 0.595, 7.235],
  ['IMG_0796.MP4', 0.583, 6.643],
  ['IMG_0796.MP4', 7.643, 11.563],
  ['IMG_0797.MP4', 1.097, 8.977],
];

for (let i = 0; i < SEGS.length; i++) {
  const [clip, ss, to] = SEGS[i];
  const duration = to - ss;
  const n = String(i + 1).padStart(2, '0');
  const src = path.join(NORM_DIR, clip);
  const out = path.join(SEG_DIR, `seg_${n}.mp4`);

  console.log(`Recortando seg_${n}: ${clip} [${ss.toFixed(3)}→${to.toFixed(3)}] (${duration.toFixed(3)}s)`);

  // -ss BEFORE -i for fast seek, -t for duration (relative to seek point), setpts resets PTS to 0
  execSync(
    `"${FFMPEG}" -ss ${ss} -i "${src}" -t ${duration.toFixed(6)} -vf "setpts=PTS-STARTPTS" -af "asetpts=PTS-STARTPTS" -c:v libx264 -preset fast -crf 18 -c:a aac -b:a 192k "${out}" -y`,
    { stdio: 'inherit' }
  );

  // Verify
  const startPts = execSync(`"${FFPROBE}" -v quiet -select_streams v:0 -show_entries packet=pts_time -of csv=p=0 "${out}"`).toString().trim().split('\n')[0];
  const dur = execSync(`"${FFPROBE}" -v quiet -show_entries format=duration -of csv=p=0 "${out}"`).toString().trim();
  console.log(`  → PTS start=${startPts}s dur=${dur}s ✓\n`);
}

console.log('Done. Re-building concat...');
