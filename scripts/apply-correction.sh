#!/bin/bash
# Aplica una corrección en texto natural y re-renderiza los beats afectados
set -euo pipefail

PROJECT="$1"
CORRECTION="$2"
CALLBACK_URL="${3:-}"

BASE=/opt/hyperframes
FFMPEG=/usr/bin/ffmpeg
FFPROBE=/usr/bin/ffprobe
CHROMIUM=$(which chromium 2>/dev/null || which chromium-browser 2>/dev/null || echo "chromium")

log()    { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$BASE/projects/$PROJECT/pipeline.log"; }
notify() { [ -n "$CALLBACK_URL" ] && curl -s -X POST "$CALLBACK_URL" -H "Content-Type: application/json" -d "$1" || true; }
fail()   { log "ERROR: $1"; notify "{\"status\":\"error\",\"project\":\"$PROJECT\",\"error\":\"$1\"}"; exit 1; }

BEATS_FILE="$BASE/projects/$PROJECT/beats_with_paths.json"
STYLE_FILE="$BASE/styles/client-style.md"
COMP_DIR="$BASE/output/compositions/$PROJECT"

[ ! -f "$BEATS_FILE" ] && fail "No hay beats guardados para $PROJECT"

log "=== CORRECCIÓN: $PROJECT ==="
log "Instrucción: $CORRECTION"

# Leer API key
ENV_CONTENT=$(cat "$BASE/.env")
OPENAI_KEY=$(echo "$ENV_CONTENT" | grep '^OPENAI_API_KEY=' | cut -d'=' -f2 | tr -d '[:space:]')

# Identificar qué beats afecta la corrección y regenerar sus HTMLs
node --input-type=module <<EOF 2>>"$BASE/projects/$PROJECT/pipeline.log"
import fs from 'fs';
import https from 'https';

const beatsData = JSON.parse(fs.readFileSync('$BEATS_FILE', 'utf8'));
const style = fs.readFileSync('$STYLE_FILE', 'utf8');
const apiKey = '$OPENAI_KEY';
const correction = '$CORRECTION';

async function callOpenAI(messages, json = false) {
  const body = JSON.stringify({
    model: 'gpt-4o',
    messages,
    ...(json ? { response_format: { type: 'json_object' } } : {}),
    temperature: 0.2
  });
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.openai.com', path: '/v1/chat/completions', method: 'POST',
      headers: { 'Authorization': \`Bearer \${apiKey}\`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let data = ''; res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data).choices[0].message.content));
    });
    req.on('error', reject); req.write(body); req.end();
  });
}

// Paso 1: Identificar qué beats afecta la corrección
const identifyPrompt = \`Tienes estos beats de motion graphics:
\${JSON.stringify(beatsData.beats, null, 2)}

El usuario pide esta corrección: "\${correction}"

Devuelve JSON con los IDs de los beats que hay que modificar y qué cambiar en cada uno:
{
  "affected_beats": [
    { "id": "beat_01", "changes": "descripción de qué cambiar" }
  ]
}\`;

const identified = JSON.parse(await callOpenAI([{ role: 'user', content: identifyPrompt }], true));
console.log('Beats afectados:', JSON.stringify(identified.affected_beats));

// Paso 2: Regenerar HTML de cada beat afectado
const { video_w, video_h } = beatsData;
for (const { id, changes } of identified.affected_beats || []) {
  const beat = beatsData.beats.find(b => b.id === id);
  if (!beat) { console.log(\`Beat \${id} no encontrado, saltando\`); continue; }

  // Aplicar cambios al beat
  const updatedBeatStr = await callOpenAI([{
    role: 'user',
    content: \`Beat actual: \${JSON.stringify(beat)}\\nCambios a aplicar: \${changes}\\nDevuelve el beat actualizado como JSON.\`
  }], true);
  const updatedBeat = JSON.parse(updatedBeatStr);
  const beatIdx = beatsData.beats.findIndex(b => b.id === id);
  if (beatIdx >= 0) beatsData.beats[beatIdx] = updatedBeat;

  // Regenerar HTML
  const html = await callOpenAI([{
    role: 'user',
    content: \`Genera el HTML completo para este beat de motion graphics.

ESTILO: \${style.substring(0, 2000)}
BEAT: \${JSON.stringify(updatedBeat)}
VIDEO: \${video_w}x\${video_h}px

Reglas ABSOLUTAS:
- body { background: transparent !important; width: \${video_w}px; height: \${video_h}px; margin:0; overflow:hidden; }
- Fuentes desde Google Fonts con <link> en <head>
- Animaciones con animation-fill-mode: forwards
- Nunca fondo sólido en body

Devuelve SOLO el HTML completo, sin markdown.\`
  }]);

  fs.writeFileSync(\`$COMP_DIR/compositions/\${id}.html\`, html);
  console.log(\`HTML regenerado: \${id}.html\`);
}

// Guardar beats actualizados
fs.writeFileSync('$BEATS_FILE', JSON.stringify(beatsData, null, 2));
fs.writeFileSync('/tmp/affected_beats_$PROJECT.json', JSON.stringify(identified.affected_beats || []));
EOF

log "HTMLs de corrección generados"

# Re-renderizar solo los beats afectados
AFFECTED=$(cat /tmp/affected_beats_${PROJECT}.json)
BEATS_DATA=$(node --input-type=module <<'EOF2'
import fs from 'fs';
const b = JSON.parse(fs.readFileSync('/opt/hyperframes/projects/$PROJECT/beats_with_paths.json', 'utf8'));
const affected = JSON.parse(fs.readFileSync('/tmp/affected_beats_$PROJECT.json', 'utf8')).map(a => a.id);
console.log(JSON.stringify(b.beats.filter(b => affected.includes(b.id))));
EOF2
)

VIDEO_W=$(node --input-type=module -e "import fs from 'fs'; const b=JSON.parse(fs.readFileSync('$BEATS_FILE')); console.log(b.video_w);")
VIDEO_H=$(node --input-type=module -e "import fs from 'fs'; const b=JSON.parse(fs.readFileSync('$BEATS_FILE')); console.log(b.video_h);")
VIDEO_FPS=$(node --input-type=module -e "import fs from 'fs'; const b=JSON.parse(fs.readFileSync('$BEATS_FILE')); console.log(b.fps);")

node --input-type=module <<EOF 2>>"$BASE/projects/$PROJECT/pipeline.log"
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const affectedIds = JSON.parse(fs.readFileSync('/tmp/affected_beats_$PROJECT.json', 'utf8')).map(a => a.id);
const { beats, video_w, video_h, fps } = JSON.parse(fs.readFileSync('$BEATS_FILE', 'utf8'));
const COMP_DIR = '$COMP_DIR';
const FFMPEG = '$FFMPEG';
const CHROMIUM = '$CHROMIUM';

let puppeteer;
try { puppeteer = (await import('puppeteer')).default; } catch(e) { console.error('Puppeteer no disponible:', e.message); process.exit(1); }

const browser = await puppeteer.launch({
  executablePath: CHROMIUM,
  args: ['--no-sandbox','--disable-setuid-sandbox','--disable-gpu','--disable-dev-shm-usage']
});

for (const beat of beats.filter(b => affectedIds.includes(b.id))) {
  const htmlFile = path.join(COMP_DIR, 'compositions', \`\${beat.id}.html\`);
  if (!fs.existsSync(htmlFile)) continue;

  const framesDir = path.join(COMP_DIR, \`frames_\${beat.id}\`);
  fs.mkdirSync(framesDir, { recursive: true });

  const page = await browser.newPage();
  await page.setViewport({ width: video_w, height: video_h });
  await page.evaluate(() => { document.body.style.background = 'transparent'; });
  await page.goto(\`file://\${htmlFile}\`, { waitUntil: 'networkidle0' });

  const totalFrames = Math.ceil(beat.duration * fps);
  for (let f = 0; f < totalFrames; f++) {
    await page.screenshot({ path: path.join(framesDir, \`frame_\${String(f).padStart(4,'0')}.png\`), omitBackground: true });
  }
  await page.close();

  const movFile = path.join(COMP_DIR, \`\${beat.id}.mov\`);
  execSync(\`\${FFMPEG} -framerate \${fps} -i \${framesDir}/frame_%04d.png -c:v prores_ks -profile:v 4 -pix_fmt yuva444p12le \${movFile} -y\`);
  execSync(\`rm -rf \${framesDir}\`);
  console.log(\`Re-renderizado: \${beat.id}\`);
}

await browser.close();
EOF

log "Re-render completo, compositando..."

# Re-compositar el vídeo final
EDITED_VIDEO="$BASE/output/${PROJECT}_edited.mp4"
[ ! -f "$EDITED_VIDEO" ] && EDITED_VIDEO="$BASE/output/merged.mp4"
FINAL_VIDEO="$BASE/output/${PROJECT}_final.mp4"

INPUTS="-i $EDITED_VIDEO"
FILTER=""
IDX=1

while IFS= read -r beat_json; do
  BEAT_ID=$(echo "$beat_json"   | node --input-type=module -e "import{stdin}from'process';let d='';stdin.on('data',c=>d+=c);stdin.on('end',()=>console.log(JSON.parse(d).id))")
  BEAT_START=$(echo "$beat_json" | node --input-type=module -e "import{stdin}from'process';let d='';stdin.on('data',c=>d+=c);stdin.on('end',()=>console.log(JSON.parse(d).start))")
  BEAT_DUR=$(echo "$beat_json"   | node --input-type=module -e "import{stdin}from'process';let d='';stdin.on('data',c=>d+=c);stdin.on('end',()=>console.log(JSON.parse(d).duration))")
  BEAT_END=$(echo "$BEAT_START + $BEAT_DUR" | bc)
  MOV="$COMP_DIR/${BEAT_ID}.mov"
  [ ! -f "$MOV" ] && continue
  INPUTS="$INPUTS -i $MOV"
  FILTER="${FILTER}[$IDX:v]setpts=PTS+${BEAT_START}/TB[ov${IDX}];[0:v][ov${IDX}]overlay=0:0:enable='between(t,${BEAT_START},${BEAT_END})'[v${IDX}];"
  IDX=$((IDX + 1))
done < <(node --input-type=module -e "
import fs from 'fs';
JSON.parse(fs.readFileSync('$BEATS_FILE')).beats.forEach(b => console.log(JSON.stringify(b)));
")

$FFMPEG $INPUTS -filter_complex "$FILTER" -c:v libx264 -preset slow -crf 18 -c:a copy "$FINAL_VIDEO" -y \
  2>>"$BASE/projects/$PROJECT/pipeline.log"

# Subir resultado corregido a Drive
GDRIVE_STATUS=$(node --input-type=module -e "import fs from 'fs'; const s=JSON.parse(fs.readFileSync('$BASE/projects/$PROJECT/status.json')); console.log(s.drive_output || '');")
GDRIVE_OUTPUT_DIR=$(dirname "$GDRIVE_STATUS")
rclone copy "$FINAL_VIDEO" "$GDRIVE_OUTPUT_DIR/" -v 2>>"$BASE/projects/$PROJECT/pipeline.log" || true

# Preview y notificación
$FFMPEG -i "$FINAL_VIDEO" -vf "select='eq(n,30)+eq(n,150)+eq(n,300)'" -vsync 0 \
  "$BASE/projects/$PROJECT/preview_%d.png" -y 2>/dev/null || true

DURATION_FINAL=$($FFPROBE -v quiet -show_entries format=duration -of csv=p=0 "$FINAL_VIDEO")
PREVIEW_1=$(base64 -w0 "$BASE/projects/$PROJECT/preview_1.png" 2>/dev/null || echo "")
PREVIEW_2=$(base64 -w0 "$BASE/projects/$PROJECT/preview_2.png" 2>/dev/null || echo "")

node --input-type=module <<EOF2
import fs from 'fs';
const f = '$BASE/projects/$PROJECT/status.json';
const s = JSON.parse(fs.readFileSync(f));
fs.writeFileSync(f, JSON.stringify({...s, status:'done', correction_applied:'$CORRECTION', updated_at:new Date().toISOString()}, null, 2));
EOF2

notify "{
  \"status\": \"corrected\",
  \"project\": \"$PROJECT\",
  \"correction\": \"$CORRECTION\",
  \"duration\": $DURATION_FINAL,
  \"drive_output\": \"$GDRIVE_OUTPUT_DIR/${PROJECT}_final.mp4\",
  \"preview_1_b64\": \"$PREVIEW_1\",
  \"preview_2_b64\": \"$PREVIEW_2\"
}"

log "=== CORRECCIÓN APLICADA: $PROJECT ==="
