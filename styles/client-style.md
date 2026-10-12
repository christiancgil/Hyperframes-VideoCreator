# Estilo Visual — DM Seguros

Cliente: DM Seguros · Asesor de Seguros  
Actualizado: 2026-08-22

---

## Paleta de colores

| Nombre | Hex | Uso |
|---|---|---|
| Naranja (acento) | `#fb923c` | Títulos, highlights, CTA, botones, palabra activa karaoke |
| Marino (fondo cards) | `rgba(15,23,42,0.62)` | Fondo semitransparente de todas las cards |
| Marino puro | `#0f172a` | Fondo para GIFs de previsualización |
| Blanco | `#f8fafc` | Texto principal en cards |
| Texto suave | `#94a3b8` | Labels, subtexto, timestamps |
| Verde éxito | `#4ade80` | Contrastes positivos (ej. "Mejor" vs "Barato") |
| Rojo alerta | `#ef4444` | Símbolos de diferencia, negaciones |
| Glow naranja | `rgba(251,146,60,0.20)` | Sombras y glow de acento |

## Tipografía

```css
/* Títulos, números grandes, listas */
font-family: 'Space Grotesk', sans-serif;
font-weight: 700;

/* Cuerpo, descripciones, subtexto */
font-family: 'Inter', sans-serif;
font-weight: 500;
```

Google Fonts — incluir siempre en `<head>`:
```html
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
```

## Tamaños de fuente (9:16, 1080×1920px)

El cliente prefiere fuentes GRANDES y legibles en móvil. No negociar hacia abajo.

| Elemento | Tamaño mínimo |
|---|---|
| Título principal (Space Grotesk 700) | **90px** |
| Número grande | **160–200px** |
| Subtítulo / highlight | **70–75px** |
| Bullets / steps (Inter 600) | **60–65px** |
| Header label / tag sobre la card | **28–32px** (mayúsculas, tracking 0.15em) |
| Botón CTA | **60px** |
| Cuerpo de apoyo | **42px** |

> Si el cliente pide "más grande", aumentar un 20–25% sobre los valores actuales.

## Estilo de cards

⚠️ IMPORTANTE: el render usa Chrome headless con `--disable-gpu`. `backdrop-filter` NO funciona en ese entorno.
Usar siempre fondo sólido semitransparente con opacidad ≥ 0.82:

```css
/* Card estándar — USAR SIEMPRE ESTE, sin backdrop-filter */
background: rgba(10, 15, 30, 0.88);
border-top: 3px solid #fb923c;
border-radius: 16px;
padding: 36px 44px;
box-shadow: 0 8px 40px rgba(0, 0, 0, 0.75);
```

Variante bullet-list (acento lateral izquierdo):
```css
background: rgba(10, 15, 30, 0.88);
border-left: 4px solid #fb923c;
border-radius: 12px;
padding: 32px 40px;
```

Variante cierre:
```css
background: rgba(10, 15, 30, 0.92);
border: 2px solid rgba(251,146,60,0.60);
box-shadow: 0 0 48px rgba(251,146,60,0.25), 0 8px 40px rgba(0,0,0,0.8);
```

## Estilo de listas (bullet-list)

Siempre incluir un header label encima de la lista y bullets naranja:

```html
<div class="label">TAMBIÉN INFLUYE…</div>   <!-- o el contexto del beat -->
<ul>
  <li>Ítem uno</li>
  <li>Ítem dos</li>
</ul>
```

```css
.label {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 30px;
  font-weight: 700;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: #fb923c;
  margin-bottom: 20px;
}
ul { list-style: none; padding: 0; margin: 0; }
li {
  font-family: 'Inter', sans-serif;
  font-weight: 600;
  font-size: 62px;
  color: #f8fafc;
  padding-left: 56px;
  position: relative;
  margin-bottom: 16px;
}
li::before {
  content: "•";
  color: #fb923c;
  font-size: 72px;
  position: absolute;
  left: 0;
  top: -8px;
  line-height: 1;
}
```

## Animaciones — Estilo ENÉRGICO

Entradas rápidas, pop-in en items de lista, delay escalonado.

```css
@keyframes slideDown {
  from { opacity: 0; transform: translateX(-50%) translateY(-22px) scale(0.97); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
}
@keyframes slideUp {
  from { opacity: 0; transform: translateX(-50%) translateY(24px) scale(0.97); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
}
@keyframes slamIn {
  from { opacity: 0; transform: translate(-50%,-50%) scale(1.10); }
  to   { opacity: 1; transform: translate(-50%,-50%) scale(1); }
}
@keyframes popIn {
  from { opacity: 0; transform: scale(0.78) translateX(-10px); }
  to   { opacity: 1; transform: scale(1) translateX(0); }
}

/* Duración de entradas */
slideDown/slideUp: 0.28s cubic-bezier(0.16, 1, 0.3, 1)
slamIn:           0.35s cubic-bezier(0.34, 1.56, 0.64, 1)
popIn (bullets):  0.22s cubic-bezier(0.34, 1.56, 0.64, 1)

/* Delay escalonado bullets — calibrar al timestamp del audio */
/* Ej: bullet 2 aparece cuando el hablante lo menciona → delay = t_hablante - t_inicio_beat */
```

## Posicionamiento de cards — 9:16 (720×1280)

El hablante aparece **centrado** en cámara. Instagram Reels ocupa ~13% superior.

```text
CARD_TOP (intro, asesor):
  top: 16%;   ← MÍNIMO para no solapar con barra de Reels/Amigos de Instagram
  left: 50%; transform: translateX(-50%); width: 88%;

CARD_BOTTOM (listas, highlights):
  bottom: 10%;
  left: 50%; transform: translateX(-50%); width: 88%;

CARD_CENTER (impacto, quote):
  top: 50%; left: 50%; transform: translate(-50%,-50%); width: 82%;

CIERRE (logo + CTA):
  top: 33%; left: 50%; transform: translateX(-50%); width: 85%;
```

> ⚠️ Nunca usar `top: 6%` — queda tapado por la UI de Instagram.  
> ⚠️ Nunca cubrir la cara del hablante (zona central 20%–70% de alto).

## Logo DM Seguros

Archivos disponibles: `brand/logo/logo-transparent.png` · `brand/logo/logo.png`

- Escudo DM plateado/azul + texto "SEGUROS · ASESOR DE SEGUROS"
- **En Puppeteer (capture.js):** embeber siempre como base64 para evitar errores de path con `file://`

  ```js
  const logoB64 = 'data:image/png;base64,' + fs.readFileSync('brand/logo/logo-transparent.png').toString('base64');
  // Usar en HTML: <img src="${logoB64}">
  ```

- **En cierres:** logo centrado, width 42–44% de la composición, `object-fit: contain`
- **Watermark continuo:** NO usar en 9:16

## Estilo de edición: ENÉRGICO + EDUCATIVO

- Listas que aparecen punto a punto sincronizadas con el audio del hablante
- Cada bullet/step aparece con `popIn` justo cuando el hablante lo menciona (calcular delay = t_palabra - t_inicio_beat)
- Máximo 4 bullets por card — si hay más, romper en dos cards consecutivas
- Card de título al inicio presentando el tema
- Card de cierre con logo DM Seguros + CTA "Enlace en mi perfil"
- Nunca dejar tramos sin refuerzo visual > 3s

## Aspect ratio del cliente

- Formato: **9:16** (vertical — Reels, TikTok, Shorts)
- Vídeos iPhone: resolución raw 1280×720 con `rotation=-90` → tratar siempre como 720×1280
- Fix rotation: `ffmpeg -i input.mp4 -c:v libx264 -metadata:s:v:0 rotate=0 output.mp4` (auto-rotate, sin transpose)
- Blur de cards: `blur(8px)`
- FPS: 30

## Proyectos realizados

| Proyecto | Fecha | Tema |
| --- | --- | --- |
| reel_seguros | 2026-08-21 | Barato ≠ Mejor — 3 preguntas antes de contratar |
| reel2_seguros | 2026-08-22 | Qué hacer si chocas — 4 pasos post-accidente |
