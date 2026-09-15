#!/bin/bash
set -euo pipefail
PROJECT="$1"
BASE=/opt/hyperframes

log() { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$BASE/projects/$PROJECT/pipeline.log"; }

BEATS_FILE="$BASE/projects/$PROJECT/beats.json"
[ ! -f "$BEATS_FILE" ] && echo "ERROR: beats.json no encontrado" && exit 1

log "Generando HTMLs desde beats.json..."

COMP_DIR="$BASE/output/compositions/$PROJECT"
mkdir -p "$COMP_DIR/compositions"

node --input-type=module <<EOF 2>>"$BASE/projects/$PROJECT/pipeline.log"
import fs from 'fs';
import path from 'path';

const { beats, video_w, video_h, fps } = JSON.parse(fs.readFileSync('$BEATS_FILE', 'utf8'));
const COMP_DIR = '$COMP_DIR';

// index.html requerido por HyperFrames
fs.writeFileSync(path.join(COMP_DIR, 'index.html'),
  \`<!DOCTYPE html><html><head><title>$PROJECT</title></head>
  <body style="background:transparent;margin:0;padding:0;width:\${video_w}px;height:\${video_h}px"></body></html>\`
);

// Generar HTML de cada beat desde el campo html_content que envió OpenAI
for (const beat of beats || []) {
  if (!beat.html_content) {
    console.warn(\`Beat \${beat.id} sin html_content — saltando\`);
    continue;
  }
  const filename = path.join(COMP_DIR, 'compositions', \`\${beat.id}.html\`);
  fs.writeFileSync(filename, beat.html_content);
  console.log(\`HTML guardado: \${beat.id}.html (\${beat.html_content.length} chars)\`);
}

// Actualizar beats_with_paths para el render
fs.writeFileSync('$BASE/projects/$PROJECT/beats_with_paths.json',
  JSON.stringify({ beats, video_w, video_h, fps, output_dir: COMP_DIR }, null, 2)
);
console.log(\`Total beats generados: \${beats?.length || 0}\`);
EOF

log "HTMLs generados en $COMP_DIR/compositions/"
