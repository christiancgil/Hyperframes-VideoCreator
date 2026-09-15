#!/bin/bash
set -euo pipefail
PROJECT="$1"
BASE=/opt/hyperframes
FFMPEG=/usr/bin/ffmpeg
FFPROBE=/usr/bin/ffprobe
CHROMIUM=$(which chromium 2>/dev/null || which chromium-browser 2>/dev/null || echo "chromium")

log() { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$BASE/projects/$PROJECT/pipeline.log"; }

BEATS_FILE="$BASE/projects/$PROJECT/beats_with_paths.json"
[ ! -f "$BEATS_FILE" ] && echo "ERROR: beats_with_paths.json no encontrado" && exit 1

COMP_DIR="$BASE/output/compositions/$PROJECT"
EDITED_VIDEO="$BASE/output/${PROJECT}_edited.mp4"
[ ! -f "$EDITED_VIDEO" ] && EDITED_VIDEO="$BASE/output/merged.mp4"
FINAL_VIDEO="$BASE/output/${PROJECT}_final.mp4"

log "Renderizando beats con Puppeteer..."

# Renderizar cada beat HTML → ProRes 4444
node --input-type=module <<EOF 2>>"$BASE/projects/$PROJECT/pipeline.log"
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const { beats, video_w, video_h, fps } = JSON.parse(fs.readFileSync('$BEATS_FILE', 'utf8'));
const COMP_DIR = '$COMP_DIR';
const FFMPEG = '$FFMPEG';
const CHROMIUM = '$CHROMIUM';

let puppeteer;
try {
  const pkg = JSON.parse(fs.readFileSync('/opt/hyperframes/node_modules/puppeteer/package.json', 'utf8'));
  puppeteer = (await import('/opt/hyperframes/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js')).default;
} catch {
  try { puppeteer = (await import('puppeteer')).default; }
  catch(e) { console.error('Puppeteer no disponible:', e.message); process.exit(1); }
}

const browser = await puppeteer.launch({
  executablePath: CHROMIUM,
  args: ['--no-sandbox','--disable-setuid-sandbox','--disable-gpu','--disable-dev-shm-usage','--headless=new','--allow-file-access-from-files','--disable-web-security']
});

for (const beat of beats || []) {
  if (!beat.html_content) { console.log(\`Saltando \${beat.id}: sin html_content\`); continue; }

  const framesDir = path.join(COMP_DIR, \`frames_\${beat.id}\`);
  fs.mkdirSync(framesDir, { recursive: true });

  const page = await browser.newPage();
  await page.setViewport({ width: video_w, height: video_h, deviceScaleFactor: 1 });
  await page.setContent(beat.html_content, { waitUntil: 'load', timeout: 30000 });
  await page.evaluate(() => { document.body.style.background = 'transparent'; });

  const totalFrames = Math.ceil(beat.duration * fps);
  for (let f = 0; f < totalFrames; f++) {
    await page.screenshot({
      path: path.join(framesDir, \`frame_\${String(f).padStart(4,'0')}.png\`),
      omitBackground: true
    });
    if (totalFrames > 30 && f % 30 === 0) console.log(\`  \${beat.id}: \${f}/\${totalFrames} frames\`);
  }
  await page.close();

  const movFile = path.join(COMP_DIR, \`\${beat.id}.mov\`);
  execSync(\`\${FFMPEG} -framerate \${fps} -i "\${framesDir}/frame_%04d.png" -c:v prores_ks -profile:v 4 -pix_fmt yuva444p12le "\${movFile}" -y 2>/dev/null\`);
  execSync(\`rm -rf "\${framesDir}"\`);
  console.log(\`Renderizado: \${beat.id} → \${movFile}\`);
}

await browser.close();
EOF

log "Beats renderizados. Compositando vídeo final..."

# Construir filtro de compositing dinámicamente
node --input-type=module <<'EOF2' > /tmp/composite_cmd_${PROJECT}.sh
import fs from 'fs';
const { beats } = JSON.parse(fs.readFileSync(process.env.BEATS_FILE));
const compDir = process.env.COMP_DIR;
const ffmpeg = process.env.FFMPEG;
const editedVideo = process.env.EDITED_VIDEO;
const finalVideo = process.env.FINAL_VIDEO;

let inputs = [`-i "${editedVideo}"`];
let filterParts = [];
let lastOut = '0:v';
let idx = 1;

for (const beat of beats || []) {
  const mov = `${compDir}/${beat.id}.mov`;
  if (!fs.existsSync(mov)) continue;
  const end = beat.start + beat.duration;
  inputs.push(`-i "${mov}"`);
  filterParts.push(`[${idx}:v]setpts=PTS+${beat.start}/TB[ov${idx}]`);
  filterParts.push(`[${lastOut}][ov${idx}]overlay=0:0:enable='between(t,${beat.start},${end})'[v${idx}]`);
  lastOut = `v${idx}`;
  idx++;
}

if (filterParts.length === 0) {
  console.log(`${ffmpeg} -i "${editedVideo}" -c copy "${finalVideo}" -y`);
} else {
  const filter = filterParts.join(';');
  console.log(`${ffmpeg} ${inputs.join(' ')} -filter_complex "${filter}" -map "[${lastOut}]" -map 0:a -c:v libx264 -preset slow -crf 18 -c:a copy "${finalVideo}" -y`);
}
EOF2

export BEATS_FILE="$BASE/projects/$PROJECT/beats_with_paths.json"
export COMP_DIR="$COMP_DIR"
export FFMPEG="$FFMPEG"
export EDITED_VIDEO="$EDITED_VIDEO"
export FINAL_VIDEO="$FINAL_VIDEO"

COMPOSITE_CMD=$(node --input-type=module /tmp/composite_cmd_${PROJECT}.sh 2>/dev/null || echo "")

if [ -n "$COMPOSITE_CMD" ]; then
  log "Ejecutando compositing..."
  eval "$COMPOSITE_CMD" 2>>"$BASE/projects/$PROJECT/pipeline.log"
else
  cp "$EDITED_VIDEO" "$FINAL_VIDEO"
fi

rm -f /tmp/composite_cmd_${PROJECT}.sh

# Extraer frames de preview
$FFMPEG -i "$FINAL_VIDEO" \
  -vf "select='eq(n,30)+eq(n,150)+eq(n,300)'" -vsync 0 \
  "$BASE/projects/$PROJECT/preview_%d.png" -y \
  2>/dev/null || true

DURATION=$($FFPROBE -v quiet -show_entries format=duration -of csv=p=0 "$FINAL_VIDEO")
log "Render completo: $FINAL_VIDEO (${DURATION}s)"
