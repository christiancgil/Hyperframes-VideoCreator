#!/bin/bash
set -euo pipefail
PROJECT="$1"
BASE=/opt/hyperframes
FFMPEG=/usr/bin/ffmpeg
FFPROBE=/usr/bin/ffprobe

log() { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$BASE/projects/$PROJECT/pipeline.log"; }

VIDEO="$BASE/output/merged.mp4"
OUTPUT="$BASE/output/${PROJECT}_edited.mp4"

log "Detectando silencios para corte..."

# Umbral -40dB, duración mínima 0.3s — captura pausas naturales entre frases
SILENCES=$($FFMPEG -i "$VIDEO" -af silencedetect=n=-40dB:d=0.3 -f null - 2>&1 | \
  grep -E "silence_start|silence_end")

DURATION=$($FFPROBE -v quiet -show_entries format=duration -of csv=p=0 "$VIDEO")

SEGMENTS=$(python3 - <<PYEOF
import re, json

raw = """$SILENCES"""
duration = float("$DURATION")

starts = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', raw)]
ends   = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', raw)]

keep = []
prev = 0.0
for s, e in zip(starts, ends):
    seg_end = s + 0.05   # 50ms de respiro antes del corte para evitar clics de audio
    if seg_end - prev > 0.15:
        keep.append((round(prev, 3), round(seg_end, 3)))
    prev = max(e - 0.05, 0.0)  # retroceder 50ms al reanudar
if duration - prev > 0.15:
    keep.append((round(prev, 3), round(duration, 3)))

print(json.dumps(keep))
PYEOF
)

NSEG=$(echo "$SEGMENTS" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))")
log "Segmentos a mantener: $NSEG (de $DURATION s totales)"

# Sin silencios detectados → copiar sin cortar
if [ "$NSEG" -le 1 ]; then
  log "Sin silencios detectados — copiando video sin cortes"
  $FFMPEG -i "$VIDEO" -c:v copy -c:a aac -b:a 192k "$OUTPUT" -y \
    2>>"$BASE/projects/$PROJECT/pipeline.log"
  log "Corte listo (sin cambios): $OUTPUT"
  exit 0
fi

# Corte con filtros trim/atrim en un solo paso — sin archivos intermedios.
# Evita el problema de c:v copy que produce segmentos sin video cuando el corte
# cae entre keyframes, lo que hace que el concat final pierda la pista de video.
python3 - <<PYEOF 2>>"$BASE/projects/$PROJECT/pipeline.log"
import json, subprocess, sys

segments = json.loads('$SEGMENTS')
ffmpeg   = '$FFMPEG'
video    = '$VIDEO'
output   = '$OUTPUT'
log_file = '$BASE/projects/$PROJECT/pipeline.log'

n = len(segments)
filter_parts = []

for i, (start, end) in enumerate(segments):
    filter_parts.append(f"[0:v]trim=start={start}:end={end},setpts=PTS-STARTPTS[v{i}]")
    filter_parts.append(f"[0:a]atrim=start={start}:end={end},asetpts=PTS-STARTPTS[a{i}]")

concat_pads = "".join(f"[v{i}][a{i}]" for i in range(n))
filter_parts.append(f"{concat_pads}concat=n={n}:v=1:a=1[v][a]")

filter_complex = ";".join(filter_parts)

cmd = [
    ffmpeg, '-i', video,
    '-filter_complex', filter_complex,
    '-map', '[v]', '-map', '[a]',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23',
    '-c:a', 'aac', '-b:a', '192k',
    output, '-y'
]

with open(log_file, 'a') as lf:
    result = subprocess.run(cmd, stdout=lf, stderr=lf)

if result.returncode != 0:
    print(f"ERROR: ffmpeg exited with code {result.returncode}", file=sys.stderr)
    sys.exit(1)

print(f"Corte completado: {n} segmentos")
PYEOF

FINAL_DUR=$($FFPROBE -v quiet -show_entries format=duration -of csv=p=0 "$OUTPUT")
log "Corte listo: $OUTPUT (${FINAL_DUR}s)"
