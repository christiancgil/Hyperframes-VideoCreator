// EDL Restaurant Reel — Sync audio segments to AI clips
// Run: node scripts/sync_restaurante.mjs

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const FFMPEG  = process.env.FFMPEG_BIN  || 'C:\\Users\\cgil\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffmpeg.exe';
const FFPROBE = process.env.FFPROBE_BIN || 'C:\\Users\\cgil\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffprobe.exe';

const AUDIO_SRC = path.join(ROOT, 'output', 'edl_restaurante_audio.mp3');
const CLIPS_DIR = path.join(ROOT, 'input', 'Clips');
const OUT_DIR   = path.join(ROOT, 'output', 'edl_restaurante');
const OUTPUT    = path.join(ROOT, 'output', 'edl_restaurante_final.mp4');

fs.mkdirSync(OUT_DIR, { recursive: true });

// 13 scenes: clip filename (partial), audio start, audio end (seconds)
// Split points derived from Whisper word timestamps:
//   ESCENA_6/7 split: word "2." starts at 58.80s → split at 58.4s
//   ESCENA_10/11 split: word "6." starts at 102.0s → split at 101.8s
const SCENES = [
  { n:  1, clip: 'ESCENA_1',  start:   2.47, end:   8.26 },
  { n:  2, clip: 'ESCENA_2',  start:  13.19, end:  22.10 },
  { n:  3, clip: 'ESCENA_3',  start:  24.29, end:  29.96 },
  { n:  4, clip: 'ESCENA_4',  start:  32.01, end:  39.35 },
  { n:  5, clip: 'ESCENA_5',  start:  42.18, end:  49.27 },
  { n:  6, clip: 'ESCENA_6',  start:  51.44, end:  58.40 },
  { n:  7, clip: 'ESCENA_7',  start:  58.40, end:  66.25 },
  { n:  8, clip: 'ESCENA_8',  start:  68.22, end:  79.58 },
  { n:  9, clip: 'ESCENA_9',  start:  81.58, end:  88.88 },
  { n: 10, clip: 'ESCENA_10', start:  91.59, end: 101.80 },
  { n: 11, clip: 'ESCENA_11', start: 101.80, end: 107.80 },
  { n: 12, clip: 'ESCENA_12', start: 110.04, end: 123.95 },
  { n: 13, clip: 'ESCENA_13', start: 126.24, end: 130.14 },
];

function findClip(prefix) {
  const files = fs.readdirSync(CLIPS_DIR);
  const match = files.find(f => f.startsWith(prefix) && f.endsWith('.mp4'));
  if (!match) throw new Error(`Clip not found for prefix: ${prefix}`);
  return path.join(CLIPS_DIR, match);
}

const scenePaths = [];

for (const scene of SCENES) {
  const audioDur = +(scene.end - scene.start).toFixed(3);
  const clipSrc  = findClip(scene.clip);
  const clipDur  = parseFloat(
    execSync(`"${FFPROBE}" -v quiet -show_entries format=duration -of csv=p=0 "${clipSrc}"`).toString().trim()
  );

  const pad = String(scene.n).padStart(2, '0');
  const audioOut = path.join(OUT_DIR, `scene_${pad}_audio.aac`);
  const videoOut = path.join(OUT_DIR, `scene_${pad}_video.mp4`);
  const sceneOut = path.join(OUT_DIR, `scene_${pad}.mp4`);
  scenePaths.push(sceneOut);

  console.log(`\nSCENA ${scene.n}: audio ${audioDur.toFixed(2)}s | clip ${clipDur.toFixed(2)}s`);

  // 1. Extract audio segment
  execSync(`"${FFMPEG}" -i "${AUDIO_SRC}" -ss ${scene.start} -to ${scene.end} -c:a aac -b:a 192k "${audioOut}" -y`, { stdio: 'inherit' });

  // 2. Loop/trim video clip to match audio duration
  if (clipDur >= audioDur) {
    // Clip is long enough — just trim
    execSync(`"${FFMPEG}" -i "${clipSrc}" -t ${audioDur} -c:v libx264 -preset fast -crf 20 -an "${videoOut}" -y`, { stdio: 'inherit' });
  } else {
    // Clip is shorter — loop it
    const loopCount = Math.ceil(audioDur / clipDur) + 1;
    execSync(`"${FFMPEG}" -stream_loop ${loopCount} -i "${clipSrc}" -t ${audioDur} -c:v libx264 -preset fast -crf 20 -an "${videoOut}" -y`, { stdio: 'inherit' });
  }

  // 3. Combine looped video + audio segment into scene
  execSync(`"${FFMPEG}" -i "${videoOut}" -i "${audioOut}" -c:v copy -c:a copy -map 0:v -map 1:a -shortest "${sceneOut}" -y`, { stdio: 'inherit' });

  const dur = execSync(`"${FFPROBE}" -v quiet -show_entries format=duration -of csv=p=0 "${sceneOut}"`).toString().trim();
  console.log(`  → scene_${scene.n}.mp4 duración: ${parseFloat(dur).toFixed(2)}s ✓`);
}

// 4. Concatenate all 13 scenes
console.log('\nConcatenando 13 escenas...');
const listFile = path.join(OUT_DIR, 'concat_list.txt');
fs.writeFileSync(listFile, scenePaths.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n'), 'utf8');

execSync(
  `"${FFMPEG}" -f concat -safe 0 -i "${listFile}" -c:v libx264 -preset slow -crf 18 -c:a aac -b:a 192k -movflags +faststart "${OUTPUT}" -y`,
  { stdio: 'inherit' }
);

const finalDur = execSync(`"${FFPROBE}" -v quiet -show_entries format=duration -of csv=p=0 "${OUTPUT}"`).toString().trim();
console.log(`\n✓ ${path.basename(OUTPUT)} — ${parseFloat(finalDur).toFixed(2)}s`);

// 5. Extract 3 verification frames
execSync(
  `"${FFMPEG}" -i "${OUTPUT}" -vf "select='eq(n,24)+eq(n,180)+eq(n,360)'" -vsync 0 "${path.join(ROOT, 'output')}/restaurante_verify_%d.png" -y`,
  { stdio: 'inherit' }
);
console.log('✓ Frames de verificación generados');
