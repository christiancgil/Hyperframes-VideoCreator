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

# Detectar silencios > 0.5s con umbral -50dB
SILENCES=$($FFMPEG -i "$VIDEO" -af silencedetect=n=-50dB:d=0.5 -f null - 2>&1 | \
  grep -E "silence_start|silence_end")

DURATION=$($FFPROBE -v quiet -show_entries format=duration -of csv=p=0 "$VIDEO")

# Calcular segmentos a mantener con Python
SEGMENTS=$(python3 - <<PYEOF
import re, json

raw = """$SILENCES"""
duration = float("$DURATION")

starts = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', raw)]
ends   = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', raw)]

# Construir keep intervals
keep = []
prev = 0.0
for s, e in zip(starts, ends):
    if s - prev > 0.1:  # segmento mínimo de 100ms
        keep.append((round(prev, 3), round(s, 3)))
    prev = e
if duration - prev > 0.1:
    keep.append((round(prev, 3), round(duration, 3)))

print(json.dumps(keep))
PYEOF
)

log "Segmentos a mantener: $SEGMENTS"

# Cortar y concatenar segmentos
CONCAT_LIST="$BASE/projects/$PROJECT/cut_list.txt"
rm -f "$CONCAT_LIST"
IDX=0
echo "$SEGMENTS" | python3 - <<PYEOF
import json, subprocess, os, sys

segments = json.loads('$SEGMENTS'.replace("'", '"'))
base = '$BASE'
project = '$PROJECT'
ffmpeg = '$FFMPEG'
concat_list = '$CONCAT_LIST'

files = []
for i, (start, end) in enumerate(segments):
    out = f"{base}/projects/{project}/seg_{i:03d}.mp4"
    cmd = [ffmpeg, '-i', f'{base}/output/merged.mp4',
           '-ss', str(start), '-to', str(end),
           '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
           out, '-y']
    subprocess.run(cmd, capture_output=True)
    files.append(out)

with open(concat_list, 'w') as f:
    for fp in files:
        f.write(f"file '{fp}'\n")
PYEOF

$FFMPEG -f concat -safe 0 -i "$CONCAT_LIST" \
  -c:v copy -c:a aac -b:a 192k "$OUTPUT" -y \
  2>>"$BASE/projects/$PROJECT/pipeline.log"

# Limpiar segmentos temporales
python3 -c "
import json, os
segs = json.loads('$SEGMENTS')
for i in range(len(segs)):
    p = '$BASE/projects/$PROJECT/seg_{:03d}.mp4'.format(i)
    if os.path.exists(p): os.remove(p)
"

log "Corte listo: $OUTPUT"
