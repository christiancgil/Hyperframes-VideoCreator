#!/usr/bin/env node
// Composita 8 beats ProRes 4444 sobre edited_hd.mp4 → dental-v3_final.mp4
const { spawnSync } = require('child_process');
const path = require('path');

const FFMPEG  = 'C:\\Users\\cgil\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffmpeg.exe';
const FFPROBE = FFMPEG.replace('ffmpeg.exe', 'ffprobe.exe');
const ROOT    = path.resolve(__dirname, '..');

const BASE  = path.join(ROOT, 'output', 'edit', 'edited_hd_v3.mp4');  // brazo s.32-33 eliminado
const RENDR = path.join(ROOT, 'output', 'compositions', 'dental-v3', 'renders');
const OUT   = path.join(ROOT, 'output', 'dental-v3_final_v8.mp4');
const BASE_DUR = 51.783;  // duración de edited_hd_v3.mp4 (brazo 3.mp4 + brazo 4.mp4 eliminados)

// Timestamps calculados del nuevo timeline (54.6s total, sin audio_events)
// [0.0-2.4]  "Más blancura no equivale a más salud"
// [2.4-5.0]  "Sabemos que todos quieren los dientes perfectos"
// [5.0-8.6]  "Por eso, cuando te ofrecen tratamientos flash..."
// [8.6-13.5] "es ahí cuando...daños irreversibles en los dientes"
// [13.5-19.4] "Por eso te recomiendo revisar la estabilidad..."
// [19.4-23.3] "y después, como mínimo, tienes que tener un control al año"
// [23.3-35.0] "Sé que esto es menos emocionante..."
// [35.0-39.8] "Con limpiezas profundas, resinas de última generación..."
// [39.8-42.0] "tratamientos mínimamente invasivos..."
// [42.0-46.8] "Con eso lograremos la transformación de tu sonrisa y de tu vida"
// [46.8-51.5] "Guarda este video si te gustó..."
// [51.5-54.6] "Bienvenido o bienvenida, y aquí te esperamos"
const BEATS = [
  { file: 'index.mov',    start: 0.0,  duration: 5.0 },   // INTRO: "Más blancura" → primeras palabras
  { file: 'beat_02.mov',  start: 9.0,  duration: 5.0 },   // ALERTA: "daños irreversibles" (seg4: 8.6-13.5)
  { file: 'beat_03.mov',  start: 14.0, duration: 5.0 },   // REC: "Por eso te recomiendo" (seg5: 13.5-19.4)
  { file: 'beat_04.mov',  start: 20.0, duration: 4.0 },   // STAT: "control al año" (seg6: 19.4-23.3)
  { file: 'beat_05.mov',  start: 32.10, duration: 7.0 },   // BULLETS: "Con limpiezas..." — shifted -2.90s total
  { file: 'beat_06.mov',  start: 39.10, duration: 5.0 },   // HIGHLIGHT: "transformación" — shifted -2.90s total
  { file: 'beat_07.mov',  start: 44.10, duration: 4.5 },   // CTA: "Guarda este video" — shifted -2.90s total
  { file: 'beat_08.mov',  start: 48.60, duration: 3.0 },   // CIERRE: "Bienvenido/bienvenida" — shifted -2.90s total
];

// Build -i args
const inputs = ['-i', BASE];
BEATS.forEach(b => { inputs.push('-i', path.join(RENDR, b.file)); });

// Build filter_complex
// Each overlay: [N:v]setpts=PTS+START/TB[ovN]; [prevLabel][ovN]overlay=...enable=...[vN]
let filterParts = [];
let prevLabel = '0:v';

BEATS.forEach((b, i) => {
  const n    = i + 1;  // input index (1-based, since 0 is base)
  const ovL  = `ov${n}`;
  const vL   = `v${n}`;
  const end  = b.start + b.duration;

  filterParts.push(
    `[${n}:v]setpts=PTS+${b.start}/TB[${ovL}]`,
    `[${prevLabel}][${ovL}]overlay=0:0:enable='between(t,${b.start},${end})'[${vL}]`
  );
  prevLabel = vL;
});

const filterComplex = filterParts.join('; ');
const finalLabel    = `v${BEATS.length}`;

const args = [
  '-y',
  ...inputs,
  '-filter_complex', filterComplex,
  '-map', `[${finalLabel}]`,
  '-map', '0:a',
  // Instagram Reel: H.264 CRF 17, 30fps, AAC 192k
  '-t', String(BASE_DUR),  // cap output at base video duration (previene extensión por eof repeat)
  '-c:v', 'libx264',
  '-preset', 'slow',
  '-crf', '17',
  '-r', '30',
  '-pix_fmt', 'yuv420p',
  '-c:a', 'aac',
  '-b:a', '192k',
  '-movflags', '+faststart',
  OUT,
];

console.log(`\nCompositando ${BEATS.length} beats sobre edited_hd.mp4...`);
console.log(`Output: ${OUT}\n`);

const r = spawnSync(FFMPEG, args, { stdio: 'inherit', maxBuffer: 100 * 1024 * 1024 });

if (r.status !== 0) {
  console.error(`\nERROR: ffmpeg salió con código ${r.status}`);
  process.exit(1);
}

// Verify output
const dur = spawnSync(FFPROBE, [
  '-v','quiet','-show_entries','format=duration','-of','csv=p=0', OUT
], { encoding: 'utf8' }).stdout.trim();

const sil = spawnSync(FFMPEG, [
  '-i', OUT, '-af', 'silencedetect=n=-50dB:d=2', '-f', 'null', '-'
], { encoding: 'utf8' }).stderr;
const silCount = (sil.match(/silence_start/g) || []).length;

console.log(`\n✓ dental-v3_final_v8.mp4`);
console.log(`  Duración: ${parseFloat(dur).toFixed(2)}s`);
console.log(`  Silencios largos (>2s): ${silCount}`);
if (silCount > 5) console.warn('  AVISO: posible problema de audio');
console.log('\nListo para verificación visual.');
