// Transcribe merged video con OpenAI Whisper API usando https nativo
import fs from 'fs';
import https from 'https';
import { Buffer } from 'buffer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = path.join(__dirname, '..');

const envContent = fs.readFileSync(path.join(BASE, '.env'), 'utf8');
const API_KEY = envContent.split('\n').find(l => l.startsWith('OPENAI_API_KEY='))?.split('=')[1]?.trim();
if (!API_KEY) { console.error('No OPENAI_API_KEY en .env'); process.exit(1); }

const VIDEO_PATH  = path.join(BASE, 'output', 'merged.mp4');
const OUTPUT_PATH = path.join(BASE, 'output', 'transcript.json');

const boundary   = '----FormBoundary' + Math.random().toString(36).slice(2);
const fileBuffer = fs.readFileSync(VIDEO_PATH);

const body = Buffer.concat([
  Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="merged.mp4"\r\nContent-Type: video/mp4\r\n\r\n`),
  fileBuffer,
  Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n`),
  Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="response_format"\r\n\r\nverbose_json\r\n`),
  Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="timestamp_granularities[]"\r\n\r\nsegment\r\n`),
  Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\nes\r\n`),
  Buffer.from(`--${boundary}--\r\n`)
]);

const options = {
  hostname: 'api.openai.com',
  path: '/v1/audio/transcriptions',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Content-Length': body.length
  }
};

console.log('Enviando a Whisper API...');

const req = https.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    if (res.statusCode !== 200) { console.error(`Error ${res.statusCode}:`, data); process.exit(1); }
    const json = JSON.parse(data);
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(json, null, 2), 'utf8');
    console.log(`Transcript guardado en ${OUTPUT_PATH}`);
    console.log(`Duración: ${json.duration?.toFixed(2)}s`);
    console.log(`\nTexto completo:\n${json.text}`);
    console.log('\nSegmentos:');
    json.segments?.forEach(s =>
      console.log(`  [${s.start.toFixed(2)}→${s.end.toFixed(2)}s] ${s.text.trim()}`)
    );
  });
});

req.on('error', e => { console.error(e); process.exit(1); });
req.write(body);
req.end();
