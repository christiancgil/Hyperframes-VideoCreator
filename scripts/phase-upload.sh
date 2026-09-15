#!/bin/bash
set -euo pipefail
CLIENT_NAME="$1"
PROJECT="$2"
BASE=/opt/hyperframes

log() { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$BASE/projects/$PROJECT/pipeline.log"; }

FINAL_VIDEO="$BASE/output/${PROJECT}_final.mp4"
[ ! -f "$FINAL_VIDEO" ] && echo "ERROR: $FINAL_VIDEO no encontrado" && exit 1

GDRIVE_OUTPUT="hf:${CLIENT_NAME}/Output"

log "Subiendo vídeo final a Google Drive..."
rclone copy "$FINAL_VIDEO" "$GDRIVE_OUTPUT/" \
  --progress \
  2>>"$BASE/projects/$PROJECT/pipeline.log"

# Obtener el link compartido del archivo subido
FILENAME=$(basename "$FINAL_VIDEO")
DRIVE_PATH="${GDRIVE_OUTPUT}/${FILENAME}"

DRIVE_URL=$(rclone link "$DRIVE_PATH" 2>/dev/null || echo "")

# Guardar en status.json
node --input-type=module <<EOF
import fs from 'fs';
const f = '$BASE/projects/$PROJECT/status.json';
const s = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f)) : {};
fs.writeFileSync(f, JSON.stringify({...s,
  status: 'done',
  drive_output: '$DRIVE_PATH',
  drive_url: '${DRIVE_URL}',
  updated_at: new Date().toISOString()
}, null, 2));
EOF

log "Subida completa: $DRIVE_PATH"
echo "$DRIVE_URL"
