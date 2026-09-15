import { execFileSync } from 'child_process';
import { writeFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE    = path.join(__dirname, '..');
const FFMPEG  = 'C:/Users/cgil/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.1-full_build/bin/ffmpeg.exe';
// ffmpeg filter escaping:
// - "C:" must be escaped as C\: within filter option values
// - commas inside expressions (enable=, alpha=) must be wrapped in single quotes
// - single quotes here are ffmpeg-level escaping (not shell), passed as literal chars via execFileSync
const FB      = "'C\\:/Windows/Fonts/arialbd.ttf'";
const FR      = "'C\\:/Windows/Fonts/arial.ttf'";
const IN      = path.join(BASE, 'output', 'merged.mp4');
const OUT     = path.join(BASE, 'output', 'final', 'reel_instagram.mp4');

// Fade in/out helper — wrapped in single quotes for ffmpeg option escaping
const fade = (s, e) =>
  `'if(lt(t-${s},0.5),(t-${s})/0.5,if(lt(t,${e}-0.5),1,(${e}-t)/0.5))'`;

// Card definitions [start, end, title, subtitle, footnote?]
const cards = [
  { s: 8,  e: 13, title: 'LA MAYOR DIFERENCIA',   sub: 'Recupera tu seguridad con la valoracion correcta', foot: null },
  { s: 37, e: 45, title: 'VALORACION INTEGRAL',   sub: 'Dientes - Radiografias - Rostro completo',          foot: null },
  { s: 73, e: 83, title: 'AGENDA TU VALORACION',  sub: 'Diagnostico exacto + plan de tratamiento',          foot: 'Ajustado a tus necesidades y presupuesto' },
];

const vfParts = ['scale=1080:1920:flags=lanczos'];

for (const c of cards) {
  const en = `'between(t,${c.s},${c.e})'`;
  const a  = fade(c.s, c.e);
  const boxH = c.foot ? 210 : 175;
  const boxY = 1920 - 60 - boxH;

  // Card background
  vfParts.push(`drawbox=x=60:y=${boxY}:w=960:h=${boxH}:color=0x1e293b@0.75:t=fill:enable=${en}`);
  // Left accent bar (blue)
  vfParts.push(`drawbox=x=60:y=${boxY}:w=4:h=${boxH}:color=0x60a5fa:t=fill:enable=${en}`);
  // Title
  vfParts.push(`drawtext=fontfile=${FB}:text='${c.title}':x=(w-text_w)/2:y=${boxY+22}:fontsize=46:fontcolor=0x60a5fa:enable=${en}:alpha=${a}`);
  // Subtitle
  vfParts.push(`drawtext=fontfile=${FR}:text='${c.sub}':x=(w-text_w)/2:y=${boxY+80}:fontsize=30:fontcolor=0xe0e0e0:enable=${en}:alpha=${a}`);
  // Footnote (card 3 only)
  if (c.foot) {
    vfParts.push(`drawtext=fontfile=${FR}:text='${c.foot}':x=(w-text_w)/2:y=${boxY+122}:fontsize=26:fontcolor=0x888888:enable=${en}:alpha=${a}`);
  }
}

const VF = vfParts.join(',');
const AF = 'highpass=f=80,afftdn=nf=-25,equalizer=f=2500:width_type=o:width=2:g=5,loudnorm=I=-16:TP=-1.5:LRA=11';

// Write filter to a file to avoid shell escaping issues
const filterFile = path.join(BASE, 'output', 'vfilter.txt');
writeFileSync(filterFile, VF, 'utf8');

console.log('=== RENDER FINAL ===');
console.log('Input:', IN);
console.log('Output:', OUT);
console.log('Tarjetas:', cards.map(c => `[${c.s}s→${c.e}s] ${c.title}`).join(', '));
console.log('Iniciando ffmpeg...\n');

try {
  execFileSync(FFMPEG, [
    '-i', IN,
    '-vf', VF,
    '-af', AF,
    '-c:v', 'libx264',
    '-crf', '18',
    '-preset', 'slow',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-movflags', '+faststart',
    '-pix_fmt', 'yuv420p',
    OUT, '-y'
  ], { stdio: 'inherit' });
  console.log('\nRender completado:', OUT);
} catch (e) {
  console.error('Error en render:', e.message);
  process.exit(1);
}
