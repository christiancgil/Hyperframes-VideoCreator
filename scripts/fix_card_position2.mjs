// fix_card_position2.mjs — clean up orphaned CSS lines from previous fix
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COMP_DIR = path.join(__dirname, '..', 'output', 'compositions', 'edl_v2');

const FILES = [
  'index.html', 'beat_02.html', 'beat_03.html', 'beat_04.html',
  'beat_05.html', 'beat_06.html', 'beat_07.html', 'beat_08.html', 'beat_09.html'
];

function cleanHtml(content) {
  // Remove orphaned `  to   { opacity:1; transform:translateX(-50%)... }\n}` lines
  // These appear after keyframe blocks that were only partially replaced
  content = content.replace(/\n  to\s+\{ opacity:1; transform:translateX\(-50%\)[^}]*\}\n\}/g, '');
  content = content.replace(/\n  to\s+\{ opacity:1; transform:translateX\(-50%\)[^}]*\}\s*\}/g, '');
  return content;
}

let fixed = 0;
for (const file of FILES) {
  const filePath = path.join(COMP_DIR, file);
  const original = fs.readFileSync(filePath, 'utf8');
  const updated = cleanHtml(original);
  if (original !== updated) {
    fs.writeFileSync(filePath, updated, 'utf8');
    console.log(`  ✓ ${file} limpiado`);
    fixed++;
  } else {
    console.log(`  — ${file} (sin huérfanos)`);
  }
}
console.log(`\n${fixed} archivos limpiados`);
