// fix_card_position.mjs — move all edl_v2 cards from CARD_BOTTOM to CARD_CENTER
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COMP_DIR = path.join(__dirname, '..', 'output', 'compositions', 'edl_v2');

const FILES = [
  'index.html', 'beat_02.html', 'beat_03.html', 'beat_04.html',
  'beat_05.html', 'beat_06.html', 'beat_07.html', 'beat_08.html', 'beat_09.html'
];

function fixHtml(content) {
  // 1. slamInBottom keyframe: translateX(-50%) → translate(-50%, -50%)
  content = content.replace(
    /@keyframes slamInBottom \{[\s\S]*?\}/g,
    `@keyframes slamInCenter {\n  from { opacity:0; transform:translate(-50%, -50%) scale(1.10); }\n  to   { opacity:1; transform:translate(-50%, -50%) scale(1); }\n}`
  );

  // 2. slamInCenter (already correct name in beat_03/beat_09) — ensure consistent
  content = content.replace(/slamInBottom/g, 'slamInCenter');

  // 3. slideUpCard keyframe: translateX(-50%) translateY(28px) → translate(-50%, calc(-50% + 28px))
  content = content.replace(
    /@keyframes slideUpCard \{[\s\S]*?\}/g,
    `@keyframes slideUpCenter {\n  from { opacity:0; transform:translate(-50%, calc(-50% + 28px)) scale(0.95); }\n  to   { opacity:1; transform:translate(-50%, -50%) scale(1); }\n}`
  );
  content = content.replace(/slideUpCard/g, 'slideUpCenter');

  // 4. .card position: bottom: 10% → top: 50%
  content = content.replace(/bottom: 10%;(\s+left: 50%;)/g, 'top: 50%;$1');

  // 5. .card static transform: translateX(-50%) → translate(-50%, -50%)
  //    Only replace the standalone transform on .card (not in keyframes or inner elements)
  content = content.replace(
    /(left: 50%;\s+transform:) translateX\(-50%\);(\s+width:)/g,
    '$1 translate(-50%, -50%);$2'
  );

  return content;
}

let fixed = 0;
for (const file of FILES) {
  const filePath = path.join(COMP_DIR, file);
  const original = fs.readFileSync(filePath, 'utf8');
  const updated = fixHtml(original);
  if (original !== updated) {
    fs.writeFileSync(filePath, updated, 'utf8');
    console.log(`  ✓ ${file}`);
    fixed++;
  } else {
    console.log(`  — ${file} (sin cambios)`);
  }
}
console.log(`\n${fixed}/${FILES.length} archivos actualizados`);
