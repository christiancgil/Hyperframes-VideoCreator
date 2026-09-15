import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const envContent = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
const API_KEY = envContent.match(/OPENAI_API_KEY=(.+)/)?.[1]?.trim();
if (!API_KEY) throw new Error('OPENAI_API_KEY not found in .env');

const FRAMES_DIR = path.join(ROOT, 'output', 'frames_analysis');
const frames = fs.readdirSync(FRAMES_DIR)
  .filter(f => f.endsWith('.jpg'))
  .sort()
  .map(f => ({
    type: 'image_url',
    image_url: {
      url: `data:image/jpeg;base64,${fs.readFileSync(path.join(FRAMES_DIR, f)).toString('base64')}`,
      detail: 'low'
    }
  }));

console.log(`Analizando ${frames.length} frames con GPT-4o Vision...`);

const body = JSON.stringify({
  model: 'gpt-4o',
  max_tokens: 2000,
  messages: [{
    role: 'user',
    content: [
      {
        type: 'text',
        text: `Eres un experto en marketing de productos para Mercado Libre. Analiza estas capturas de un video de producto y genera 3 opciones de guion para voice-off en español latino.

Cada opción debe tener un enfoque distinto:
- Opción 1: Emocional/aspiracional — conecta con el deseo del comprador
- Opción 2: Informativo/features — destaca características técnicas clave
- Opción 3: Urgencia/conversión — genera urgencia y llama a la acción

Requisitos para cada opción:
- Duración estimada: 35-40 segundos al hablar (approx 90-100 palabras)
- Español latino neutro, no tuteo, no Spain-slang
- Tono entusiasta pero creíble
- Menciona el producto por nombre si puedes identificarlo
- Incluye una llamada a la acción al final

Responde SOLO con el formato:

OPCIÓN 1 — [nombre del enfoque]
[guion completo]

OPCIÓN 2 — [nombre del enfoque]
[guion completo]

OPCIÓN 3 — [nombre del enfoque]
[guion completo]`
      },
      ...frames
    ]
  }]
});

const response = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
  body
});

const data = await response.json();
if (!data.choices) { console.error(JSON.stringify(data)); process.exit(1); }

const result = data.choices[0].message.content.trim();
console.log('\n' + result);

fs.writeFileSync(path.join(ROOT, 'output', 'voiceover_options.txt'), result, 'utf8');
console.log('\n✓ Guardado en output/voiceover_options.txt');
