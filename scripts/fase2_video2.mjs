// fase2_video2.mjs — cut silences, produce edl_v2_edited.mp4
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const NORM_DIR = path.join(ROOT, 'input', 'normalized');
const OUTPUT_DIR = path.join(ROOT, 'output');
const FFMPEG = 'C:\\Users\\cgil\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffmpeg.exe';
const FFPROBE = 'C:\\Users\\cgil\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffprobe.exe';

const offsets = JSON.parse(fs.readFileSync(path.join(ROOT, 'input', 'clip_offsets.json'), 'utf8'));

// Keep intervals in merged timeline (translated from silence analysis)
// Silences removed: 0→1.58, 11.04→13.58, 23.06→24.50, 33.52→34.62, 39.62→43.38,
//                   54.52→56.64, 71.76→74.24, 83.40→85.34, 91.98→93.54,
//                   99.60→100.60, 104.52→106.02, 113.90→114.73
const KEEP_MERGED = [
  { start: 1.58,   end: 11.04  },
  { start: 13.58,  end: 23.06  },
  { start: 24.50,  end: 33.52  },
  { start: 34.62,  end: 39.62  },
  { start: 43.38,  end: 54.52  },
  { start: 56.64,  end: 71.76  },
  { start: 74.24,  end: 83.40  },
  { start: 85.34,  end: 91.98  },
  { start: 93.54,  end: 99.60  },
  { start: 100.60, end: 104.52 },
  { start: 106.02, end: 113.90 },
];

function findClip(mergedTime) {
  return offsets.find(c => mergedTime >= c.start_in_merged && mergedTime < c.start_in_merged + c.duration);
}

const segments = [];
let editedTime = 0;

for (const k of KEEP_MERGED) {
  const clipStart = findClip(k.start);
  const clipEnd   = findClip(k.end - 0.001);

  if (!clipStart || !clipEnd || clipStart.file !== clipEnd.file) {
    console.error(`Segment ${k.start}→${k.end} crosses clip boundary — needs splitting`);
    process.exit(1);
  }

  const clipFile = path.join(ROOT, 'input', clipStart.file.replace(/\//g, path.sep));
  const ss = k.start - clipStart.start_in_merged;
  const to = k.end   - clipStart.start_in_merged;
  const dur = k.end - k.start;

  segments.push({ file: clipFile, ss, to, dur, editedStart: editedTime, editedEnd: editedTime + dur });
  editedTime += dur;

  console.log(`  seg ${segments.length}: [${k.start.toFixed(2)}→${k.end.toFixed(2)}] from ${path.basename(clipStart.file)} [${ss.toFixed(2)}→${to.toFixed(2)}] → edited [${(editedTime-dur).toFixed(2)}→${editedTime.toFixed(2)}]`);
}

console.log(`\nTotal edited: ${editedTime.toFixed(2)}s (${KEEP_MERGED.length} segments)`);

// Save edit timeline JSON for beat planning
const timeline = {
  total_duration: editedTime,
  segments: segments.map((s, i) => ({
    index: i + 1,
    source: path.basename(s.file),
    source_start: s.ss,
    source_end: s.to,
    edited_start: s.editedStart,
    edited_end: s.editedEnd,
    duration: s.dur
  })),
  transcript_in_edited: [
    { text: '¿Sabes cuánto dinero estás perdiendo por no tener una buena presencia digital o no', start: 0.00, end: 6.16 },
    { text: 'contestar los mensajes de tus clientes a tiempo?', start: 6.84, end: 9.46 },
    { text: 'Muchas veces te escriben a las 8 de la noche, en un horario en que tú no tienes espacio', start: 9.46, end: 15.20 },
    { text: 'ni tiempo para responder y terminas respondiendo al día siguiente.', start: 15.20, end: 18.94 },
    { text: 'Y lo que muchas veces pasa es que en ese lapso de tiempo de la respuesta, el cliente termina', start: 18.94, end: 25.60 },
    { text: 'comprándole a otra persona.', start: 25.70, end: 27.96 },
    { text: 'Esa situación pasa todos los días y tú ni siquiera te das de cuenta.', start: 27.96, end: 32.96 },
    { text: 'Por esta razón, en Esencia Digital Labs, montamos sistemas con inteligencia artificial', start: 32.96, end: 40.30 },
    { text: 'que responden al instante, todos los días, a cualquier hora.', start: 40.90, end: 44.10 },
    { text: 'Y no solo responden, también los buscan, los atienden, los filtran y los agendan,', start: 44.10, end: 53.30 },
    { text: 'como un equipo que está trabajando 100% 24-7, sin una remuneración.', start: 53.30, end: 59.22 },
    { text: 'Con ello, tú dejas de estar apagando incendios todo el tiempo y te dedicas a lo verdaderamente importante,', start: 59.22, end: 65.94 },
    { text: 'hacer crecer tu negocio.', start: 65.94, end: 68.38 },
    { text: 'En EDL, traemos tecnología de grandes corporaciones al alcance de tu negocio.', start: 68.38, end: 75.02 },
    { text: 'Si tienes un negocio, escríbenos, síguenos en todas nuestras redes sociales.', start: 75.02, end: 81.08 },
    { text: 'Toda la información la encuentras en el enlace de la biografía.', start: 81.08, end: 85.00 },
    { text: 'Escribe la palabra automatización y obtén un 10% de descuento por apertura de actividades.', start: 85.00, end: 92.88 },
  ]
};
fs.writeFileSync(path.join(OUTPUT_DIR, 'edl_v2_timeline.json'), JSON.stringify(timeline, null, 2));

// Cut each segment
const segFiles = [];
const segDir = path.join(OUTPUT_DIR, 'segments_v2');
fs.mkdirSync(segDir, { recursive: true });

for (let i = 0; i < segments.length; i++) {
  const s = segments[i];
  const outFile = path.join(segDir, `seg_${String(i+1).padStart(2,'0')}.mp4`);
  console.log(`\nCortando seg ${i+1}/${segments.length}...`);
  execSync(`"${FFMPEG}" -i "${s.file}" -ss ${s.ss} -to ${s.to} -c:v copy -c:a aac -b:a 192k "${outFile}" -y`, { stdio: 'inherit' });

  // Validate audio
  const silCount = parseInt(execSync(`"${FFMPEG}" -i "${outFile}" -af silencedetect=n=-50dB:d=0.5 -f null - 2>&1`).toString().match(/silence_start/g)?.length ?? '0');
  console.log(`  → ${path.basename(outFile)} (${s.dur.toFixed(2)}s, ${silCount} silencios detectados)`);
  segFiles.push(outFile);
}

// Build concat list and join
const concatListPath = path.join(segDir, 'concat.txt');
fs.writeFileSync(concatListPath, segFiles.map(f => `file '${f}'`).join('\n'));

const EDITED = path.join(OUTPUT_DIR, 'edl_v2_edited.mp4');
console.log('\nUniendo segmentos...');
execSync(`"${FFMPEG}" -f concat -safe 0 -i "${concatListPath}" -c:v copy -c:a aac -b:a 192k "${EDITED}" -y`, { stdio: 'inherit' });

// Final validation
const dur = parseFloat(execSync(`"${FFPROBE}" -v quiet -show_entries format=duration -of csv=p=0 "${EDITED}"`).toString().trim());
console.log(`\n✓ edl_v2_edited.mp4 — Duración: ${dur.toFixed(2)}s (esperado ~${editedTime.toFixed(2)}s)`);
