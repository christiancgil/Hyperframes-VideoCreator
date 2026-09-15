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

  // Take a single screenshot after CSS animations complete (all are <1s).
  // Repeated screenshots in headless Chrome software-rendering crash at ~90 frames.
  // The overlay content visibility matters more than the 0.3s entry animation.
  const browser = await puppeteer.launch({ executablePath: CHROMIUM, args: LAUNCH_ARGS });
  const page = await browser.newPage();
  await page.setViewport({ width: render_w, height: render_h, deviceScaleFactor: 1 });
  await page.setContent(scaledHtml, { waitUntil: 'load', timeout: 30000 });
  await page.evaluate(() => { document.body.style.background = 'transparent'; });
  // Wait 1.5s for all CSS animations to complete and reach their final state
  await new Promise(r => setTimeout(r, 1500));

  const frameFile = path.join(COMP_DIR, \`\${beat.id}_frame.png\`);
  await page.screenshot({ path: frameFile, omitBackground: true });
  await page.close();
  await browser.close();

  // Loop the single frame to full beat duration at source framerate
  const scaleFilter = scale < 1 ? \`-vf scale=\${video_w}:\${video_h}\` : '';
  execSync(\`\${FFMPEG} -loop 1 -framerate \${fps} -i "\${frameFile}" -t \${beat.duration} \${scaleFilter} -c:v prores_ks -profile:v 4 -pix_fmt yuva444p12le "\${movFile}" -y 2>/dev/null\`);
  execSync(\`rm -f "\${frameFile}"\`);
  execSync(\`rm -rf "\${framesDir}"\`);
  console.log(\`Renderizado: \${beat.id} → \${movFile} (\${beat.duration}s)\`);
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
  filterParts.push(\`[\${idx}:v]setpts=PTS+\${beat.start}/TB[ov\${idx}]\`);
  filterParts.push(\`[\${lastOut}][ov\${idx}]overlay=0:0:enable='between(t,\${beat.start},\${end})'[v\${idx}]\`);
  lastOut = \`v\${idx}\`;
  idx++;
}

if (filterParts.length === 0) {
  console.log('No beats con .mov — copiando editado como final');
  fs.copyFileSync(editedVideo, finalVideo);
} else {
  const filter = filterParts.join(';');
  const cmd = \`\${ffmpeg} \${inputs.join(' ')} -filter_complex "\${filter}" -map "[\${lastOut}]" -map 0:a -c:v libx264 -preset slow -crf 18 -c:a copy "\${finalVideo}" -y\`;
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
