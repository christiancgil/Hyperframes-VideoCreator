# Estilo Visual — Dr. Felipe Acevedo

Cliente: Dr. Felipe Acevedo · Estética y Rehabilitación Dental  
Actualizado: 2026-09-01

---

## Paleta de colores

| Nombre | Hex | Uso |
|---|---|---|
| Azul navy (acento principal) | `#1e2d7d` | Borders, badges, highlights, CTA |
| Azul cielo (smile arc) | `#38bdf8` | Dividers, tags secundarios, glow |
| Blanco | `#f8fafc` | Texto principal en cards |
| Texto suave | `#cbd5e1` | Labels, subtexto, descripciones |
| Fondo navy oscuro | `rgba(10,15,50,0.88)` | Fondo semitransparente de todas las cards |
| Glow navy | `rgba(30,45,125,0.30)` | Box-shadow / glow sutil |
| Glow sky | `rgba(56,189,248,0.20)` | Glow alternativo suave |

## Tipografía

```css
/* Títulos, números, palabras clave */
font-family: 'Montserrat', sans-serif;
font-weight: 700; /* o 800 para impacto máximo */

/* Cuerpo, descripciones, subtexto */
font-family: 'Inter', sans-serif;
font-weight: 400; /* o 500/600 para énfasis */
```

Google Fonts — incluir siempre en `<head>`:
```html
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
```

## Tamaños de fuente (9:16, 720×1280px)

| Elemento | Tamaño mínimo |
|---|---|
| Título principal (Montserrat) | **50px** |
| Subtítulo / highlight | **34–40px** |
| Cuerpo / descripción | **22–24px** |
| Bullets / puntos de lista | **26–28px** |
| Label / badge | **15–16px** |
| Botón CTA | **22px** |

## Estilo de cards

Fondo navy oscuro semitransparente, blur 12px, borde azul navy sutil:

```css
.card {
  background: rgba(10,15,50,0.88);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(30,45,125,0.60);
  border-radius: 16px;
  padding: 28px 26px;
  overflow: hidden;
  text-align: center;
}
```

Variante con acento cielo (para cards de solución / positivas):
```css
border: 1px solid rgba(56,189,248,0.45);
box-shadow: 0 0 32px rgba(56,189,248,0.15), 0 4px 24px rgba(0,0,0,0.6);
```

Variante card de cierre / CTA:
```css
border: 2px solid rgba(30,45,125,0.80);
box-shadow: 0 0 48px rgba(30,45,125,0.35), 0 4px 32px rgba(0,0,0,0.7);
```

## Animaciones — Estilo CORPORATIVO

Entradas suaves, sin rebote ni escala agresiva. Fade + deslizamiento leve.

```css
@keyframes fadeSlideUp {
  from { opacity:0; transform:translate(-50%, calc(-50% + 16px)); }
  to   { opacity:1; transform:translate(-50%, -50%); }
}
@keyframes fadeIn {
  from { opacity:0; transform:translate(-50%, -50%); }
  to   { opacity:1; transform:translate(-50%, -50%); }
}
@keyframes fadeInInner {
  from { opacity:0; transform:translateY(10px); }
  to   { opacity:1; transform:translateY(0); }
}
@keyframes glowPulseNavy {
  0%,100% { box-shadow: 0 0 24px rgba(30,45,125,0.25), 0 4px 24px rgba(0,0,0,0.6); }
  50%     { box-shadow: 0 0 40px rgba(30,45,125,0.45), 0 4px 24px rgba(0,0,0,0.6); }
}

/* Duraciones */
/* fadeSlideUp card:  0.40s ease              — entrada de la card completa */
/* fadeIn card:       0.35s ease              — alternativa para impacto suave */
/* fadeInInner items: 0.30s ease, con delay   — elementos internos */
/* glowPulseNavy:     3.0s ease-in-out infinite */
```

Delay escalonado de elementos internos: badge → título → divider → cuerpo → CTA  
Pasos de 0.25–0.35s entre cada elemento. Sin bounce ni overshoot.

## Posicionamiento de cards — 9:16 (720×1280)

El Dr. Felipe aparece **centrado** en cámara. Cards siempre al centro vertical.

```text
CARD_CENTER (estándar para todas las cards):
  top: 50%; left: 50%; transform: translate(-50%, -50%); width: 88%;

CARD_TOP (solo si el hablante ocupa la mitad inferior):
  top: 16%; left: 50%; transform: translateX(-50%); width: 88%;
```

> ⚠️ Nunca `bottom: X%` — Instagram cubre el área inferior con botones y CTA.  
> ⚠️ Nunca cubrir la cara del hablante.

## Logo Dr. Felipe Acevedo

Archivo: `brand/logo.png` (fondo blanco, versión única disponible)

- Logo con fondo blanco → usar en cards con panel blanco/claro O añadir fondo blanco detrás en cards oscuras
- Ancho en cards: 40–45% de la composición, `object-fit: contain`
- Posición: centrado en la card (texto centrado)
- **En INTRO:** logo centrado arriba de la card (arriba del título)
- **En CIERRE:** logo centrado + nombre del doctor + tagline
- **En Puppeteer:** embeber siempre como base64

```js
const logoB64 = 'data:image/png;base64,' + fs.readFileSync('brand/logo.png').toString('base64');
// En HTML: <img src="${logoB64}" style="width:42%; object-fit:contain;">
```

> Nota: el logo tiene fondo blanco. Para fondos oscuros, agregar un panel blanco redondeado detrás:
> ```css
> .logo-wrap { background:#fff; border-radius:12px; padding:10px 18px; display:inline-block; }
> ```

## Estilo de edición: CORPORATIVO + EMOCIONAL

- Tipografía grande, limpia, centrada
- Animaciones suaves sin distracciones (fade + slide, sin bounce)
- Una idea por card — no saturar con bullets
- Card de apertura: pregunta / hook emocional (conecta con el dolor del paciente)
- Cards intermedias: reencuadre y solución (tono empático, no técnico)
- Card de cierre: urgencia suave + CTA claro con logo
- Máximo 3 bullets por card — si hay más, romper en dos cards
- Nunca dejar tramos sin refuerzo visual > 3s

## Aspect ratio y técnica

- Formato: **9:16** (vertical — Reels, TikTok, Shorts)
- Resolución: 720×1280px
- FPS objetivo: 24fps (coincide con el material del cliente)
- Blur de cards: `blur(12px)`
- ProRes 4444 para renders con alfa

## Proyectos realizados

| Proyecto | Fecha | Tema |
|---|---|---|
| censored_smile | 2026-09-01 | Sonrisa censurada — hook + CTA valoración gratuita |
