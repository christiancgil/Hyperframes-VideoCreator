// EDL Restaurante v2 — sync TTS audio (ElevenLabs) with AI clips
// Run: node scripts/sync_restaurante_tts.mjs

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const FFMPEG  = process.env.FFMPEG_BIN  || 'C:\\Users\\cgil\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffmpeg.exe';
const FFPROBE = process.env.FFPROBE_BIN || 'C:\\Users\\cgil\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffprobe.exe';

const TTS_DIR   = path.join(ROOT, 'output', 'edl_tts');
const CLIPS_DIR = path.join(ROOT, 'input', 'Clips');
const OUT_DIR   = path.join(ROOT, 'output', 'edl_restaurante_v2');
const OUTPUT    = path.join(ROOT, 'output', 'edl_restaurante_v2_base.mp4');

fs.mkdirSync(OUT_DIR, { recursive: true });

// TTS durations (from ffprobe above)
const SCENES = [
  { n:  1, clip: 'ESCENA_1',  dur:  4.32 },
  { n:  2, clip: 'ESCENA_2',  dur:  7.34 },
  { n:  3, clip: 'ESCENA_3',  dur:  5.90 },
  { n:  4, clip: 'ESCENA_4',  dur:  5.90 },
  { n:  5, clip: 'ESCENA_5',  dur:  6.41 },
  { n:  6, clip: 'ESCENA_6',  dur:  4.92 },
  { n:  7, clip: 'ESCENA_7',  dur:  5.76 },
  { n:  8, clip: 'ESCENA_8',  dur: 10.22 },
  { n:  9, clip: 'ESCENA_9',  dur:  7.89 },
  { n: 10, clip: 'ESCENA_10', dur:  7.43 },
  { n: 11, clip: 'ESCENA_11', dur:  7.66 },
  { n: 12, clip: 'ESCENA_12', dur: 14.21 },
  { n: 13, clip: 'ESCENA_13', dur:  3.67 },
];

function findClip(prefix) {
  const files = fs.readdirSync(CLIPS_DIR);
  const match = files.find(f => f.startsWith(prefix) && f.endsWith('.mp4'));
  if (!match) throw new Error(`Clip no encontrado: ${prefix}`);
  return path.join(CLIPS_DIR, match);
}

const scenePaths = [];

for (const scene of SCENES) {
  const pad      = String(scene.n).padStart(2, '0');
  const audioSrc = path.join(TTS_DIR, `scene_${pad}.mp3`);
  const clipSrc  = findClip(scene.clip);
  const videoOut = path.join(OUT_DIR, `scene_${pad}_video.mp4`);
  const sceneOut = path.join(OUT_DIR, `scene_${pad}.mp4`);
  scenePaths.push(sceneOut);

  const clipDur = parseFloat(
    execSync(`"${FFPROBE}" -v quiet -show_entries format=duration -of csv=p=0 "${clipSrc}"`).toString().trim()
  );

  console.log(`\nEscena ${pad}: TTS ${scene.dur.toFixed(2)}s | clip ${clipDur.toFixed(2)}s`);

  // Loop clip to match TTS duration
  if (clipDur >= scene.dur) {
    execSync(`"${FFMPEG}" -i "${clipSrc}" -t ${scene.dur} -c:v libx264 -preset fast -crf 20 -an "${videoOut}" -y`, { stdio: 'pipe' });
  } else {
    const loops = Math.ceil(scene.dur / clipDur) + 1;
    execSync(`"${FFMPEG}" -stream_loop ${loops} -i "${clipSrc}" -t ${scene.dur} -c:v libx264 -preset fast -crf 20 -an "${videoOut}" -y`, { stdio: 'pipe' });
  }

  // Combine video + TTS audio
  execSync(`"${FFMPEG}" -i "${videoOut}" -i "${audioSrc}" -c:v copy -c:a aac -b:a 192k -map 0:v -map 1:a -shortest "${sceneOut}" -y`, { stdio: 'pipe' });

  const dur = execSync(`"${FFPROBE}" -v quiet -show_entries format=duration -of csv=p=0 "${sceneOut}"`).toString().trim();
  console.log(`  → scene_${pad}.mp4  ${parseFloat(dur).toFixed(2)}s ✓`);
}

// Concatenar 13 escenas
console.log('\nConcatenando...');
const listFile = path.join(OUT_DIR, 'concat_list.txt');
fs.writeFileSync(listFile, scenePaths.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n'), 'utf8');

execSync(
  `"${FFMPEG}" -f concat -safe 0 -i "${listFile}" -c:v libx264 -preset slow -crf 18 -c:a aac -b:a 192k -movflags +faststart "${OUTPUT}" -y`,
  { stdio: 'pipe' }
);

const finalDur = execSync(`"${FFPROBE}" -v quiet -show_entries format=duration -of csv=p=0 "${OUTPUT}"`).toString().trim();
console.log(`\n✓ ${path.basename(OUTPUT)} — ${parseFloat(finalDur).toFixed(2)}s`);
