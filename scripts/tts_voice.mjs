import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const envContent = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
const API_KEY = envContent.match(/ELEVENLABS_API_KEY=(.+)/)?.[1]?.trim();
if (!API_KEY) throw new Error('ELEVENLABS_API_KEY not found in .env');

const VOICE_ID = process.argv[2];
const OUTPUT_PATH = process.argv[3];

const text = fs.readFileSync(path.join(ROOT, 'output', 'voiceover_script.txt'), 'utf8').trim();
const body = JSON.stringify({
  text,
  model_id: 'eleven_multilingual_v2',
  voice_settings: { stability: 0.20, similarity_boost: 0.80, style: 0.70, use_speaker_boost: true }
});

const options = {
  hostname: 'api.elevenlabs.io',
  path: `/v1/text-to-speech/${VOICE_ID}`,
  method: 'POST',
  headers: { 'xi-api-key': API_KEY, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg', 'Content-Length': Buffer.byteLength(body) }
};

const req = https.request(options, res => {
  if (res.statusCode !== 200) { let e=''; res.on('data',d=>e+=d); res.on('end',()=>{console.error(`Error ${res.statusCode}:`,e);process.exit(1);}); return; }
  const chunks = [];
  res.on('data', chunk => chunks.push(chunk));
  res.on('end', () => { fs.writeFileSync(OUTPUT_PATH, Buffer.concat(chunks)); console.log(`Guardado: ${OUTPUT_PATH} (${(fs.statSync(OUTPUT_PATH).size/1024).toFixed(1)} KB)`); });
});
req.on('error', e => { console.error(e); process.exit(1); });
req.write(body); req.end();
