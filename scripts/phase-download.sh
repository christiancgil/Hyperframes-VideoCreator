#!/bin/bash
set -euo pipefail
CLIENT_NAME="$1"
PROJECT="$2"

BASE=/opt/hyperframes
FFMPEG=/usr/bin/ffmpeg
FFPROBE=/usr/bin/ffprobe

log() { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$BASE/projects/$PROJECT/pipeline.log"; }

GDRIVE_VIDEO="hf:${CLIENT_NAME}/Input Video"
GDRIVE_AUDIO="hf:${CLIENT_NAME}/Input Audio"

mkdir -p "$BASE/input" "$BASE/projects/$PROJECT"
rm -f "$BASE/input"/*.mp4 "$BASE/input"/*.MP4 "$BASE/input"/*.mov \
      "$BASE/input"/*.mp3 "$BASE/input"/*.wav "$BASE/input"/*.m4a "$BASE/input"/*.aac 2>/dev/null || true

# Descargar vídeos
log "Descargando vídeos desde $GDRIVE_VIDEO"
rclone copy "$GDRIVE_VIDEO" "$BASE/input/" \
  --include "*.mp4" --include "*.MP4" --include "*.mov" -v \
  2>>"$BASE/projects/$PROJECT/pipeline.log"

CLIP_COUNT=$(ls "$BASE/input"/*.mp4 "$BASE/input"/*.MP4 "$BASE/input"/*.mov 2>/dev/null | wc -l || echo 0)
[ "$CLIP_COUNT" -eq 0 ] && echo "ERROR: No se encontraron vídeos en $GDRIVE_VIDEO" && exit 1
log "Clips encontrados: $CLIP_COUNT"

# Descargar audio separado si existe
AUDIO_COUNT=$(rclone ls "$GDRIVE_AUDIO" 2>/dev/null | wc -l || echo 0)
HAS_SEPARATE_AUDIO=false
SCRIPT_FILE=""
if [ "$AUDIO_COUNT" -gt 0 ]; then
  log "Audio separado detectado en $GDRIVE_AUDIO"
  rclone copy "$GDRIVE_AUDIO" "$BASE/input/" \
    --include "*.mp3" --include "*.wav" --include "*.m4a" --include "*.aac" \
    --include "*.md" -v \
    2>>"$BASE/projects/$PROJECT/pipeline.log"

  # Validar que existe el guion MD — obligatorio cuando hay audio separado
  SCRIPT_FILE=$(ls "$BASE/input"/*.md 2>/dev/null | head -1 || echo "")
  if [ -z "$SCRIPT_FILE" ]; then
    echo "ERROR: Se encontró audio en '$GDRIVE_AUDIO' pero no hay archivo .md con el guion." >&2
    echo "       Sube un archivo .md a la carpeta 'Input Audio' con el texto del voice over y las escenas." >&2
    exit 1
  fi
  log "Guion encontrado: $(basename "$SCRIPT_FILE")"

  # Parsear el guion y guardar como script.json
  node --input-type=module <<NODEEOF 2>>"$BASE/projects/$PROJECT/pipeline.log"
import fs from 'fs';

const raw = fs.readFileSync('${SCRIPT_FILE}', 'utf8');
const lines = raw.split('\n');

const scenes = [];
let current = null;

for (const line of lines) {
  // Detectar cabecera de escena: ## Escena N — Título [HH:MM-HH:MM] (timestamps opcionales)
  const sceneMatch = line.match(/^##\s+(.+)/);
  if (sceneMatch) {
    if (current) scenes.push(current);
    const header = sceneMatch[1].trim();
    const timeMatch = header.match(/\[(\d{1,2}:\d{2}(?::\d{2})?)-(\d{1,2}:\d{2}(?::\d{2})?)\]/);
    const toSeconds = t => {
      const parts = t.split(':').map(Number);
      return parts.length === 3 ? parts[0]*3600 + parts[1]*60 + parts[2] : parts[0]*60 + parts[1];
    };
    current = {
      title: header.replace(/\[[\d:]+\-[\d:]+\]/, '').trim(),
      start_hint: timeMatch ? toSeconds(timeMatch[1]) : null,
      end_hint:   timeMatch ? toSeconds(timeMatch[2]) : null,
      voiceover: ''
    };
    continue;
  }

  // Capturar texto de voice over (acepta **Voice over:**, **VO:**, o línea de texto normal bajo la escena)
  if (current) {
    const voLine = line.replace(/^\*\*voice\s*o(?:ver|ff)\s*:?\*\*/i, '').replace(/^>\s*/, '').trim();
    if (voLine && !voLine.startsWith('#')) {
      current.voiceover += (current.voiceover ? ' ' : '') + voLine.replace(/^["']|["']$/g, '');
    }
  }
}
if (current) scenes.push(current);

// Extraer texto completo del VO para transcripción
const fullVoiceover = scenes.map(s => s.voiceover).filter(Boolean).join(' ');

const result = { scenes, full_voiceover: fullVoiceover, source_file: '${SCRIPT_FILE}' };
fs.writeFileSync('$BASE/projects/$PROJECT/script.json', JSON.stringify(result, null, 2));
console.log(\`Guion parseado: \${scenes.length} escenas, \${fullVoiceover.length} caracteres de VO\`);
NODEEOF

  HAS_SEPARATE_AUDIO=true
fi

# Unir clips si hay varios
if [ "$CLIP_COUNT" -gt 1 ]; then
  log "Uniendo $CLIP_COUNT clips..."
  CLIPS=$(ls "$BASE/input"/*.mp4 "$BASE/input"/*.MP4 "$BASE/input"/*.mov 2>/dev/null | sort)
  for clip in $CLIPS; do echo "file '$clip'"; done > "$BASE/input/concat_list.txt"
  $FFMPEG -f concat -safe 0 -i "$BASE/input/concat_list.txt" \
    -c:v copy -c:a aac -b:a 192k "$BASE/input/video_completo.mp4" -y \
    2>>"$BASE/projects/$PROJECT/pipeline.log"
  VIDEO="$BASE/input/video_completo.mp4"
else
  VIDEO=$(ls "$BASE/input"/*.mp4 "$BASE/input"/*.MP4 "$BASE/input"/*.mov 2>/dev/null | head -1)
fi

# Sincronizar audio externo si existe
if [ "$HAS_SEPARATE_AUDIO" = true ]; then
  AUDIO_FILE=$(ls "$BASE/input"/*.mp3 "$BASE/input"/*.wav "$BASE/input"/*.m4a "$BASE/input"/*.aac 2>/dev/null | head -1)
  log "Sincronizando audio externo: $AUDIO_FILE"

  $FFMPEG -i "$AUDIO_FILE" -ar 16000 -ac 1 "$BASE/input/ext_audio_ref.wav" -y \
    2>>"$BASE/projects/$PROJECT/pipeline.log"

  HAS_VIDEO_AUDIO=$($FFPROBE -v quiet -select_streams a:0 \
    -show_entries stream=codec_type -of csv=p=0 "$VIDEO" 2>/dev/null || echo "")

  OFFSET="0.000"
  if [ -n "$HAS_VIDEO_AUDIO" ]; then
    $FFMPEG -i "$VIDEO" -ar 16000 -ac 1 "$BASE/input/vid_audio_ref.wav" -y \
      2>>"$BASE/projects/$PROJECT/pipeline.log"

    OFFSET=$(python3 - <<'PYEOF'
import struct, math, sys
def read_wav(path, max_sec=60):
    with open(path, 'rb') as f:
        f.read(44)
        raw = f.read(max_sec * 16000 * 2)
    n = len(raw) // 2
    return [struct.unpack_from('<h', raw, i*2)[0] / 32768.0 for i in range(n)]
try:
    vid = read_wav('/opt/hyperframes/input/vid_audio_ref.wav')
    ext = read_wav('/opt/hyperframes/input/ext_audio_ref.wav')
    def rms(s): return math.sqrt(sum(x*x for x in s)/len(s)) if s else 1
    vid = [x/(rms(vid) or 1) for x in vid]
    ext = [x/(rms(ext) or 1) for x in ext]
    SR, MAX_O = 16000, 16000*10
    best_off, best_sc = 0, -1
    for lag in range(-MAX_O, MAX_O, SR//10):
        sc, cnt = 0, 0
        for i in range(0, min(len(vid), len(ext), SR*30), SR//4):
            vi = i + lag
            if 0 <= vi < len(vid) and i < len(ext):
                sc += vid[vi] * ext[i]; cnt += 1
        if cnt > 0 and sc/cnt > best_sc:
            best_sc = sc/cnt; best_off = lag
    print(f"{best_off/SR:.3f}")
except: print("0.000")
PYEOF
)
    rm -f "$BASE/input/vid_audio_ref.wav"
    log "Offset calculado: ${OFFSET}s"
  fi

  rm -f "$BASE/input/ext_audio_ref.wav"
  OFFSET_FLOAT=$(echo "$OFFSET" | tr -d '[:space:]')

  if [ "$(echo "$OFFSET_FLOAT >= 0" | bc -l)" = "1" ]; then
    $FFMPEG -i "$VIDEO" -ss "$OFFSET_FLOAT" -i "$AUDIO_FILE" \
      -c:v copy -c:a aac -b:a 192k -map 0:v:0 -map 1:a:0 -shortest \
      "$BASE/input/video_sincronizado.mp4" -y 2>>"$BASE/projects/$PROJECT/pipeline.log"
  else
    OFFSET_MS=$(python3 -c "print(int(abs($OFFSET_FLOAT)*1000))")
    $FFMPEG -i "$VIDEO" -i "$AUDIO_FILE" \
      -filter_complex "[1:a]adelay=${OFFSET_MS}|${OFFSET_MS}[a]" \
      -map 0:v:0 -map "[a]" -c:v copy -c:a aac -b:a 192k -shortest \
      "$BASE/input/video_sincronizado.mp4" -y 2>>"$BASE/projects/$PROJECT/pipeline.log"
  fi
  VIDEO="$BASE/input/video_sincronizado.mp4"
  log "Audio sincronizado → $VIDEO"
fi

# Detectar metadatos del vídeo final
VIDEO_W=$($FFPROBE -v quiet -select_streams v:0 -show_entries stream=width   -of csv=p=0 "$VIDEO")
VIDEO_H=$($FFPROBE -v quiet -select_streams v:0 -show_entries stream=height  -of csv=p=0 "$VIDEO")
VIDEO_FPS=$($FFPROBE -v quiet -select_streams v:0 -show_entries stream=r_frame_rate -of csv=p=0 "$VIDEO" | awk -F'/' '{printf "%.0f", $1/$2}')
DURATION=$($FFPROBE -v quiet -show_entries format=duration -of csv=p=0 "$VIDEO")

# Guardar en status.json para que la API lo devuelva
node --input-type=module <<EOF
import fs from 'fs';
const f = '$BASE/projects/$PROJECT/status.json';
const s = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f)) : {};
const scriptFile = '$BASE/projects/$PROJECT/script.json';
const hasScript = fs.existsSync(scriptFile);
const scriptData = hasScript ? JSON.parse(fs.readFileSync(scriptFile)) : null;
fs.writeFileSync(f, JSON.stringify({...s,
  status: 'downloaded',
  video_path: '$VIDEO',
  video_w: $VIDEO_W,
  video_h: $VIDEO_H,
  fps: $VIDEO_FPS,
  duration: $DURATION,
  has_separate_audio: $HAS_SEPARATE_AUDIO,
  has_script: hasScript,
  script_scenes: scriptData?.scenes?.length || 0,
  updated_at: new Date().toISOString()
}, null, 2));
EOF

cp "$VIDEO" "$BASE/output/merged.mp4"
log "Descarga completa: ${VIDEO_W}x${VIDEO_H} @ ${VIDEO_FPS}fps — ${DURATION}s"
