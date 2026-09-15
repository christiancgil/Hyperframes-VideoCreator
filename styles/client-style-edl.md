# Estilo Visual — Agencia EDL (Esencia Digital Labs)

Cliente: Esencia Digital Labs · Agencia de IA & Automatización con n8n  
Creado: 2026-08-22

---

## Paleta de colores

| Nombre | Hex | Uso |
| --- | --- | --- |
| Violeta eléctrico (principal) | `#7c3aed` | Títulos, highlights, bordes de cards, acento primario |
| Violeta suave (glow) | `rgba(124,58,237,0.30)` | Sombras, glows, gradientes de fondo |
| Cyan (secundario) | `#06b6d4` | Datos, stats, nodos, flujos de automatización |
| Cyan suave (glow) | `rgba(6,182,212,0.25)` | Brillo de datos, líneas de conexión |
| Naranja CTA | `#fb923c` | Botones de acción, llamadas a la acción, urgencia |
| Blanco | `#f8fafc` | Texto principal en cards |
| Texto suave | `#94a3b8` | Labels, subtexto, timestamps |
| Fondo card | `rgba(6,6,20,0.75)` | Fondo semitransparente de todas las cards |
| Negro profundo | `#060614` | Color base para GIFs de previsualización |

## Tipografía

```css
/* Títulos — futurista, impactante */
font-family: 'Syne', sans-serif;
font-weight: 800;

/* Cuerpo — limpio, legible */
font-family: 'Inter', sans-serif;
font-weight: 400;

/* Labels técnicos / código */
font-family: 'JetBrains Mono', monospace;
font-weight: 400;
```

Google Fonts — incluir siempre en `<head>`:
```html
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
```

## Tamaños de fuente (9:16, 720×1280px)

| Elemento | Tamaño mínimo |
| --- | --- |
| Título principal (Syne) | **54px** |
| Subtítulo / highlight | **40–48px** |
| Cuerpo / sub | **22px** |
| Bullets / steps | **28–30px** |
| Label / tag / badge | **15–17px** |
| Código / monospace | **18px** |
| Botón CTA | **22px** |
| Emoji / icono display | **52px** |

## Estilo de cards — Futurista + Semitransparente

Fondo negro profundo 75%, borde violeta eléctrico, glow dual violeta+cyan:

```css
background: rgba(6, 6, 20, 0.75);
backdrop-filter: blur(12px);
-webkit-backdrop-filter: blur(12px);
border: 1px solid rgba(124, 58, 237, 0.50);
border-radius: 16px;
box-shadow:
  0 0 32px rgba(124,58,237,0.20),
  0 0 64px rgba(6,182,212,0.10),
  0 4px 24px rgba(0,0,0,0.7);
```

Variante con acento cyan (cards de datos / automatización):
```css
border-color: rgba(6, 182, 212, 0.50);
box-shadow: 0 0 32px rgba(6,182,212,0.20), 0 4px 24px rgba(0,0,0,0.7);
```

Badge / chip tecnológico:
```css
background: rgba(124,58,237,0.15);
border: 1px solid rgba(124,58,237,0.50);
border-radius: 100px;
padding: 6px 16px;
color: #a78bfa;
font: 600 15px 'Inter', sans-serif;
letter-spacing: 0.10em;
text-transform: uppercase;
```

## Animaciones — ENÉRGICO + FUTURISTA

```css
@keyframes slideDown {
  from { opacity:0; transform:translateX(-50%) translateY(-28px) scale(0.95); }
  to   { opacity:1; transform:translateX(-50%) translateY(0) scale(1); }
}
@keyframes slideUp {
  from { opacity:0; transform:translateX(-50%) translateY(28px) scale(0.95); }
  to   { opacity:1; transform:translateX(-50%) translateY(0) scale(1); }
}
@keyframes slamIn {
  from { opacity:0; transform:translate(-50%,-50%) scale(1.12); }
  to   { opacity:1; transform:translate(-50%,-50%) scale(1); }
}
@keyframes popIn {
  from { opacity:0; transform:scale(0.70) translateX(-14px); }
  to   { opacity:1; transform:scale(1) translateX(0); }
}
@keyframes glowPulse {
  0%,100% { box-shadow: 0 0 32px rgba(124,58,237,0.20), 0 0 64px rgba(6,182,212,0.10); }
  50%     { box-shadow: 0 0 48px rgba(124,58,237,0.40), 0 0 96px rgba(6,182,212,0.20); }
}
@keyframes typeIn {
  from { width: 0; }
  to   { width: 100%; }
}

/* Duraciones */
/* slideDown/slideUp: 0.25s cubic-bezier(0.16,1,0.3,1) */
/* slamIn:           0.30s cubic-bezier(0.34,1.56,0.64,1) */
/* popIn bullets:    0.20s cubic-bezier(0.34,1.56,0.64,1) */
/* glowPulse:        2.5s ease-in-out infinite */
```

**Efectos especiales para contenido de IA:**
- `glowPulse` en cards de impacto y botones CTA
- Efecto máquina de escribir (`typeIn`) para frases clave
- Contadores animados para stats (ej. "300% más rápido")
- Líneas de conexión animadas entre nodos (SVG path animation)

## Posicionamiento de cards — 9:16 (720×1280)

```text
CARD_TOP (intro, badge IA):
  top: 16%;   ← mínimo para safe zone Instagram
  left: 50%; transform: translateX(-50%); width: 88%;

CARD_BOTTOM (listas, features, casos de uso):
  bottom: 10%;
  left: 50%; transform: translateX(-50%); width: 88%;

CARD_CENTER (stat de impacto, quote, resultado):
  top: 50%; left: 50%; transform: translate(-50%,-50%); width: 84%;

CIERRE (logo + CTA):
  top: 30%; left: 50%; transform: translateX(-50%); width: 85%;
```

## Logo Esencia Digital Labs

Archivos: `brand/Logo Esencia Digital Labs Trasparente.png` · `brand/Logo Esencia Digital Labs.png`

- **En cards oscuras:** usar `Logo Esencia Digital Labs Trasparente.png` directamente
- **En Puppeteer (capture.js):** embeber como base64

  ```js
  const logoB64 = 'data:image/png;base64,' +
    fs.readFileSync('brand/Logo Esencia Digital Labs Trasparente.png').toString('base64');
  ```

- **En cierres:** logo centrado, width 45%, `object-fit: contain`
- **Watermark:** NO usar en 9:16

## Estilo de edición: DINÁMICO + ENÉRGICO

- Cards con datos, porcentajes y resultados — son el alma del contenido de IA
- Bullets con `popIn` sincronizados con el audio del hablante
- Stats y números con contadores animados y glow cyan
- Badge de "IA / n8n / Automatización" en intro (chip superior izquierdo)
- Card de cierre: logo + headline de valor + CTA naranja pulsante
- Nunca dejar tramos sin refuerzo visual > 3s
- Máximo 4 bullets por card

## Aspect ratio del cliente

- Formato: **9:16** (vertical — Reels, TikTok, Shorts)
- Blur de cards: `blur(12px)` (más intenso que DM Seguros para efecto glass premium)
- FPS: 30
- Posición del hablante: **Centro**

## Proyectos realizados

| Proyecto | Fecha | Tema |
| --- | --- | --- |
| — | — | Pendiente primer render |
