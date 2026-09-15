// fase2_edl.mjs — FASE 2: recorte silencias EDL
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const NORM = path.join(ROOT, 'input', 'normalized');
const OUT = path.join(ROOT, 'output');
fs.mkdirSync(OUT, { recursive: true });

const FFMPEG  = 'C:\\Users\\cgil\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffmpeg.exe';
const FFPROBE = 'C:\\Users\\cgil\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffprobe.exe';

// Keep intervals translated to source clip times (from merged timeline analysis)
// Each: { clip, ss, to } — all times are in clip-local time (not merged timeline)
const SEGMENTS = [
  { clip: 'IMG_0761_portrait.mp4', ss: 0.000, to: 7.770 },   // merged 0.000→7.770
  { clip: 'IMG_0767_portrait.mp4', ss: 0.867, to: 12.847 },  // merged 10.900→22.880
  { clip: 'IMG_0770_portrait.mp4', ss: 0.313, to: 17.663 },  // merged 23.880→41.230
  { clip: 'IMG_0772_portrait.mp4', ss: 2.207, to: 9.567  },  // merged 44.280→51.640
  { clip: 'IMG_0775_portrait.mp4', ss: 1.060, to: 10.750 },  // merged 54.270→63.960
  { clip: 'IMG_0778_portrait.mp4', ss: 0.400, to: 10.270 },  // merged 65.910→75.780
  { clip: 'IMG_0779_portrait.mp4', ss: 0.000, to: 9.970  },  // merged 75.780→85.750
  { clip: 'IMG_0780_portrait.mp4', ss: 1.603, to: 6.023  },  // merged 87.950→92.370
  { clip: 'IMG_0783_portrait.mp4', ss: 1.967, to: 9.617  },  // merged 95.880→103.530
  { clip: 'IMG_0783_portrait.mp4', ss: 10.987, to: 14.907 }, // merged 104.900→108.820
  { clip: 'IMG_0785_portrait.mp4', ss: 1.177, to: 7.527  },  // merged 110.690→117.040
];

console.log(`\n── FASE 2: ${SEGMENTS.length} segmentos a extraer ──\n`);

const segPaths = [];
for (let i = 0; i < SEGMENTS.length; i++) {
  const seg = SEGMENTS[i];
  const segName = `seg_${String(i+1).padStart(2,'0')}.mp4`;
  const segPath = path.join(OUT, 'edl_segs', segName);
  fs.mkdirSync(path.join(OUT, 'edl_segs'), { recursive: true });

  const src = path.join(NORM, seg.clip);
  const dur = (seg.to - seg.ss).toFixed(2);
  process.stdout.write(`  [${i+1}] ${seg.clip} ${seg.ss.toFixed(3)}→${seg.to.toFixed(3)} (${dur}s)... `);

  execSync(
    `"${FFMPEG}" -i "${src}" -ss ${seg.ss} -to ${seg.to} ` +
    `-c:v libx264 -preset fast -crf 18 -c:a aac -b:a 192k "${segPath}" -y`,
    { stdio: 'pipe' }
  );
  console.log('✓');
  segPaths.push(segPath);
}

// Concat list
const listPath = path.join(OUT, 'edl_segs', 'concat_list.txt');
fs.writeFileSync(listPath, segPaths.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n'));

// Concat all segments
const editedPath = path.join(OUT, 'edl_edited.mp4');
console.log('\nConcatenando segmentos...');
execSync(
  `"${FFMPEG}" -f concat -safe 0 -i "${listPath}" -c:v copy -c:a aac -b:a 192k "${editedPath}" -y`,
  { stdio: 'inherit' }
);

// Validate
const dur = parseFloat(execSync(
  `"${FFPROBE}" -v quiet -show_entries format=duration -of csv=p=0 "${editedPath}"`
).toString().trim());
console.log(`\n✓ edl_edited.mp4 — Duración: ${dur.toFixed(2)}s (esperado: ~96s)`);

// Silence check
const silCount = execSync(
  `"${FFMPEG}" -i "${editedPath}" -af silencedetect=n=-50dB:d=2 -f null - 2>&1`,
  { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
).match(/silence_start/g)?.length ?? 0;
console.log(`  Silencios largos detectados: ${silCount} ${silCount > 5 ? '⚠️ revisar' : '✓'}`);
