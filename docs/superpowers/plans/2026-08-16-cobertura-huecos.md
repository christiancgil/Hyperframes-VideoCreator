# Cobertura total de huecos sin karaoke plano — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reescribir las reglas de cobertura de huecos entre cards (Fase 3.5) para que ningún tramo del vídeo se quede en karaoke plano, y validar el cambio regenerando una v2 real del proyecto de ejemplo `unlock-natural-smile`.

**Architecture:** Cinco archivos de configuración (`CLAUDE.md` + 4 en `styles/`) definen las reglas nuevas para futuras ediciones. Después, se aplican esas reglas al proyecto ya renderizado `unlock-natural-smile`: se recalculan los 6 huecos existentes, 5 se resuelven prolongando la card vecina (sin generar ningún HTML nuevo, solo cambiando cuánto dura en pantalla) y 1 se resuelve con un beat de relleno nuevo (mismo estilo visual que las cards existentes — texto grande sin fondo — en vez de karaoke). Se re-renderizan solo los beats afectados con Puppeteer + ffmpeg (ProRes 4444) y se recompone el vídeo final.

**Tech Stack:** Markdown (config), Python (`generate_beats.py`), Node.js + Puppeteer (`capture.js`), ffmpeg/ffprobe (Windows build en `C:\Users\cgil\AppData\Local\Microsoft\WinGet\...\ffmpeg.exe`).

**Nota sobre "tests" en este plan:** este no es software con suite de tests automatizada — es un pipeline de vídeo. El equivalente a "test falla / test pasa" que ya usa el propio proyecto (Fase 5/6 de `CLAUDE.md`) es: verificar `pix_fmt` con `ffprobe` tras cada render, verificar duración/silencio tras cada composición, y extraer frames PNG para inspección visual. Cada tarea de render usa ese mismo patrón en vez de `pytest`.

## Global Constraints

- Nunca usar `ffmpeg`/`ffprobe` sin el path completo — usar el binario detectado: `C:\Users\cgil\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.1-full_build\bin\ffmpeg.exe` (y `ffprobe.exe` equivalente).
- ProRes 4444 (`prores_ks -profile:v 4 -pix_fmt yuva444p12le`) para cualquier overlay con alfa — nunca VP9/WebM.
- `body { background: transparent }` siempre en los HTML de beats — nunca fondo sólido.
- No tocar `output/unlock-natural-smile_edited.mp4` (vídeo base) — el cambio es solo en overlays/composición.
- No re-transcribir ni re-cortar — el transcript (`output/unlock-natural-smile_transcript_clean.json`) y el corte ya están validados (ver `projects/unlock-natural-smile/notes.md`).

---

### Task 1: Actualizar `styles/motion-philosophy.md`

**Files:**
- Modify: `styles/motion-philosophy.md:14-16` (sección "Entrada y salida")

**Interfaces:**
- Produce el texto de referencia que Task 5 (Fase 3.5 en `CLAUDE.md`) y el resto de tareas citan como fuente de la regla de duración de cards.

- [ ] **Step 1: Reemplazar el límite fijo de 8 segundos**

Sustituir:
```markdown
### Entrada y salida
- La card **entra 0.2s después** de que el hablante empiece a decir la frase clave (nunca antes)
- La card **sale 0.5s después** de que el hablante termine esa idea
- Nunca mantener una card más de 8 segundos — si la idea es larga, usa múltiples beats
```
por:
```markdown
### Entrada y salida
- La card **entra 0.2s después** de que el hablante empiece a decir la frase clave (nunca antes)
- La card **sale 0.5s después** de que el hablante termine esa idea, o se prolonga hasta el siguiente beat real si así lo pide la Fase 3.5 (cobertura de huecos)
- Sin tope fijo de duración — una card dura hasta el siguiente trigger real. Si su propio contenido (sin contar la prolongación por hueco) necesitaría más de ~12s en pantalla, la idea es demasiado larga: usa múltiples beats en su lugar
- La prolongación por cobertura de huecos (Fase 3.5) nunca añade más de 3s sobre la duración natural de la card — huecos más largos se cubren con un beat de relleno nuevo, no prolongando
```

- [ ] **Step 2: Añadir aclaración sobre karaoke como capa secundaria**

En la sección "### Densidad" (línea ~49-52), sustituir:
```markdown
### Densidad
- **Máximo 2 elementos** activos al mismo tiempo en pantalla
- Si hay karaoke + card: la card va arriba, karaoke abajo
- Si hay 2 cards: nunca una encima de la otra, siempre lado a lado o con gap
```
por:
```markdown
### Densidad
- **Máximo 2 elementos** activos al mismo tiempo en pantalla
- Karaoke **nunca aparece solo** — siempre es una capa secundaria bajo un beat visual activo (card grande o beat de relleno ligero, ver Fase 3.5 en `CLAUDE.md`). Si hay karaoke + card: la card va arriba, karaoke abajo
- Si hay 2 cards: nunca una encima de la otra, siempre lado a lado o con gap
```

- [ ] **Step 3: Verificar el resultado**

Leer el archivo completo y confirmar que las dos secciones editadas son internamente consistentes con el resto del documento (no debe quedar ninguna otra mención a "8 segundos" como tope).

Run: buscar la cadena `8 segundos` en el archivo — no debe quedar ninguna ocurrencia salvo en el nuevo texto explicativo del Step 1 si aplica.

---

### Task 2: Actualizar `styles/triggers.md` — Regla 8

**Files:**
- Modify: `styles/triggers.md:202-207`

**Interfaces:**
- Consume: la terminología "prolongación" y "beat de relleno" definida en Task 1.

- [ ] **Step 1: Reescribir Regla 8**

Sustituir:
```markdown
## Regla 8 — Espaciado mínimo entre beats

- Mínimo **2 segundos** de vídeo limpio entre el final de un beat y el inicio del siguiente
- Si dos triggers ocurren con menos de 2s de diferencia, elegir el más importante y descartar el otro
- Prioridad: NÚMERO > ÉNFASIS > LISTA > CTA > URGENCIA > PRUEBA SOCIAL
```
por:
```markdown
## Regla 8 — Espaciado mínimo entre beats

- Mínimo **2 segundos** entre el final de un beat y el inicio del siguiente antes de considerar un segundo trigger independiente
- Si dos triggers ocurren con menos de 2s de diferencia, elegir el más importante y descartar el otro
- Prioridad: NÚMERO > ÉNFASIS > LISTA > CTA > URGENCIA > PRUEBA SOCIAL
- Este espaciado **no es "vídeo limpio" sin refuerzo visual** — el hueco resultante entre beats se cubre siempre por el mecanismo de Fase 3.5 (prolongación de la card vecina o beat de relleno contextual), nunca queda sin animación
```

- [ ] **Step 2: Verificar el resultado**

Leer el archivo y confirmar que no queda ninguna frase que implique que el espaciado mínimo es tiempo "sin animación".

---

### Task 3: Actualizar `styles/video-profiles.md` — notas de densidad

**Files:**
- Modify: `styles/video-profiles.md` (líneas de "Densidad de beats" en los perfiles 1, 3, 4, 5 y la tabla resumen)

**Interfaces:**
- Consume: terminología de Task 1/2.

- [ ] **Step 1: Matizar Perfil 1 — TUTORIAL (línea ~43)**

Sustituir:
```markdown
**Densidad de beats:** Media — no todos los pasos necesitan card. Solo los que el hablante enfatiza.
```
por:
```markdown
**Densidad de beats:** Media — no todos los pasos necesitan card *grande*. Solo los que el hablante enfatiza. Los tramos entre pasos igualmente se cubren vía Fase 3.5 (prolongación o relleno contextual), nunca quedan sin refuerzo visual.
```

- [ ] **Step 2: Matizar Perfil 3 — EDUCATIVO (línea ~95)**

Sustituir:
```markdown
**Densidad de beats:** Baja-Media — los espacios sin animación son intencionales.
```
por:
```markdown
**Densidad de beats:** Baja-Media — pocas cards *grandes/salientes* es la elección intencional, no la ausencia total de refuerzo visual. Los espacios entre ellas se cubren igual que en cualquier perfil (Fase 3.5).
```

- [ ] **Step 3: Matizar Perfil 4 — STORYTELLING (línea ~120)**

Sustituir:
```markdown
**Densidad de beats:** Baja — el protagonista es la narrativa, no las animaciones.
```
por:
```markdown
**Densidad de beats:** Baja — el protagonista es la narrativa, no las animaciones grandes. Los huecos entre beats destacados se resuelven igualmente vía Fase 3.5, nunca quedan planos.
```

- [ ] **Step 4: Matizar Perfil 5 — PODCAST (línea ~143)**

Sustituir:
```markdown
**Densidad de beats:** Baja — uno cada 20-30 segundos máximo.
```
por:
```markdown
**Densidad de beats:** Baja — un beat *destacado* (card/highlight) cada 20-30 segundos máximo. El tiempo entre ellos se cubre por Fase 3.5 (prolongación de la card/highlight anterior, o relleno contextual si el hueco supera los 3s) — nunca queda como tramo sin refuerzo visual.
```

- [ ] **Step 5: Verificar el resultado**

Leer el archivo completo y confirmar que ninguna sección sugiere que "baja densidad" significa tramos sin ningún refuerzo visual.

---

### Task 4: Actualizar `styles/effects-catalog.md` — entrada `karaoke`

**Files:**
- Modify: `styles/effects-catalog.md:41-44`

- [ ] **Step 1: Reescribir la entrada**

Sustituir:
```markdown
### `karaoke`
Subtítulos sincronizados — la palabra activa se ilumina con el color acento.
- **Cuándo:** todo vídeo con habla — útil para retención en mute
- **Cómo lo pide:** "añade subtítulos karaoke" o "pon karaoke"
```
por:
```markdown
### `karaoke`
Subtítulos sincronizados — la palabra activa se ilumina con el color acento. **Requiere un beat visual activo simultáneo** (card grande o beat de relleno ligero) — nunca se genera como único elemento en pantalla, ver Fase 3.5 en `CLAUDE.md` y la sección "Densidad" de `motion-philosophy.md`.
- **Cuándo:** como capa de apoyo bajo una card o beat de relleno, en todo vídeo con habla — útil para retención en mute
- **Cómo lo pide:** "añade subtítulos karaoke" o "pon karaoke" (se añadirá como capa bajo el beat visual activo en ese momento, no de forma aislada)
```

- [ ] **Step 2: Verificar el resultado**

Confirmar que no queda ninguna otra mención de `karaoke` en el archivo que sugiera uso independiente.

---

### Task 5: Reescribir Fase 3.5 en `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md` (sección `### FASE 3.5 — Cobertura de subtítulos en huecos (karaoke)`)

**Interfaces:**
- Consume: reglas de Task 1-4.
- Produce: el algoritmo que Task 6 (aplicación real al proyecto) sigue paso a paso.

- [ ] **Step 1: Sustituir la sección completa**

Reemplazar el título y las 6 líneas actuales de la sección `FASE 3.5` por:

```markdown
### FASE 3.5 — Cobertura total de huecos (sin karaoke plano)

Ningún tramo del vídeo debe quedarse sin refuerzo visual animado. Karaoke deja de generarse como beat independiente — solo existe como capa secundaria opcional bajo un beat visual activo (ver `styles/motion-philosophy.md` y `styles/effects-catalog.md`).

1. Ordena los beats definidos en Fase 3 por timestamp y calcula los huecos: tramos donde ningún beat está activo — antes del primer beat, entre beats consecutivos, y después del último beat hasta el final del vídeo (o hasta el beat de cierre)
2. **Ignora huecos menores de 1.5s** — demasiado breves para percibirse, no se tocan
3. **Huecos entre 1.5s y 3s → prolonga la card vecina.** Por defecto, extiende la salida de la card anterior hasta el inicio del siguiente beat real (nunca se solapan dos elementos completos — corte seco o cross-fade <0.2s en la transición). No hay tope fijo de duración para esta extensión (ver `styles/motion-philosophy.md`)
4. **Huecos mayores de 3s → genera un beat de relleno nuevo.** No prolongues la card vecina más allá de 3s — se sentiría estática. Elige el efecto del catálogo (`styles/effects-catalog.md`) que mejor encaje con lo que dice el hablante en ese fragmento (p.ej. `titulo-impacto`, `palabra-a-palabra`, un objeto animado de la Regla 6.5 de `styles/triggers.md`), aplicando `styles/motion-philosophy.md`. No hay un tipo fijo por defecto — decide según el contexto
5. **Si el hueco de relleno supera los 8s**, no lo cubras con un único beat estático todo el tramo — encadena 2-3 beats de relleno más cortos alineados a los límites de frase del transcript, igual que la regla ya existente de "si la idea es larga, usa múltiples beats"
6. Añade los beats de relleno (si los hay) a la misma lista de beats de Fase 3 — Fase 4 los genera exactamente igual que cualquier otro beat. Las prolongaciones de cards existentes no generan un beat nuevo, solo actualizan la duración en pantalla de la card ya generada
```

- [ ] **Step 2: Verificar el resultado**

Buscar en `CLAUDE.md` cualquier otra referencia a "FASE 3.5" o a beats `karaoke` como mecanismo de relleno (por ejemplo en la tabla de "MODO ITERACIÓN") y confirmar que sigue siendo coherente con la nueva redacción (la fila "Añade subtítulos karaoke" de la tabla de iteración puede quedarse igual — ese caso es un karaoke pedido explícitamente por el cliente sobre un beat ya existente, no el mecanismo automático de relleno).

- [ ] **Step 3: Commit**

Este proyecto no es un repositorio git (`Is a git repository: false`) — omitir este paso. Si en el futuro se inicializa git, commitear los 5 archivos de config juntos con mensaje describiendo el cambio de Fase 3.5.

---

### Task 6: Recalcular el plan de beats de `unlock-natural-smile` con las nuevas reglas

**Files:**
- Read: `output/unlock-natural-smile_transcript_clean.json`
- Read: `output/edit/generate_beats.py` (estado actual, como referencia — no modificar todavía)

**Interfaces:**
- Produce: la tabla de huecos y decisiones (prolongar / relleno) que Task 7 implementa.

**Contexto ya derivado** (a partir de `output/edit/generate_beats.py`, cuyos `KARAOKE_GAPS` son exactamente los huecos entre las 7 cards):

| Hueco actual (karaoke-N) | Rango | Duración | Nueva decisión |
|---|---|---|---|
| karaoke-1 | 3.6→5.8 | 2.2s | Prolongar `hook` (dur 3.0→5.8) |
| karaoke-2 | 11.5→13.5 | 2.0s | Prolongar `dolor` (dur 5.7→7.7) |
| karaoke-3 | 16.3→18.3 | 2.0s | Prolongar `consecuencia` (dur 2.8→4.8) |
| karaoke-4 | 20.9→22.9 | 2.0s | Prolongar `reencuadre` (dur 2.6→4.6) |
| karaoke-5 | 24.4→26.4 | 2.0s | Prolongar `solucion` (dur 1.5→3.5) |
| karaoke-6 | 29.4→32.6 | 3.2s | **Relleno nuevo** (>3s, no se prolonga `urgencia`) |

- [ ] **Step 1: Confirmar el texto del hueco 6 (relleno nuevo)**

Ya extraído del transcript (29.36s-32.76s): *"Es hora de abrir tu risa con la llave correcta."* — es un callback directo a la metáfora de la llave del `hook` ("¿SABÍAS QUE HAY SONRISAS QUE VIVEN BLOQUEADAS?"). Confirma releyendo `output/unlock-natural-smile_transcript_clean.json` entre 29.0s y 33.0s que no hay más palabras fuera de esta frase.

Run:
```bash
node -e "
const d = require('./output/unlock-natural-smile_transcript_clean.json');
console.log(d.words.filter(w=>w.type==='word' && w.start>=29.0 && w.end<=33.0).map(w=>w.text).join(' '));
"
```
Expected: `Es hora de abrir tu risa con la llave correcta.`

- [ ] **Step 2: Decidir estilo del beat de relleno**

Usa el mismo tratamiento visual que `hook`/`dolor`/`consecuencia`/`reencuadre` (texto grande sin card, `card_beat(..., card=False)` en `generate_beats.py`) — es el efecto `titulo-impacto` del catálogo. Zona `top` (alterna con `urgencia` que fue `bottom`, igual que el resto de la secuencia alterna top/bottom). Acento rojo (`#ff4444`) en "llave correcta" para mantener la energía de `urgencia`/`cta-cierre` que lo rodean (regla de `video-profiles.md` Perfil VENTAS: "nunca colores fríos").

No se genera ningún beat de relleno para los huecos 1-5 — se resuelven solo cambiando la duración de la card existente.

---

### Task 7: Modificar `output/edit/generate_beats.py`

**Files:**
- Modify: `output/edit/generate_beats.py`

**Interfaces:**
- Consume: `card_beat(cid, title, duration, zone, titular, sub, color, accent, card)` ya definida en el archivo (sin cambios de firma).
- Produce: los mismos HTML que antes para 6 de los 7 beats de card (solo cambia el argumento `duration`), un HTML nuevo para el relleno del hueco 6, y dos beats (`badge-gratis`, `cta-cierre`) sin cambios.

- [ ] **Step 1: Actualizar las duraciones en `BEATS` (líneas 174-193)**

Cambiar únicamente el tercer valor (duración) de las tuplas `hook`, `dolor`, `consecuencia`, `reencuadre`, `solucion` según la tabla de Task 6 — dejar `urgencia` y `cta-cierre` sin cambios:

```python
BEATS = [
    ("hook", "index.html", 5.8, card_beat("hook", None, 5.8, "top",
        "¿SABÍAS QUE HAY <span class=\"impacto\">SONRISAS</span><br>QUE VIVEN BLOQUEADAS?", None,
        color="#ffffff", accent="#ff4444")),
    ("dolor", "compositions/beat_02.html", 7.7, card_beat("dolor", None, 7.7, "bottom",
        "MANTIENEN SU RISA<br><span class=\"impacto\">ENCERRADA</span>",
        "La mano en la boca. La foto que nunca se toman.",
        color="#ffffff", accent="#ff4444")),
    ("consecuencia", "compositions/beat_03.html", 4.8, card_beat("consecuencia", None, 4.8, "top",
        "AÑOS ESCONDIENDO ALGO<br>QUE DEBERÍA SER LIBRE", None, color="#ffffff")),
    ("reencuadre", "compositions/beat_04.html", 4.6, card_beat("reencuadre", None, 4.6, "bottom",
        "NADIE LES HA AYUDADO<br>A MOSTRARLA",
        "No porque su sonrisa esté dañada.", color="#60a5fa")),
    ("solucion", "compositions/beat_05.html", 3.5, card_beat("solucion", None, 3.5, "top",
        "Una sonrisa natural<br>que no pide permiso", None, color="#60a5fa", card=True)),
    ("urgencia", "compositions/beat_06.html", 3.0, card_beat("urgencia", None, 3.0, "bottom",
        "5 espacios esta semana", "Valoración gratuita de tu sonrisa",
        color="#ff4444", card=True)),
    ("cta-cierre", "compositions/beat_07.html", 3.5, None),  # especial, con logo
]
```

- [ ] **Step 2: Sustituir `KARAOKE_GAPS` por un único beat de relleno**

Reemplazar el bloque `KARAOKE_GAPS = [...]` (líneas 195-202) por:

```python
FILLER_BEATS = [
    ("impacto-cierre-parcial", "compositions/beat_09.html", 3.2, card_beat(
        "impacto-cierre-parcial", None, 3.2, "top",
        "Es hora de abrir tu risa<br>con la <span class=\"impacto\">llave correcta</span>", None,
        color="#ffffff", accent="#ff4444")),
]
```

- [ ] **Step 3: Actualizar `main()` para escribir `FILLER_BEATS` en vez de iterar `KARAOKE_GAPS`**

Reemplazar (líneas 272-279):
```python
    for i, (cid, gstart, gend) in enumerate(KARAOKE_GAPS, start=9):
        lw = local_words(words, gstart, gend)
        dur = round(gend - gstart, 2)
        html = karaoke_beat(cid, dur, lw)
        path = f"{OUT_HF}/compositions/beat_{i:02d}.html"
        with open(path, "w", encoding="utf-8") as f:
            f.write(html)
        print("wrote", path, "words:", [w["text"] for w in lw])
```
por:
```python
    for cid, relpath, dur, html in FILLER_BEATS:
        path = f"{OUT_HF}/{relpath}"
        with open(path, "w", encoding="utf-8") as f:
            f.write(html)
        print("wrote", path)
```

No borres las funciones `karaoke_beat()` ni `local_words()` — se quedan disponibles en el catálogo del script por si un cliente pide karaoke explícito sobre un beat existente (Modo Iteración), solo dejan de usarse para el relleno automático de huecos.

- [ ] **Step 4: Ejecutar el script**

Run: `cd "d:/Repositorios/divisual-video-editor-kit 2" && python output/edit/generate_beats.py`
Expected: imprime `wrote skills/hyperframes/packages/studio/data/projects/unlock-natural-smile/index.html` y 7 rutas más (incluyendo `beat_09.html` como único relleno), sin errores. Ya no debe mencionar `beat_10.html` a `beat_14.html`.

- [ ] **Step 5: Copiar los HTML regenerados a `output/compositions/unlock-natural-smile`**

`generate_beats.py` solo escribe en la carpeta de HyperFrames (`OUT_HF`); `capture.js` renderiza desde `output/compositions/unlock-natural-smile` (`OUT_OUTPUT`). Copia los archivos cambiados:

Run:
```bash
cd "d:/Repositorios/divisual-video-editor-kit 2"
cp "skills/hyperframes/packages/studio/data/projects/unlock-natural-smile/index.html" "output/compositions/unlock-natural-smile/index.html"
for f in beat_02 beat_03 beat_04 beat_05 beat_09; do
  cp "skills/hyperframes/packages/studio/data/projects/unlock-natural-smile/compositions/$f.html" "output/compositions/unlock-natural-smile/compositions/$f.html"
done
rm -f output/compositions/unlock-natural-smile/compositions/beat_10.html \
      output/compositions/unlock-natural-smile/compositions/beat_11.html \
      output/compositions/unlock-natural-smile/compositions/beat_12.html \
      output/compositions/unlock-natural-smile/compositions/beat_13.html \
      output/compositions/unlock-natural-smile/compositions/beat_14.html
```
Expected: `output/compositions/unlock-natural-smile/compositions/` contiene ahora `beat_02` a `beat_09` (8 archivos) — `beat_06.html` (urgencia), `beat_07.html` (cta-cierre) y `beat_08.html` (badge) no se tocan.

---

### Task 8: Actualizar `output/compositions/unlock-natural-smile/capture.js`

**Files:**
- Modify: `output/compositions/unlock-natural-smile/capture.js:21-36`

**Interfaces:**
- Consume: los mismos `compositionId` que las claves `window.__timelines[...]` de cada HTML generado en Task 7.

- [ ] **Step 1: Reemplazar el array `BEATS`**

Sustituir el array completo (líneas 21-36) por:

```javascript
const BEATS = [
  { file: 'index.html', compositionId: 'hook', duration: 5.8 },
  { file: 'compositions/beat_02.html', compositionId: 'dolor', duration: 7.7 },
  { file: 'compositions/beat_03.html', compositionId: 'consecuencia', duration: 4.8 },
  { file: 'compositions/beat_04.html', compositionId: 'reencuadre', duration: 4.6 },
  { file: 'compositions/beat_05.html', compositionId: 'solucion', duration: 3.5 },
  { file: 'compositions/beat_06.html', compositionId: 'urgencia', duration: 3.0 },
  { file: 'compositions/beat_07.html', compositionId: 'cta-cierre', duration: 3.5 },
  { file: 'compositions/beat_08.html', compositionId: 'badge-gratis', duration: 1.4 },
  { file: 'compositions/beat_09.html', compositionId: 'impacto-cierre-parcial', duration: 3.2 },
];
```

- [ ] **Step 2: Verificar el resultado**

Leer el archivo modificado y confirmar que la duración total de renders (`BEATS.reduce`) coincide con: 5.8+7.7+4.8+4.6+3.5+3.0+3.5+1.4+3.2 = 37.5s de frames a renderizar (bastante menos que antes al no repetir 6 renders karaoke independientes, aunque el resultado en pantalla cubra el mismo tiempo total de vídeo).

---

### Task 9: Renderizar los beats afectados

**Files:**
- Run: `output/compositions/unlock-natural-smile/capture.js`

- [ ] **Step 1: Localizar el binario de ffmpeg/ffprobe de Windows**

Run: `where ffmpeg` o usar el path ya confirmado: `C:\Users\cgil\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.1-full_build\bin\ffmpeg.exe`

- [ ] **Step 2: Ejecutar capture.js con las variables de entorno correctas**

Run (PowerShell):
```powershell
$env:VIDEO_W=720; $env:VIDEO_H=1280; $env:VIDEO_FPS=24
$env:FFMPEG_BIN="C:\Users\cgil\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.1-full_build\bin\ffmpeg.exe"
$env:FFPROBE_BIN="C:\Users\cgil\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.1-full_build\bin\ffprobe.exe"
node "output/compositions/unlock-natural-smile/capture.js"
```
Expected: `Done: 9/9 beats renderizados en .../renders`, y cada línea `-> NOMBRE.mov [yuva444p12le]` (nunca otro pix_fmt — si aparece otro, el script ya lanza `Error: Alfa incorrecto`).

- [ ] **Step 3: Verificar que los 5 `.mov` de karaoke antiguos ya no se usan**

Los archivos `karaoke-1.mov` a `karaoke-6.mov` en `renders/` (de una ejecución anterior, si existen) quedan huérfanos — no se borran automáticamente pero tampoco se referencian en la Task 10. Confirmar con `ls output/compositions/unlock-natural-smile/renders` que existen los 9 `.mov` nuevos: `hook.mov`, `dolor.mov`, `consecuencia.mov`, `reencuadre.mov`, `solucion.mov`, `urgencia.mov`, `cta-cierre.mov`, `badge-gratis.mov`, `impacto-cierre-parcial.mov`.

---

### Task 10: Recomponer el vídeo final (v2)

**Files:**
- Create: `scripts/composite_unlock_natural_smile_v2.mjs`
- Read: `output/unlock-natural-smile_edited.mp4`
- Read: `output/compositions/unlock-natural-smile/renders/*.mov`

- [ ] **Step 1: Escribir el script de composición**

```javascript
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const FFMPEG = 'C:\\Users\\cgil\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffmpeg.exe';

const RENDERS = path.join(ROOT, 'output', 'compositions', 'unlock-natural-smile', 'renders');
const baseVideo = path.join(ROOT, 'output', 'unlock-natural-smile_edited.mp4');
const outputFinal = path.join(ROOT, 'output', 'unlock-natural-smile_final_v2.mp4');

// [startTime, duration, file] — startTime = timestamp absoluto en el video editado
const BEATS = [
  [0.0,  5.8, 'hook.mov'],
  [5.8,  7.7, 'dolor.mov'],
  [13.5, 4.8, 'consecuencia.mov'],
  [18.3, 4.6, 'reencuadre.mov'],
  [22.9, 3.5, 'solucion.mov'],
  [26.4, 3.0, 'urgencia.mov'],
  [27.8, 1.4, 'badge-gratis.mov'],
  [29.4, 3.2, 'impacto-cierre-parcial.mov'],
  [32.6, 3.5, 'cta-cierre.mov'],
];

let filterParts = [`[0:v]null[base]`];
let inputArgs = ['-i', baseVideo];

BEATS.forEach(([startTime, duration, file], i) => {
  inputArgs.push('-i', path.join(RENDERS, file));
  const prev = i === 0 ? 'base' : `v${i}`;
  const next = i === BEATS.length - 1 ? 'vout' : `v${i + 1}`;
  filterParts.push(
    `[${i + 1}:v]setpts=PTS+${startTime}/TB[ov${i}];` +
    `[${prev}][ov${i}]overlay=0:0:enable='between(t,${startTime},${startTime + duration})'[${next}]`
  );
});

const filter = filterParts.join('; ');

console.log('Compositando unlock-natural-smile v2 (sin karaoke plano)...');
execFileSync(FFMPEG, [
  ...inputArgs,
  '-filter_complex', filter,
  '-map', '[vout]', '-map', '0:a',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
  '-c:a', 'aac', '-b:a', '192k',
  outputFinal, '-y',
], { stdio: 'inherit' });
console.log(`\n✓ Vídeo final v2: ${outputFinal}`);
```

- [ ] **Step 2: Ejecutar la composición**

Run: `node "scripts/composite_unlock_natural_smile_v2.mjs"`
Expected: termina sin error y crea `output/unlock-natural-smile_final_v2.mp4`.

- [ ] **Step 3: Verificar duración**

Run:
```bash
FFPROBE="C:/Users/cgil/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.1-full_build/bin/ffprobe.exe"
"$FFPROBE" -v quiet -show_entries format=duration -of csv=p=0 output/unlock-natural-smile_final_v2.mp4
"$FFPROBE" -v quiet -show_entries format=duration -of csv=p=0 output/unlock-natural-smile_final.mp4
```
Expected: ambas duraciones prácticamente iguales (diferencia <0.1s) — la v2 no debe ser más corta ni más larga que la v1, solo cambia qué overlay cubre cada tramo.

- [ ] **Step 4: Verificar audio**

Run:
```bash
FFMPEG="C:/Users/cgil/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.1-full_build/bin/ffmpeg.exe"
"$FFMPEG" -i output/unlock-natural-smile_final_v2.mp4 -af silencedetect=n=-50dB:d=2 -f null - 2>&1 | tail -5
```
Expected: mismo patrón de silencios que la v1 (el audio no se toca, solo los overlays visuales).

- [ ] **Step 5: Extraer frames de verificación en los tramos que antes eran karaoke plano**

Run:
```bash
FFMPEG="C:/Users/cgil/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.1-full_build/bin/ffmpeg.exe"
"$FFMPEG" -i output/unlock-natural-smile_final_v2.mp4 -ss 12.5 -frames:v 1 output/verify_v2_gap2.png -y
"$FFMPEG" -i output/unlock-natural-smile_final_v2.mp4 -ss 30.5 -frames:v 1 output/verify_v2_gap6.png -y
```
Expected: `verify_v2_gap2.png` (t=12.5s, antes karaoke-2 plano) ahora muestra la card `dolor` prolongada en pantalla en vez de texto suelto; `verify_v2_gap6.png` (t=30.5s, antes karaoke-6 plano) muestra el nuevo beat `impacto-cierre-parcial` con el mismo tratamiento visual que `hook`/`dolor`, no karaoke.

Muestra estos 2 frames (+ los 3 de verificación estándar de Fase 6 de `CLAUDE.md`) al usuario para confirmación visual.

---

### Task 11: Documentar la v2 en `projects/unlock-natural-smile/notes.md`

**Files:**
- Modify: `projects/unlock-natural-smile/notes.md`

- [ ] **Step 1: Añadir sección de iteración**

Añadir al final del archivo:

```markdown

## Iteración — v2, sin karaoke plano (2026-08-16)
- Aplicado el nuevo mecanismo de Fase 3.5 (`docs/superpowers/specs/2026-08-16-cobertura-huecos-design.md`).
- 5 de los 6 huecos que antes usaban karaoke independiente (karaoke-1 a karaoke-5) ahora se cubren
  prolongando la card vecina: hook 3.0s→5.8s, dolor 5.7s→7.7s, consecuencia 2.8s→4.8s,
  reencuadre 2.6s→4.6s, solucion 1.5s→3.5s.
- El hueco restante (29.4s-32.6s, 3.2s, antes karaoke-6) se sustituyó por un beat de relleno
  contextual (`impacto-cierre-parcial`, mismo tratamiento visual que hook/dolor) con el texto
  "Es hora de abrir tu risa con la llave correcta" — callback a la metáfora del hook.
- Resultado: `output/unlock-natural-smile_final_v2.mp4` — mismo audio y duración que la v1,
  0 tramos con subtítulo plano.
```

---

## Self-Review Notes

- **Cobertura de la spec:** Task 1-4 cubren los 4 archivos de `styles/`. Task 5 cubre `CLAUDE.md`. Task 6-11 cubren la validación real pedida por el cliente ("creando una nueva versión de este proyecto").
- **Sin placeholders:** todos los reemplazos de texto están completos, ningún "TODO"/"TBD".
- **Consistencia de nombres:** `compositionId` en `capture.js` (Task 8) coincide exactamente con los `cid` usados en `generate_beats.py` (Task 7) y con las claves `window.__timelines[...]` que генera `card_beat()` — no hay renombres a medias.
- **Fuera de alcance confirmado:** no se toca la Fase 0-2 (transcripción/corte) ni el vídeo base editado.
