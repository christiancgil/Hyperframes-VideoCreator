#!/bin/bash
set -euo pipefail
PROJECT="$1"
BASE=/opt/hyperframes
FFMPEG=/usr/bin/ffmpeg

log() { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$BASE/projects/$PROJECT/pipeline.log"; }

# Whisper API acepta máx 25 MB — extraer solo el audio del vídeo
MERGED="$BASE/output/merged.mp4"
AUDIO_FOR_WHISPER="$BASE/output/audio_whisper.mp3"

log "Extrayendo audio para Whisper..."
$FFMPEG -i "$MERGED" \
  -vn -ac 1 -ar 16000 -b:a 64k \
  "$AUDIO_FOR_WHISPER" -y \
  2>>"$BASE/projects/$PROJECT/pipeline.log"

AUDIO_SIZE=$(stat -c%s "$AUDIO_FOR_WHISPER" 2>/dev/null || echo 0)
log "Audio extraído: $(( AUDIO_SIZE / 1024 / 1024 ))MB → $(basename $AUDIO_FOR_WHISPER)"

log "Transcribiendo con Whisper API..."
cd "$BASE"
WHISPER_FILE="$AUDIO_FOR_WHISPER" node scripts/transcribe.mjs 2>>"$BASE/projects/$PROJECT/pipeline.log"
cp output/transcript.json "projects/$PROJECT/transcript.json"
rm -f "$AUDIO_FOR_WHISPER"
log "Transcripción lista"
