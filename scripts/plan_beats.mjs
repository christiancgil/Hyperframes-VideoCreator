import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const envContent = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
const API_KEY = envContent.match(/OPENAI_API_KEY=(.+)/)?.[1]?.trim();

const script = fs.readFileSync(path.join(ROOT, 'output', 'voiceover_script.txt'), 'utf8').trim();
const FRAMES_DIR = path.join(ROOT, 'output', 'frames_analysis');
const frames = fs.readdirSync(FRAMES_DIR).filter(f => f.endsWith('.jpg')).sort()
  .map(f => ({
    type: 'image_url',
    image_url: { url: `data:image/jpeg;base64,${fs.readFileSync(path.join(FRAMES_DIR, f)).toString('base64')}`, detail: 'low' }
  }));

const prompt = `Eres un editor de video experto en motion graphics para Mercado Libre.

VIDEO: 41 segundos, 1080x1920 (portrait 9:16), producto smartwatch con función de carátulas personalizadas con IA.

VOICEOVER SCRIPT (ya grabado, 40s):
"${script}"

ESTILO VISUAL:
- Acento: #fb923c (naranja)
- Fondo cards: glass transparente rgba(26,26,26,0.15) con backdrop-filter blur(8px)
- Tipografía: Space Grotesk (títulos) + Inter (cuerpo)
- Motion: energético — popIn rápido, fadeUp 0.22s, stagger en listas
- Hablante: centrado — cards en parte superior o inferior
- SIN logo

TIMING ESTIMADO DEL SCRIPT:
0s   — "Imagina un mundo donde cada segundo refleja quién eres."
5s   — "Con nuestro creador de carátulas personalizadas con IA..."
10s  — "...transforma tu smartwatch en un lienzo único para tus sueños."
14s  — "Desde personajes icónicos hasta tus momentos favoritos..."
19s  — "...lleva contigo lo que más amas."
21s  — "Elige entre miles de diseños, personaliza los colores, los estilos..."
27s  — "...y los datos que quieres ver."
29s  — "La inteligencia artificial hace el trabajo creativo por ti, en segundos."
33s  — "Celebra cada instante y haz que cada mirada al reloj sea una experiencia emocionante."
37s  — "Es hora de dar el paso y personalizar tu tiempo como nunca antes."
39s  — "Descubre más sobre esta experiencia única hoy mismo."

Define exactamente 6-7 beats de motion graphics. Para cada beat indica:
- beat_id: nombre del archivo HTML (beat_01.html, etc.)
- start: timestamp en segundos
- duration: duración en segundos
- tipo: título_top | card_bottom | highlight_floating | cierre
- contenido: texto exacto a mostrar (corto, máximo 2 líneas)
- animacion: popIn | fadeUp | slideInUp+stagger
- posicion: top | bottom | floating_top

Responde SOLO con JSON válido, sin markdown:
[{"beat_id":"beat_01.html","start":0.5,"duration":4.5,...},...]`;

const response = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
  body: JSON.stringify({
    model: 'gpt-4o',
    max_tokens: 1500,
    messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, ...frames] }]
  })
});

const data = await response.json();
if (!data.choices) { console.error(JSON.stringify(data)); process.exit(1); }

const result = data.choices[0].message.content.trim();
console.log(result);
fs.writeFileSync(path.join(ROOT, 'output', 'beats_plan.json'), result, 'utf8');
console.log('\n✓ Plan guardado en output/beats_plan.json');
