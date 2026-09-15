import fs from 'fs';
import https from 'https';

const API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = '7D4Dff8JJEgToqdNYPc1'; // Publio - Commercial, energetic
const OUTPUT_PATH = 'output/voiceover.mp3';

const script = fs.readFileSync('output/voiceover_script.txt', 'utf8').trim();

const body = JSON.stringify({
  text: script,
  model_id: 'eleven_multilingual_v2',
  voice_settings: {
    stability: 0.45,
    similarity_boost: 0.75,
    style: 0.35,
    use_speaker_boost: true
  }
});

const options = {
  hostname: 'api.elevenlabs.io',
  path: `/v1/text-to-speech/${VOICE_ID}`,
  method: 'POST',
  headers: {
    'xi-api-key': API_KEY,
    'Content-Type': 'application/json',
    'Accept': 'audio/mpeg',
    'Content-Length': Buffer.byteLength(body)
  }
};

console.log('Generando voz con Publio (eleven_multilingual_v2)...');

const req = https.request(options, res => {
  if (res.statusCode !== 200) {
    let err = '';
    res.on('data', d => err += d);
    res.on('end', () => { console.error(`Error ${res.statusCode}:`, err); process.exit(1); });
    return;
  }
  const chunks = [];
  res.on('data', chunk => chunks.push(chunk));
  res.on('end', () => {
    fs.writeFileSync(OUTPUT_PATH, Buffer.concat(chunks));
    console.log(`Audio guardado en ${OUTPUT_PATH}`);
    console.log(`Tamaño: ${(fs.statSync(OUTPUT_PATH).size / 1024).toFixed(1)} KB`);
  });
});

req.on('error', e => { console.error(e); process.exit(1); });
req.write(body);
req.end();
