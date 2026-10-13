#!/bin/bash
set -euo pipefail
PROJECT="$1"
BASE=/opt/hyperframes
FFMPEG=/usr/bin/ffmpeg
FFPROBE=/usr/bin/ffprobe
# Use Puppeteer's bundled Chrome — the snap system chromium is AppArmor-confined
# and blocks process_vm_readv (syscall 330), crashing mid-render.
CHROMIUM=$(find /root/.cache/puppeteer -name 'chrome' -type f 2>/dev/null | head -1)
[ -z "$CHROMIUM" ] && CHROMIUM=$(which chromium 2>/dev/null || which chromium-browser 2>/dev/null || echo "chromium")

log() { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$BASE/projects/$PROJECT/pipeline.log"; }

BEATS_FILE="$BASE/projects/$PROJECT/beats_with_paths.json"
[ ! -f "$BEATS_FILE" ] && echo "ERROR: beats_with_paths.json no encontrado" && exit 1

COMP_DIR="$BASE/output/compositions/$PROJECT"
EDITED_VIDEO="$BASE/output/${PROJECT}_edited.mp4"
[ ! -f "$EDITED_VIDEO" ] && EDITED_VIDEO="$BASE/output/merged.mp4"
FINAL_VIDEO="$BASE/output/${PROJECT}_final.mp4"

log "Renderizando beats con Puppeteer... (Chrome: $CHROMIUM)"

# Renderizar cada beat HTML → ProRes 4444
node --input-type=module <<EOF 2>>"$BASE/projects/$PROJECT/pipeline.log"
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const { beats, video_w, video_h, fps } = JSON.parse(fs.readFileSync('$BEATS_FILE', 'utf8'));
const COMP_DIR = '$COMP_DIR';
const FFMPEG = '$FFMPEG';
const CHROMIUM = '$CHROMIUM';

// Cap render resolution to avoid Chrome OOM on 2-CPU VPS.
// CSS animations are vector-based — 1080p render quality is indistinguishable at 4K.
const MAX_W = 1920;
const scale = video_w > MAX_W ? MAX_W / video_w : 1;
const render_w = Math.round(video_w * scale);
const render_h = Math.round(video_h * scale);
// Render animations at 30fps — CSS transitions don't need 60fps.
const render_fps = Math.min(fps, 30);

let puppeteer;
try {
  puppeteer = (await import('/opt/hyperframes/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js')).default;
} catch {
  try { puppeteer = (await import('puppeteer')).default; }
  catch(e) { console.error('Puppeteer no disponible:', e.message); process.exit(1); }
}

const LAUNCH_ARGS = ['--no-sandbox','--disable-setuid-sandbox','--disable-gpu','--disable-dev-shm-usage','--headless=new','--allow-file-access-from-files','--disable-web-security'];

console.log(\`Chrome: \${CHROMIUM}\`);
console.log(\`Render config: \${render_w}x\${render_h} @ \${render_fps}fps (source: \${video_w}x\${video_h} @ \${fps}fps)\`);

for (const beat of beats || []) {
  if (!beat.html_content) { console.log(\`Saltando \${beat.id}: sin html_content\`); continue; }

  const movFile = path.join(COMP_DIR, \`\${beat.id}.mov\`);
  if (fs.existsSync(movFile)) { console.log(\`Saltando \${beat.id}: ya renderizado\`); continue; }

  // Patch HTML body dimensions to match render resolution
  const scaledHtml = beat.html_content
    .replace(/width:\s*\d+px/g, \`width: \${render_w}px\`)
    .replace(/height:\s*\d+px/g, \`height: \${render_h}px\`);

  // Multi-frame capture: take screenshots at key animation milestones so CSS
  // animations (card entry, bullet reveals, counters) are visible in the final video.
  // Each browser instance is fresh per beat — no cumulative crash risk.
  const browser = await puppeteer.launch({ executablePath: CHROMIUM, args: LAUNCH_ARGS });
  const page = await browser.newPage();
  await page.setViewport({ width: render_w, height: render_h, deviceScaleFactor: 1 });
  await page.setContent(scaledHtml, { waitUntil: 'networkidle2', timeout: 30000 });

  // After networkidle2, all CSS animations have already completed (fonts took 2-3s to load).
  // Restart them from t=0 using the reflow trick: set animation:none, force reflow, restore.
  await page.evaluate(() => {
    document.body.style.background = 'transparent';
    const animated = Array.from(document.querySelectorAll('*')).filter(el => {
      const s = window.getComputedStyle(el);
      return s.animationName && s.animationName !== 'none';
    });
    animated.forEach(el => { el.style.animation = 'none'; });
    document.body.offsetHeight; // single reflow — resets all animation states
    animated.forEach(el => { el.style.animation = ''; });
    // Also set opacity:0 on elements whose animation starts from opacity:0
    // so the very first snapshot (0ms) captures the pre-animation blank state
  });

  // Snapshot timestamps (ms): capture card-entry, staggered item reveals, final hold.
  // Spaced to cover typical CSS animation durations (entry 0.3s, reveals every 0.8s).
  const SNAP_MS = [0, 80, 200, 380, 600, 900, 1300, 1900, 2700, 3600, 4600];
  const snapFrames = [];
  let elapsed = 0;
  for (const targetMs of SNAP_MS) {
    const wait = targetMs - elapsed;
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    const fp = path.join(COMP_DIR, \`\${beat.id}_snap\${targetMs}.png\`);
    await page.screenshot({ path: fp, omitBackground: true });
    snapFrames.push({ path: fp, ms: targetMs });
    elapsed = targetMs;
  }
  await page.close();
  await browser.close();

  // Build a concat input file: each snapshot is held until the next, last frame
  // fills the rest of the beat duration. Scale up to source resolution if needed.
  const scaleFilter = scale < 1 ? \`,scale=\${video_w}:\${video_h}\` : '';
  const concatFile = path.join(COMP_DIR, \`\${beat.id}_concat.txt\`);
  let concatLines = '';
  for (let i = 0; i < snapFrames.length; i++) {
    const holdSec = i < snapFrames.length - 1
      ? (snapFrames[i + 1].ms - snapFrames[i].ms) / 1000
      : Math.max(0.04, beat.duration - snapFrames[i].ms / 1000);
    concatLines += \`file '\${snapFrames[i].path}'\nduration \${holdSec.toFixed(3)}\n\`;
  }
  // ffmpeg concat demuxer needs the last file repeated without duration to flush
  concatLines += \`file '\${snapFrames[snapFrames.length - 1].path}'\n\`;
  fs.writeFileSync(concatFile, concatLines);

  // -color_range tv: mark ProRes as limited-range (matches source video) so overlay blending stays in the same range.
  // Without this tag, ffmpeg assumes full-range when reading the ProRes, mixing 0-255 onto 16-235 → bright artifacts.
  execSync(\`\${FFMPEG} -f concat -safe 0 -i "\${concatFile}" -vf "format=yuva420p\${scaleFilter},format=yuva444p12le" -c:v prores_ks -profile:v 4 -pix_fmt yuva444p12le -color_range tv "\${movFile}" -y 2>/dev/null\`);

  // Clean up snapshot PNGs and concat list
  for (const f of snapFrames) fs.unlinkSync(f.path);
  fs.unlinkSync(concatFile);
  console.log(\`Renderizado: \${beat.id} → \${movFile} (\${beat.duration}s, \${snapFrames.length} frames)\`);
}
EOF

log "Beats renderizados. Compositando vídeo final..."

# Compositing: generate ffmpeg command from beats JSON and execute in one Node.js pass.
# Uses <<EOF (no single-quote) so bash injects the paths via variable substitution.
node --input-type=module <<EOF 2>>"$BASE/projects/$PROJECT/pipeline.log"
import fs from 'fs';
import { execSync } from 'child_process';

const { beats } = JSON.parse(fs.readFileSync('$BEATS_FILE', 'utf8'));
const compDir = '$COMP_DIR';
const ffmpeg  = '$FFMPEG';
const editedVideo = '$EDITED_VIDEO';
const finalVideo  = '$FINAL_VIDEO';

let inputs     = [\`-i "\${editedVideo}"\`];
let filterParts = [];
let lastOut = '0:v';
let idx = 1;

for (const beat of beats || []) {
  const mov = \`\${compDir}/\${beat.id}.mov\`;
  if (!fs.existsSync(mov)) continue;
  const end = beat.start + beat.duration;
  inputs.push(\`-i "\${mov}"\`);
  // format=yuv420 on overlay output normalises to limited-range YUV before blending,
  // preventing full-range PNG pixels (from Puppeteer screenshots) from brightening the base video.
  filterParts.push(\`[\${idx}:v]format=yuva420p,setpts=PTS+\${beat.start}/TB[ov\${idx}]\`);
  filterParts.push(\`[\${lastOut}][ov\${idx}]overlay=0:0:format=yuv420:enable='between(t,\${beat.start},\${end})'[v\${idx}]\`);
  lastOut = \`v\${idx}\`;
  idx++;
}

if (filterParts.length === 0) {
  console.log('No beats con .mov — copiando editado como final');
  fs.copyFileSync(editedVideo, finalVideo);
} else {
  const filter = filterParts.join(';');
  // Preserve source color metadata — prevents players from misinterpreting range after overlay chain.
  const cmd = \`\${ffmpeg} \${inputs.join(' ')} -filter_complex "\${filter}" -map "[\${lastOut}]" -map 0:a -c:v libx264 -preset fast -crf 22 -pix_fmt yuv420p -color_range 1 -colorspace 1 -color_trc 1 -color_primaries 1 -c:a copy "\${finalVideo}" -y\`;
  console.log('Compositing cmd:', cmd.slice(0, 120) + '...');
  execSync(cmd, { stdio: ['pipe', 'inherit', 'inherit'] });
}
console.log('Compositing completo');
EOF

# Extraer frames de preview
$FFMPEG -i "$FINAL_VIDEO" \
  -vf "select='eq(n,30)+eq(n,150)+eq(n,300)'" -vsync 0 \
  "$BASE/projects/$PROJECT/preview_%d.png" -y \
  2>/dev/null || true

DURATION=$($FFPROBE -v quiet -show_entries format=duration -of csv=p=0 "$FINAL_VIDEO" | cut -d',' -f1 | tr -d '[:space:]')
log "Render completo: $FINAL_VIDEO (${DURATION}s)"
