import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const FFMPEG = 'C:\\Users\\cgil\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffmpeg.exe';

const BEATS = [
  [ 0.3,  3.5],  // beat_1: reloj intro (era beat_07)
  [ 4.5,  4.5],  // beat_2: headline (era beat_01, +4s)
  [ 9.5,  8.5],  // beat_3: card features (era beat_02, +4s)
  [18.5,  6.0],  // beat_4: lienzo único (era beat_03, +4s)
  [25.5,  2.5],  // beat_5: miles de diseños (era beat_04, +4s)
  [31.5,  5.5],  // beat_6: IA card (era beat_05, +4s)
  [37.5,  3.5],  // beat_7: cada mirada (era beat_06, recortado a 3.5s)
];

const baseVideo = path.join(ROOT, 'output', 'IMG_6460_voiceover_v2.mp4');
const outputFinal = path.join(ROOT, 'output', 'IMG_6460_voiceover_final.mp4');
const OVERLAYS_DIR = path.join(ROOT, 'output', 'overlays');

let filterParts = [];
let inputArgs = [`-i "${baseVideo}"`];

// HDR (HLG/BT.2020 10-bit) → SDR (BT.709 8-bit) tone mapping
filterParts.push(
  `[0:v]zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,` +
  `tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p[base]`
);

BEATS.forEach(([startTime, duration], i) => {
  const beatFile = path.join(OVERLAYS_DIR, `beat_${i + 1}.mov`);
  inputArgs.push(`-i "${beatFile}"`);
  const prev = i === 0 ? 'base' : `v${i}`;
  const next = i === BEATS.length - 1 ? 'vout' : `v${i + 1}`;
  filterParts.push(
    `[${i + 1}:v]setpts=PTS+${startTime}/TB[ov${i}];` +
    `[${prev}][ov${i}]overlay=0:0:enable='between(t,${startTime},${startTime + duration})'[${next}]`
  );
});

const filter = filterParts.join('; ');
const inputs = inputArgs.join(' ');
const cmd = `"${FFMPEG}" ${inputs} -filter_complex "${filter}" -map "[vout]" -map "0:a" -c:v libx264 -preset slow -crf 18 -color_primaries bt709 -color_trc bt709 -colorspace bt709 -c:a copy "${outputFinal}" -y`;

console.log('Compositando con overlays rotados...');
execSync(cmd, { stdio: 'inherit' });
console.log(`\n✓ Vídeo final: ${outputFinal}`);
