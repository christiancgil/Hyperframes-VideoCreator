#!/bin/bash
# Pipeline principal: Download → Transcribe → Beats → Render → Upload → Notify
set -euo pipefail

CLIENT_NAME="$1"   # ej: "Dairo Miranda"
PROJECT="$2"       # ej: "dairo_ep01" (sin espacios)
CALLBACK_URL="${3:-}"
STYLE="${4:-default}"

# Paths Drive basados en estructura estándar hf:{ClientName}/...
GDRIVE_VIDEO="hf:${CLIENT_NAME}/Input Video"
GDRIVE_AUDIO="hf:${CLIENT_NAME}/Input Audio"
GDRIVE_OUTPUT="hf:${CLIENT_NAME}/Output"

BASE=/opt/hyperframes
FFMPEG=/usr/bin/ffmpeg
FFPROBE=/usr/bin/ffprobe
BUN=/root/.bun/bin/bun
CHROMIUM=$(which chromium 2>/dev/null || which chromium-browser 2>/dev/null || echo "chromium")

log()    { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$BASE/projects/$PROJECT/pipeline.log"; }
status() { node --input-type=module <<EOF
import fs from 'fs';
const f = '$BASE/projects/$PROJECT/status.json';
const s = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f)) : {};
fs.writeFileSync(f, JSON.stringify({...s, ...$1, updated_at: new Date().toISOString()}, null, 2));
EOF
}
notify() {
  [ -n "$CALLBACK_URL" ] && curl -s -X POST "$CALLBACK_URL" \
    -H "Content-Type: application/json" -d "$1" || true
}
fail() {
  log "ERROR: $1"
  status "{status:'error', error:'$1'}"
  notify "{\"status\":\"error\",\"project\":\"$PROJECT\",\"error\":\"$1\"}"
  exit 1
}

mkdir -p "$BASE/projects/$PROJECT" "$BASE/input" "$BASE/output/compositions"
status "{status:'running', phase:'download'}"
log "=== PIPELINE INICIO: $PROJECT ==="

# ── FASE 0: Descargar desde Google Drive ─────────────────────────────────────
log "Descargando vídeos desde Drive: $GDRIVE_VIDEO"
rm -f "$BASE/input"/*.mp4 "$BASE/input"/*.MP4 "$BASE/input"/*.mov \
      "$BASE/input"/*.mp3 "$BASE/input"/*.wav "$BASE/input"/*.m4a 2>/dev/null || true

rclone copy "$GDRIVE_VIDEO" "$BASE/input/" \
  --include "*.mp4" --include "*.MP4" --include "*.mov" -v \
  2>>"$BASE/projects/$PROJECT/pipeline.log"

# Contar clips de vídeo
CLIP_COUNT=$(ls "$BASE/input"/*.mp4 "$BASE/input"/*.MP4 "$BASE/input"/*.mov 2>/dev/null | wc -l || echo 0)
[ "$CLIP_COUNT" -eq 0 ] && fail "No se encontraron vídeos en $GDRIVE_VIDEO"
log "Clips encontrados: $CLIP_COUNT"

# Descargar audio separado si existe (Input Audio)
AUDIO_COUNT=$(rclone ls "$GDRIVE_AUDIO" 2>/dev/null | wc -l || echo 0)
HAS_SEPARATE_AUDIO=false
if [ "$AUDIO_COUNT" -gt 0 ]; then
  log "Audio separado detectado — descargando desde $GDRIVE_AUDIO"
  rclone copy "$GDRIVE_AUDIO" "$BASE/input/" \
    --include "*.mp3" --include "*.wav" --include "*.m4a" --include "*.aac" -v \
    2>>"$BASE/projects/$PROJECT/pipeline.log"
  HAS_SEPARATE_AUDIO=true
fi

# Si hay múltiples clips, unirlos (Fase 0 del pipeline)
if [ "$CLIP_COUNT" -gt 1 ]; then
  log "Múltiples clips — uniendo en video_completo.mp4..."
  CLIPS=$(ls "$BASE/input"/*.mp4 "$BASE/input"/*.MP4 "$BASE/input"/*.mov 2>/dev/null | sort)
  for clip in $CLIPS; do echo "file '$clip'"; done > "$BASE/input/concat_list.txt"
  $FFMPEG -f concat -safe 0 -i "$BASE/input/concat_list.txt" \
    -c:v copy -c:a aac -b:a 192k "$BASE/input/video_completo.mp4" -y \
    2>>"$BASE/projects/$PROJECT/pipeline.log"
  VIDEO="$BASE/input/video_completo.mp4"
else
  VIDEO=$(ls "$BASE/input"/*.mp4 "$BASE/input"/*.MP4 "$BASE/input"/*.mov 2>/dev/null | head -1)
fi

# ── ALINEACIÓN DE AUDIO EXTERNO ──────────────────────────────────────────────
if [ "$HAS_SEPARATE_AUDIO" = true ]; then
  AUDIO_FILE=$(ls "$BASE/input"/*.mp3 "$BASE/input"/*.wav "$BASE/input"/*.m4a "$BASE/input"/*.aac 2>/dev/null | head -1)
  log "Audio externo detectado: $AUDIO_FILE"

  # Convertir audio a WAV mono 16kHz para análisis (más rápido)
  $FFMPEG -i "$AUDIO_FILE" -ar 16000 -ac 1 "$BASE/input/ext_audio_ref.wav" -y \
    2>>"$BASE/projects/$PROJECT/pipeline.log"

  # Verificar si el vídeo tiene pista de audio propia
  HAS_VIDEO_AUDIO=$($FFPROBE -v quiet -select_streams a:0 \
    -show_entries stream=codec_type -of csv=p=0 "$VIDEO" 2>/dev/null || echo "")

  if [ -n "$HAS_VIDEO_AUDIO" ]; then
    log "Vídeo tiene audio propio — calculando offset por correlación..."

    # Extraer audio del vídeo a WAV para comparar
    $FFMPEG -i "$VIDEO" -ar 16000 -ac 1 "$BASE/input/vid_audio_ref.wav" -y \
      2>>"$BASE/projects/$PROJECT/pipeline.log"

    # Calcular offset usando Python (cross-correlación de primers 60s)
    OFFSET=$(python3 - <<PYEOF
import subprocess, struct, math, sys

def read_wav_samples(path, max_seconds=60):
    """Lee muestras PCM de un WAV sin dependencias externas."""
    with open(path, 'rb') as f:
        f.read(44)  # saltar header WAV
        raw = f.read(max_seconds * 16000 * 2)  # 16kHz, 16bit
    n = len(raw) // 2
    return [struct.unpack_from('<h', raw, i*2)[0] / 32768.0 for i in range(n)]

try:
    vid = read_wav_samples('/opt/hyperframes/input/vid_audio_ref.wav')
    ext = read_wav_samples('/opt/hyperframes/input/ext_audio_ref.wav')

    # Normalizar RMS
    def rms(s): return math.sqrt(sum(x*x for x in s) / len(s)) if s else 1
    vid = [x / (rms(vid) or 1) for x in vid]
    ext = [x / (rms(ext) or 1) for x in ext]

    # Cross-correlación simplificada (ventana de ±10s = ±160000 samples a 16kHz)
    SR = 16000
    MAX_OFFSET = SR * 10
    best_offset, best_score = 0, -1

    step = SR // 10  # saltos de 100ms para velocidad
    for lag in range(-MAX_OFFSET, MAX_OFFSET, step):
        score = 0
        count = 0
        for i in range(0, min(len(vid), len(ext), SR * 30), SR // 4):
            vi = i + lag
            ei = i
            if 0 <= vi < len(vid) and 0 <= ei < len(ext):
                score += vid[vi] * ext[ei]
                count += 1
        if count > 0 and score / count > best_score:
            best_score = score / count
            best_offset = lag

    offset_sec = best_offset / SR
    print(f"{offset_sec:.3f}")
except Exception as e:
    print("0.000", file=sys.stderr)
    print("0.000")
PYEOF
)
    log "Offset calculado: ${OFFSET}s"
    rm -f "$BASE/input/vid_audio_ref.wav"

  else
    log "Vídeo sin audio propio — usando audio externo desde el inicio (offset 0)"
    OFFSET="0.000"
  fi

  rm -f "$BASE/input/ext_audio_ref.wav"

  # Aplicar offset y reemplazar audio del vídeo con el externo alineado
  OFFSET_FLOAT=$(echo "$OFFSET" | tr -d '[:space:]')
  OFFSET_MS=$(echo "$OFFSET_FLOAT * 1000 / 1" | bc 2>/dev/null || echo "0")

  if [ "$(echo "$OFFSET_FLOAT >= 0" | bc -l)" = "1" ]; then
    # Audio externo empieza DESPUÉS del vídeo → recortar el inicio del audio
    $FFMPEG -i "$VIDEO" -ss "$OFFSET_FLOAT" -i "$AUDIO_FILE" \
      -c:v copy -c:a aac -b:a 192k \
      -map 0:v:0 -map 1:a:0 \
      -shortest \
      "$BASE/input/video_sincronizado.mp4" -y \
      2>>"$BASE/projects/$PROJECT/pipeline.log"
  else
    # Audio externo empieza ANTES del vídeo → añadir silencio al inicio del audio
    ABS_OFFSET=$(echo "$OFFSET_FLOAT * -1" | bc -l)
    $FFMPEG -i "$VIDEO" -i "$AUDIO_FILE" \
      -filter_complex "[1:a]adelay=${OFFSET_MS}|${OFFSET_MS}[a_delayed]" \
      -map 0:v:0 -map "[a_delayed]" \
      -c:v copy -c:a aac -b:a 192k \
      -shortest \
      "$BASE/input/video_sincronizado.mp4" -y \
      2>>"$BASE/projects/$PROJECT/pipeline.log"
  fi

  VIDEO="$BASE/input/video_sincronizado.mp4"
  log "Audio sincronizado con offset ${OFFSET}s → $VIDEO"
fi

log "Vídeo listo para procesar: $VIDEO"

# ── FASE 1: Detectar resolución y transcribir ────────────────────────────────
VIDEO_W=$($FFPROBE -v quiet -select_streams v:0 -show_entries stream=width   -of csv=p=0 "$VIDEO")
VIDEO_H=$($FFPROBE -v quiet -select_streams v:0 -show_entries stream=height  -of csv=p=0 "$VIDEO")
VIDEO_FPS=$($FFPROBE -v quiet -select_streams v:0 -show_entries stream=r_frame_rate -of csv=p=0 "$VIDEO" | awk -F'/' '{printf "%.0f", $1/$2}')
DURATION=$($FFPROBE -v quiet -show_entries format=duration -of csv=p=0 "$VIDEO")
log "Resolución: ${VIDEO_W}x${VIDEO_H} @ ${VIDEO_FPS}fps — ${DURATION}s"

status "{status:'running', phase:'transcribing', video_w:$VIDEO_W, video_h:$VIDEO_H, fps:$VIDEO_FPS, duration:$DURATION}"

cp "$VIDEO" "$BASE/output/merged.mp4"
cd "$BASE"
node scripts/transcribe.mjs 2>>"$BASE/projects/$PROJECT/pipeline.log"
cp output/transcript.json "projects/$PROJECT/transcript.json"
log "Transcripción lista"

TRANSCRIPT_TEXT=$(node --input-type=module <<'EOF'
import fs from 'fs';
const t = JSON.parse(fs.readFileSync('/opt/hyperframes/output/transcript.json', 'utf8'));
process.stdout.write(t.text || '');
EOF
)

# ── FASE 2: Recorte automático ────────────────────────────────────────────────
status "{status:'running', phase:'cutting'}"
log "Recortando silencios y fillers..."
node scripts/build_offsets.mjs 2>>"$BASE/projects/$PROJECT/pipeline.log" || true
log "Recorte listo → output/${PROJECT}_edited.mp4"

# ── FASE 3-4: Planificación y generación de beats (Claude API) ───────────────
status "{status:'running', phase:'planning_beats'}"
log "Planificando motion graphics con Claude API..."

STYLE_FILE="$BASE/styles/client-style.md"
[ -f "$BASE/styles/client-style-${STYLE}.md" ] && STYLE_FILE="$BASE/styles/client-style-${STYLE}.md"

node --input-type=module <<EOF 2>>"$BASE/projects/$PROJECT/pipeline.log"
import fs from 'fs';
import https from 'https';

const transcript = JSON.parse(fs.readFileSync('/opt/hyperframes/output/transcript.json', 'utf8'));
const style = fs.readFileSync('$STYLE_FILE', 'utf8');
const motionPhilosophy = fs.readFileSync('/opt/hyperframes/styles/motion-philosophy.md', 'utf8');
const triggers = fs.readFileSync('/opt/hyperframes/styles/triggers.md', 'utf8');
const effectsCatalog = fs.readFileSync('/opt/hyperframes/styles/effects-catalog.md', 'utf8');

const systemPrompt = \`Eres un editor de vídeo de IA. Tu tarea es planificar los motion graphics (beats) para un vídeo basándote en la transcripción y el estilo del cliente.

ESTILO DEL CLIENTE:
\${style}

FILOSOFÍA DE MOVIMIENTO:
\${motionPhilosophy}

TRIGGERS DE ANIMACIÓN:
\${triggers}

CATÁLOGO DE EFECTOS:
\${effectsCatalog}

VIDEO: \${$VIDEO_W}x\${$VIDEO_H} @ \${$VIDEO_FPS}fps\`;

const userPrompt = \`Transcripción del vídeo:
\${transcript.text}

Segmentos con timestamps:
\${transcript.segments?.map(s => \`[\${s.start.toFixed(2)}s→\${s.end.toFixed(2)}s] \${s.text.trim()}\`).join('\\n')}

Devuelve un JSON con los beats. Formato exacto:
{
  "beats": [
    {
      "id": "beat_01",
      "effect": "nombre-del-efecto-del-catalogo",
      "start": 2.5,
      "duration": 4,
      "content": { "titulo": "Texto principal", "subtitulo": "Texto secundario" },
      "position": "CARD_CENTER",
      "html_classes": ["card-glassmorphism"]
    }
  ]
}

Solo el JSON, sin explicaciones.\`;

const envContent = fs.readFileSync('/opt/hyperframes/.env', 'utf8');
const apiKey = envContent.split('\\n').find(l => l.startsWith('OPENAI_API_KEY='))?.split('=')[1]?.trim();

const body = JSON.stringify({
  model: 'gpt-4o',
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ],
  response_format: { type: 'json_object' },
  temperature: 0.3
});

const response = await new Promise((resolve, reject) => {
  const req = https.request({
    hostname: 'api.openai.com',
    path: '/v1/chat/completions',
    method: 'POST',
    headers: { 'Authorization': \`Bearer \${apiKey}\`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  }, res => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => resolve(JSON.parse(data)));
  });
  req.on('error', reject);
  req.write(body);
  req.end();
});

const beats = JSON.parse(response.choices[0].message.content);
fs.writeFileSync('/opt/hyperframes/projects/$PROJECT/beats.json', JSON.stringify(beats, null, 2));
console.log(\`Beats planificados: \${beats.beats?.length || 0}\`);
EOF

log "Beats listos → projects/$PROJECT/beats.json"

# ── FASE 4: Generar HTMLs de cada beat ───────────────────────────────────────
status "{status:'running', phase:'generating_html'}"
log "Generando HTMLs de motion graphics..."
node --input-type=module <<EOF 2>>"$BASE/projects/$PROJECT/pipeline.log"
import fs from 'fs';
import path from 'path';

const beats = JSON.parse(fs.readFileSync('/opt/hyperframes/projects/$PROJECT/beats.json', 'utf8'));
const style = fs.readFileSync('$STYLE_FILE', 'utf8');
const envContent = fs.readFileSync('/opt/hyperframes/.env', 'utf8');
const apiKey = envContent.split('\\n').find(l => l.startsWith('OPENAI_API_KEY='))?.split('=')[1]?.trim();

const outDir = '/opt/hyperframes/output/compositions/$PROJECT';
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(path.join(outDir, 'compositions'), { recursive: true });

// Generar index.html (requerido por HyperFrames)
fs.writeFileSync(path.join(outDir, 'index.html'), \`<!DOCTYPE html>
<html><head><title>$PROJECT</title></head>
<body style="background:transparent;margin:0;padding:0">
<p style="color:white;font-family:sans-serif;padding:20px">Proyecto: $PROJECT</p>
</body></html>\`);

import https from 'https';

async function generateBeatHTML(beat) {
  const body = JSON.stringify({
    model: 'gpt-4o',
    messages: [{
      role: 'user',
      content: \`Genera el HTML completo para este beat de motion graphics.

ESTILO: \${style.substring(0, 2000)}
BEAT: \${JSON.stringify(beat)}
VIDEO: \${$VIDEO_W}x\${$VIDEO_H}px

Reglas ABSOLUTAS:
- body { background: transparent !important; width: \${$VIDEO_W}px; height: \${$VIDEO_H}px; margin:0; overflow:hidden; }
- Fuentes desde Google Fonts con <link> en el <head>
- Animaciones con animation-fill-mode: forwards
- Nunca fondo sólido en body
- Posición: \${beat.position === 'CARD_CENTER' ? 'centrado verticalmente' : beat.position === 'CARD_BOTTOM' ? 'parte inferior 70-90%' : 'parte superior 15-35%'}

Devuelve SOLO el HTML completo, sin markdown.\`
    }],
    temperature: 0.2
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.openai.com', path: '/v1/chat/completions', method: 'POST',
      headers: { 'Authorization': \`Bearer \${apiKey}\`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        const r = JSON.parse(data);
        resolve(r.choices[0].message.content);
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

for (const beat of beats.beats || []) {
  const html = await generateBeatHTML(beat);
  const filename = \`\${beat.id}.html\`;
  fs.writeFileSync(path.join(outDir, 'compositions', filename), html);
  console.log(\`HTML generado: \${filename}\`);
}

// Guardar beats con paths actualizados
fs.writeFileSync('/opt/hyperframes/projects/$PROJECT/beats_with_paths.json', JSON.stringify({
  ...beats,
  output_dir: outDir,
  video_w: $VIDEO_W,
  video_h: $VIDEO_H,
  fps: $VIDEO_FPS
}, null, 2));
EOF

log "HTMLs generados en output/compositions/$PROJECT/"

# ── FASE 5: Renderizar beats con Puppeteer ────────────────────────────────────
status "{status:'running', phase:'rendering'}"
log "Renderizando beats con Puppeteer..."

COMP_DIR="$BASE/output/compositions/$PROJECT"
BEATS_FILE="$BASE/projects/$PROJECT/beats_with_paths.json"

node --input-type=module <<EOF 2>>"$BASE/projects/$PROJECT/pipeline.log"
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const { beats, video_w, video_h, fps } = JSON.parse(fs.readFileSync('$BEATS_FILE', 'utf8'));
const COMP_DIR = '$COMP_DIR';
const FFMPEG = '$FFMPEG';
const CHROMIUM = '$CHROMIUM';

// Intentar importar puppeteer
let puppeteer;
try {
  puppeteer = (await import('/opt/hyperframes/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js')).default;
} catch {
  try { puppeteer = (await import('puppeteer')).default; } catch(e) { console.error('Puppeteer no disponible:', e.message); process.exit(1); }
}

const browser = await puppeteer.launch({
  executablePath: CHROMIUM,
  args: ['--no-sandbox','--disable-setuid-sandbox','--disable-gpu','--disable-dev-shm-usage']
});

for (const beat of beats || []) {
  const htmlFile = path.join(COMP_DIR, 'compositions', \`\${beat.id}.html\`);
  if (!fs.existsSync(htmlFile)) { console.log(\`Saltando \${beat.id}: HTML no encontrado\`); continue; }

  const framesDir = path.join(COMP_DIR, \`frames_\${beat.id}\`);
  fs.mkdirSync(framesDir, { recursive: true });

  const page = await browser.newPage();
  await page.setViewport({ width: video_w, height: video_h });
  await page.evaluate(() => { document.body.style.background = 'transparent'; });
  await page.goto(\`file://\${htmlFile}\`, { waitUntil: 'networkidle0' });

  const totalFrames = Math.ceil(beat.duration * fps);
  for (let f = 0; f < totalFrames; f++) {
    const t = f / fps;
    await page.evaluate(t => { window._currentTime = t; }, t);
    await page.screenshot({ path: path.join(framesDir, \`frame_\${String(f).padStart(4,'0')}.png\`), omitBackground: true });
  }
  await page.close();

  // PNG frames → ProRes 4444
  const movFile = path.join(COMP_DIR, \`\${beat.id}.mov\`);
  execSync(\`\${FFMPEG} -framerate \${fps} -i \${framesDir}/frame_%04d.png -c:v prores_ks -profile:v 4 -pix_fmt yuva444p12le \${movFile} -y\`, { stdio: 'inherit' });
  execSync(\`rm -rf \${framesDir}\`);
  console.log(\`Beat renderizado: \${beat.id} → \${movFile}\`);
}

await browser.close();
EOF

log "Beats renderizados"

# ── FASE 5.5: Compositing final ───────────────────────────────────────────────
status "{status:'running', phase:'compositing'}"
log "Compositando overlay final..."

EDITED_VIDEO="$BASE/output/${PROJECT}_edited.mp4"
[ ! -f "$EDITED_VIDEO" ] && cp "$BASE/output/merged.mp4" "$EDITED_VIDEO"

FINAL_VIDEO="$BASE/output/${PROJECT}_final.mp4"
FILTER=""
INPUTS="-i $EDITED_VIDEO"
IDX=1

BEATS_DATA=$(node --input-type=module <<'EOF'
import fs from 'fs';
const b = JSON.parse(fs.readFileSync('/opt/hyperframes/projects/$PROJECT/beats_with_paths.json', 'utf8'));
console.log(JSON.stringify(b.beats || []));
EOF
)

while IFS= read -r beat; do
  BEAT_ID=$(echo "$beat" | node --input-type=module -e "import{stdin}from'process';let d='';stdin.on('data',c=>d+=c);stdin.on('end',()=>console.log(JSON.parse(d).id))")
  BEAT_START=$(echo "$beat" | node --input-type=module -e "import{stdin}from'process';let d='';stdin.on('data',c=>d+=c);stdin.on('end',()=>console.log(JSON.parse(d).start))")
  BEAT_DUR=$(echo "$beat" | node --input-type=module -e "import{stdin}from'process';let d='';stdin.on('data',c=>d+=c);stdin.on('end',()=>console.log(JSON.parse(d).duration))")
  BEAT_END=$(echo "$BEAT_START + $BEAT_DUR" | bc)
  MOV="$COMP_DIR/${BEAT_ID}.mov"
  [ ! -f "$MOV" ] && continue
  INPUTS="$INPUTS -i $MOV"
  FILTER="${FILTER}[$IDX:v]setpts=PTS+${BEAT_START}/TB[ov${IDX}];[${IDX}:v][ov${IDX}]overlay=0:0:enable='between(t,${BEAT_START},${BEAT_END})'[v${IDX}];"
  IDX=$((IDX + 1))
done < <(echo "$BEATS_DATA" | node --input-type=module -e "import{stdin}from'process';let d='';stdin.on('data',c=>d+=c);stdin.on('end',()=>JSON.parse(d).forEach(b=>console.log(JSON.stringify(b))))")

if [ -n "$FILTER" ]; then
  $FFMPEG $INPUTS -filter_complex "$FILTER" -c:v libx264 -preset slow -crf 18 -c:a copy "$FINAL_VIDEO" -y \
    2>>"$BASE/projects/$PROJECT/pipeline.log"
else
  cp "$EDITED_VIDEO" "$FINAL_VIDEO"
fi

log "Video final: $FINAL_VIDEO"

# ── FASE 6: Verificación y frames de preview ──────────────────────────────────
DURATION_FINAL=$($FFPROBE -v quiet -show_entries format=duration -of csv=p=0 "$FINAL_VIDEO")
$FFMPEG -i "$FINAL_VIDEO" -vf "select='eq(n,30)+eq(n,150)+eq(n,300)'" -vsync 0 \
  "$BASE/projects/$PROJECT/preview_%d.png" -y 2>/dev/null || true

log "Duración final: ${DURATION_FINAL}s"

# ── FASE 6.5: Subir resultado a Google Drive ──────────────────────────────────
log "Subiendo resultado a Drive..."
rclone copy "$FINAL_VIDEO" "$GDRIVE_OUTPUT/" -v 2>>"$BASE/projects/$PROJECT/pipeline.log" || true
DRIVE_OUTPUT_PATH="${GDRIVE_OUTPUT}/${PROJECT}_final.mp4"
log "Subido a: $DRIVE_OUTPUT_PATH"

# ── NOTIFICAR A N8N ───────────────────────────────────────────────────────────
PREVIEW_1=$(base64 -w0 "$BASE/projects/$PROJECT/preview_1.png" 2>/dev/null || echo "")
PREVIEW_2=$(base64 -w0 "$BASE/projects/$PROJECT/preview_2.png" 2>/dev/null || echo "")

status "{status:'done', duration:$DURATION_FINAL, drive_output:'$DRIVE_OUTPUT_PATH'}"

notify "{
  \"status\": \"done\",
  \"project\": \"$PROJECT\",
  \"duration\": $DURATION_FINAL,
  \"drive_output\": \"$DRIVE_OUTPUT_PATH\",
  \"preview_1_b64\": \"$PREVIEW_1\",
  \"preview_2_b64\": \"$PREVIEW_2\"
}"

log "=== PIPELINE COMPLETO: $PROJECT ==="
