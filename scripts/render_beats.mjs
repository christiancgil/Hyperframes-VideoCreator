import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const FFMPEG = 'C:\\Users\\cgil\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffmpeg.exe';
const FFPROBE = 'C:\\Users\\cgil\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffprobe.exe';

const VIDEO_W = 1080;
const VIDEO_H = 1920;
const FPS = 30;

// Beat definitions: [htmlFile, startTime, duration]
const BEATS = [
  ['beat_01.html',  0.5,   4.5],
  ['beat_02.html',  5.5,   8.5],
  ['beat_03.html', 14.5,   6.0],
  ['beat_04.html', 21.5,   2.5],
  ['beat_05.html', 27.5,   5.5],
  ['beat_06.html', 33.5,   6.0],
  ['beat_07.html', 39.5,   1.5],
];

const COMPOSITIONS_DIR = path.join(ROOT, 'output', 'compositions', 'IMG_6460_voiceover');
const FRAMES_DIR = path.join(ROOT, 'output', 'verify', 'beat_frames');
const OVERLAYS_DIR = path.join(ROOT, 'output', 'overlays');

fs.mkdirSync(FRAMES_DIR, { recursive: true });
fs.mkdirSync(OVERLAYS_DIR, { recursive: true });

async function renderBeat(browser, htmlFile, beatIndex, durationSecs) {
  const htmlPath = path.join(COMPOSITIONS_DIR, htmlFile);
  const frameDir = path.join(FRAMES_DIR, `beat_${beatIndex}`);
  fs.mkdirSync(frameDir, { recursive: true });

  const page = await browser.newPage();
  await page.setViewport({ width: VIDEO_W, height: VIDEO_H });

  const fileUrl = `file:///${htmlPath.replace(/\\/g, '/')}`;
  await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 15000 });
  await page.evaluate(() => {
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
    document.body.style.margin = '0';
  });

  // Wait for fonts
  await page.evaluate(() => document.fonts.ready);
  await new Promise(r => setTimeout(r, 300));

  const totalFrames = Math.ceil(durationSecs * FPS);
  console.log(`  Beat ${beatIndex}: ${htmlFile} — ${totalFrames} frames`);

  for (let f = 0; f < totalFrames; f++) {
    const framePath = path.join(frameDir, `frame_${String(f).padStart(4, '0')}.png`);
    await page.screenshot({ path: framePath, omitBackground: true });
    // Small delay to let CSS animations progress (1000ms / FPS)
    await new Promise(r => setTimeout(r, Math.floor(1000 / FPS)));
  }

  await page.close();

  // Encode PNG frames → ProRes 4444
  const outputMov = path.join(OVERLAYS_DIR, `beat_${beatIndex}.mov`);
  const cmd = `"${FFMPEG}" -framerate ${FPS} -i "${path.join(frameDir, 'frame_%04d.png')}" -c:v prores_ks -profile:v 4 -pix_fmt yuva444p12le "${outputMov}" -y`;
  console.log(`  Encoding beat ${beatIndex} → ProRes 4444...`);
  execSync(cmd, { stdio: 'pipe' });

  // Verify pixel format
  const pix = execSync(`"${FFPROBE}" -v quiet -select_streams v:0 -show_entries stream=pix_fmt -of csv=p=0 "${outputMov}"`).toString().trim();
  if (pix !== 'yuva444p12le') throw new Error(`Beat ${beatIndex}: alfa incorrecto (${pix})`);

  console.log(`  ✓ Beat ${beatIndex} listo — ${pix}`);
  return outputMov;
}

async function compositeAll(beatFiles) {
  const baseVideo = path.join(ROOT, 'output', 'IMG_6460_voiceover.mp4');
  const outputFinal = path.join(ROOT, 'output', 'IMG_6460_voiceover_final.mp4');

  // Build complex filter: overlay each beat at its timestamp
  let filterParts = [];
  let inputArgs = [`-i "${baseVideo}"`];

  BEATS.forEach(([, startTime, duration], i) => {
    inputArgs.push(`-i "${beatFiles[i]}"`);
    const prev = i === 0 ? '0:v' : `v${i}`;
    const next = i === BEATS.length - 1 ? 'vout' : `v${i + 1}`;
    // transpose=1 rota el overlay 90° CW: de 1080×1920 → 1920×1080
    // para que coincida con el frame crudo del vídeo (rotation=-90 en metadata)
    filterParts.push(
      `[${i + 1}:v]transpose=1,setpts=PTS+${startTime}/TB[ov${i}];` +
      `[${prev}][ov${i}]overlay=0:0:enable='between(t,${startTime},${startTime + duration})'[${next}]`
    );
  });

  const filter = filterParts.join('; ');
  const inputs = inputArgs.join(' ');
  const cmd = `"${FFMPEG}" ${inputs} -filter_complex "${filter}" -map "[vout]" -map "0:a" -c:v libx264 -preset slow -crf 18 -c:a copy "${outputFinal}" -y`;

  console.log('\nCompositando vídeo final...');
  execSync(cmd, { stdio: 'inherit' });
  console.log(`\n✓ Vídeo final: ${outputFinal}`);
}

(async () => {
  console.log('Lanzando Puppeteer...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--font-render-hinting=none']
  });

  const beatFiles = [];
  for (let i = 0; i < BEATS.length; i++) {
    const [htmlFile, , duration] = BEATS[i];
    const mov = await renderBeat(browser, htmlFile, i + 1, duration);
    beatFiles.push(mov);
  }

  await browser.close();
  await compositeAll(beatFiles);
})();
