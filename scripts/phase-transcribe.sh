#!/bin/bash
set -euo pipefail
PROJECT="$1"
BASE=/opt/hyperframes

log() { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$BASE/projects/$PROJECT/pipeline.log"; }

log "Transcribiendo con Whisper API..."
cd "$BASE"
node scripts/transcribe.mjs 2>>"$BASE/projects/$PROJECT/pipeline.log"
cp output/transcript.json "projects/$PROJECT/transcript.json"
log "Transcripción lista"
