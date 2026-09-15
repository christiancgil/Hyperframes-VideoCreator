// Genera 13 segmentos de audio con ElevenLabs para el reel de restaurante
// Run: node scripts/tts_restaurante.mjs

import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const envContent = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
const API_KEY = envContent.split('\n').find(l => l.startsWith('ELEVENLABS_API_KEY='))?.split('=')[1]?.trim();
if (!API_KEY) { console.error('No ELEVENLABS_API_KEY en .env'); process.exit(1); }

const VOICE_ID = 'TjldTGy7iELoRNPa6sJh';
const OUT_DIR  = path.join(ROOT, 'output', 'edl_tts');
fs.mkdirSync(OUT_DIR, { recursive: true });

const SCENES = [
  { n:  1, text: '¿Sabías que tu restaurante puede estar perdiendo plata todos los días sin que te des cuenta?' },
  { n:  2, text: 'Tus clientes te escriben por WhatsApp y nadie les responde a tiempo. En hora pico, cada mensaje sin contestar es un pedido que se pierde.' },
  { n:  3, text: 'Tu menú sigue siendo un PDF o un cartón que ya no refleja ni los precios ni los platos que ofreces hoy.' },
  { n:  4, text: 'Las reservas las manejas en un cuaderno, nadie te deja reseñas en Google y publicar en redes es lo último en tu lista.' },
  { n:  5, text: '¿Y si todo eso lo resolviera una inteligencia artificial? No es el futuro, ya existe. Y nosotros lo montamos completo.' },
  { n:  6, text: 'Uno. Página web profesional que posiciona tu restaurante y convierte visitas en clientes.' },
  { n:  7, text: 'Dos. Carta digital con QR. Tu cliente escanea desde la mesa y ve el menú siempre actualizado.' },
  { n:  8, text: 'Tres. Un asistente con inteligencia artificial que atiende tu WhatsApp 24/7. Toma pedidos, responde preguntas y lo ves todo en un panel en tiempo real.' },
  { n:  9, text: 'Cuatro. Reservas automáticas. La IA agenda, confirma, recuerda al cliente y libera la mesa si no llega.' },
  { n: 10, text: 'Cinco. Después de cada visita, la IA le escribe al cliente para que te deje reseña en Google. Más reseñas, más clientes nuevos.' },
  { n: 11, text: 'Y seis. Tú subes las fotos de tus platos y la inteligencia artificial te genera los posts listos para publicar.' },
  { n: 12, text: 'No es una app de delivery. No es otro Rappi. Es un sistema con inteligencia artificial que lleva TU marca, atiende a TUS clientes y trabaja por tu restaurante mientras tú te enfocas en lo que mejor haces: la cocina.' },
  { n: 13, text: 'Escríbeme y te muestro cómo la IA puede trabajar para tu restaurante.' },
];

const VOICE_SETTINGS = {
  stability: 0.48,
  similarity_boost: 0.78,
  style: 0.28,
  use_speaker_boost: true,
};

function generateSegment(scene) {
  return new Promise((resolve, reject) => {
    const pad = String(scene.n).padStart(2, '0');
    const outPath = path.join(OUT_DIR, `scene_${pad}.mp3`);

    const body = JSON.stringify({
      text: scene.text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: VOICE_SETTINGS,
    });

    const options = {
      hostname: 'api.elevenlabs.io',
      path: `/v1/text-to-speech/${VOICE_ID}`,
      method: 'POST',
      headers: {
        'xi-api-key': API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Accept': 'audio/mpeg',
      },
    };

    const req = https.request(options, (res) => {
      if (res.statusCode !== 200) {
        let err = '';
        res.on('data', c => err += c);
        res.on('end', () => reject(new Error(`HTTP ${res.statusCode}: ${err}`)));
        return;
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        fs.writeFileSync(outPath, Buffer.concat(chunks));
        resolve(outPath);
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

console.log(`Generando ${SCENES.length} segmentos con ElevenLabs (voz ${VOICE_ID})...`);

for (const scene of SCENES) {
  const pad = String(scene.n).padStart(2, '0');
  process.stdout.write(`  Escena ${pad}: `);
  try {
    const p = await generateSegment(scene);
    const size = (fs.statSync(p).size / 1024).toFixed(0);
    console.log(`${size}KB ✓`);
  } catch (e) {
    console.error(`ERROR — ${e.message}`);
    process.exit(1);
  }
}

console.log(`\n✓ Audios en: ${OUT_DIR}`);
