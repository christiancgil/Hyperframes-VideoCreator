import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const FFMPEG = 'C:\\Users\\cgil\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffmpeg.exe';
const FFPROBE = 'C:\\Users\\cgil\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffprobe.exe';
const VIDEO_W = 1080, VIDEO_H = 1920, FPS = 30;

const htmlPath = path.join(ROOT, 'output', 'compositions', 'IMG_6460_voiceover', 'beat_06.html');
const frameDir = path.join(ROOT, 'output', 'verify', 'beat_frames', 'beat_6_v2');
const outputMov = path.join(ROOT, 'output', 'overlays', 'beat_6.mov');

fs.mkdirSync(frameDir, { recursive: true });

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu', '--font-render-hinting=none'] });
const page = await browser.newPage();
await page.setViewport({ width: VIDEO_W, height: VIDEO_H });
await page.goto('file:///' + htmlPath.replace(/\\/g, '/'), { waitUntil: 'networkidle0', timeout: 15000 });
await page.evaluate(() => {
  document.documentElement.style.background = 'transparent';
  document.body.style.background = 'transparent';
  document.body.style.margin = '0';
});
await page.evaluate(() => document.fonts.ready);
await new Promise(r => setTimeout(r, 300));

const totalFrames = Math.ceil(6.0 * FPS);
console.log(`Rendering beat_06 — ${totalFrames} frames`);
for (let f = 0; f < totalFrames; f++) {
  const framePath = path.join(frameDir, `frame_${String(f).padStart(4, '0')}.png`);
  await page.screenshot({ path: framePath, omitBackground: true });
  await new Promise(r => setTimeout(r, Math.floor(1000 / FPS)));
}
await page.close();
await browser.close();

console.log('Encoding → ProRes 4444...');
execSync(`"${FFMPEG}" -framerate ${FPS} -i "${path.join(frameDir, 'frame_%04d.png')}" -c:v prores_ks -profile:v 4 -pix_fmt yuva444p12le "${outputMov}" -y`, { stdio: 'pipe' });

const pix = execSync(`"${FFPROBE}" -v quiet -select_streams v:0 -show_entries stream=pix_fmt -of csv=p=0 "${outputMov}"`).toString().trim();
console.log(`✓ beat_6.mov — ${pix}`);
