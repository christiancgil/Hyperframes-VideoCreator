# Sistema de Triggers — Cuándo y Qué Animar

Este archivo define las reglas exactas que determinan qué beat se genera en cada momento del transcript. Claude debe aplicar estas reglas mecánicamente, sin improvisación.

---

## Regla 0 — Beats obligatorios en todo vídeo

Independientemente del contenido, estos beats SIEMPRE se generan:

| Beat | Cuándo | Tipo |
|---|---|---|
| INTRO | Primeros 8 segundos del vídeo editado | Título introductorio |
| CIERRE | Últimos 6 segundos del vídeo editado | Beat de cierre |

Si el vídeo dura menos de 20 segundos, solo se generan INTRO y CIERRE.

---

## Regla 1 — Triggers por patrón numérico

Cuando el transcript contiene cualquiera de estos patrones, se genera un **stat card**.

### Patrones que disparan stat card:
```
X%               → "el 80% de mis clientes..."
X de cada Y      → "3 de cada 4 personas..."
X€ / X euros     → "cobré 5.000 euros en..."
X$/mes           → "genera 2.000 dólares al mes..."
X millones       → "más de 2 millones de..."
X veces más      → "es 10 veces más rápido..."
aumentó/creció X → "aumentó un 300%..."
en X días/semanas → "en 30 días conseguí..."
X personas/clientes → "más de 500 clientes..."
facturé X        → "facturé 12.000 euros..."
```

### Especificación del stat card:
- El número ocupa el 60% del espacio visual — grande, impactante
- Label descriptivo debajo en texto secundario
- Animación: `popIn` (nunca fadeUp para números)
- Color: acento principal del cliente
- Glow detrás del número con el color acento al 20% opacidad
- Posición: esquina inferior izquierda o derecha (nunca centro si hay hablante centrado)
- Duración: hasta que el hablante pase al siguiente tema (mínimo 3s, máximo 8s)

---

## Regla 2 — Triggers por estructura de lista

Cuando el hablante enumera puntos, se genera una **bullet list card** con aparición escalonada.

### Patrones que disparan bullet list:
```
primero... segundo... tercero...
lo primero / lo segundo / lo tercero
número uno / número dos / número tres
hay X formas de / X maneras de / X pasos para
lo que necesitas es / lo que tienes que hacer es
punto uno / punto dos
```

### Especificación de bullet list:
- Cada bullet aparece en el timestamp exacto en que el hablante lo menciona
- Bullets anteriores permanecen visibles (se acumulan)
- Bullet activo: color acento principal
- Bullets anteriores: color texto suave (#888)
- Máximo 5 bullets por card — si hay más, dividir en dos beats
- Animación de cada bullet: `fadeUp` 0.3s
- La card no desaparece hasta que termina el último bullet + 1.5s

---

## Regla 3 — Triggers por énfasis verbal

Momentos donde el hablante da énfasis especial a una frase.

### Señales de énfasis en el transcript:
```
Silencio >1s ANTES de una frase     → highlight esa frase
Frase repetida dos veces            → quote card con esa frase
"escúchame" / "fíjate" / "ojo"     → highlight card
"esto es importante" / "clave"     → highlight card
"¿sabes qué?" / "¿sabes por qué?"  → question highlight
Frase muy corta (<5 palabras) sola  → puede ser frase de impacto
```

### Especificación de highlight card:
- Texto grande, tipografía Space Grotesk bold
- Sin fondo de card — solo el texto con text-shadow fuerte
- Color: acento principal para palabras clave, texto normal para el resto
- Animación: `slamIn` — aparece con un ligero impacto (scale 1.1 → 1.0)
- Posición: parte inferior central, nunca cubriendo la cara
- Duración: mientras dura la frase + 1s

---

## Regla 4 — Triggers por llamada a la acción

Cuando el hablante invita al espectador a hacer algo.

### Patrones que disparan CTA card:
```
"enlace en la descripción"
"comenta abajo" / "déjame un comentario"
"suscríbete" / "dale like"
"únete" / "apúntate" / "regístrate"
"reserva tu plaza" / "plazas limitadas"
"escríbeme" / "contáctame"
"entra en el link" / "pincha en el enlace"
```

### Especificación de CTA card:
- Card con borde del color acento principal más grueso (2px)
- Texto del CTA en grande + icono visual (flecha, enlace, etc.)
- Fondo semitransparente del color acento al 10%
- Animación: `fadeUp` con ligero pulse en el borde (glow animado)
- Posición: parte inferior central
- Duración: mientras el hablante habla del CTA + 2s extra

---

## Regla 5 — Triggers por urgencia y escasez

### Patrones que disparan urgency card:
```
"solo quedan X" / "últimas X plazas"
"hasta el [fecha]" / "termina el..."
"precio especial" / "oferta" / "descuento"
"no te lo pierdas" / "no pierdas esta oportunidad"
"ahora o nunca" / "es el momento"
"últimas horas" / "cierra hoy"
```

### Especificación de urgency card:
- Color: rojo (#ff4444) o naranja (#fb923c) — nunca azul o verde
- Borde animado con pulse rojo
- Texto con countdown si hay fecha específica
- Animación: `popIn` agresivo (back.out(3))
- Duración: toda la sección de urgencia del hablante

---

## Regla 6 — Triggers por prueba social

### Patrones que disparan testimonial/proof card:
```
"mis clientes" + resultado
"caso de éxito" / "caso real"
"[nombre] consiguió..." / "[nombre] pasó de..."
"testimonio" / "me escribió" / "me dijo"
"en La Tribu" / "en el programa" (si aplica al cliente)
```

### Especificación de proof card:
- Formato: nombre/avatar a la izquierda + resultado a la derecha
- Si no hay nombre real, usar "Cliente" + resultado
- Color: verde (#4ade80) para el resultado (positivo)
- Animación: `fadeUp` suave
- Duración: mientras dure el ejemplo

---

## Regla 6.5 — Triggers por iconografía y objetos animados

Además de las cards de texto/dato de las reglas anteriores, el catálogo (`styles/effects-catalog.md`) incluye objetos animados (check-grande, badge, estrellas-rating, notification-pop, partículas-flotantes, stamp-urgente, etc.). Fase 3 debe considerarlos igual que cualquier otro trigger, no solo cuando el cliente los pide manualmente en Modo Iteración.

### Patrones que disparan un objeto animado:
```
"gratis" / "gratuita" / "sin coste" / "de regalo"        → badge ("GRATIS")
"nuevo" / "por primera vez" / "recién lanzado"            → badge ("NUEVO")
"confirmado" / "así de fácil" / "ya está" (cierre de idea resolutivo) → check-grande
Menciona estrellas / valoración / reseñas de clientes      → estrellas-rating
"te llega una notificación" / "te avisamos" / "recibes un mensaje" → notification-pop
Tono ambiental sostenido sin trigger textual específico (storytelling, motivacional) → partículas-flotantes de fondo (opcional, nunca obligatorio)
```

### Reglas de uso:
- **Nunca sustituyen** al beat de texto/dato que le corresponda por otro trigger de este documento — se **añaden** como capa decorativa corta (1–1.5s), no como reemplazo
- Se colocan en la zona que esté libre en ese momento (ej. si ya hay una card abajo, el objeto va arriba) — nunca se solapan con texto activo
- **Densidad máxima: 1 objeto animado cada 2–3 beats de texto** — no saturar, son acento, no protagonista
- Usan la paleta del cliente (o la neutra de `effects-catalog.md` si no hay `client-style.md`)
- Aplica igualmente el espaciado y las prioridades de la Regla 8

---

## Regla 7 — Anti-triggers (cuándo NO animar)

No generar ningún beat en estos momentos:

```
Silencios < 2 segundos entre frases (transiciones naturales)
Filler words que quedaron (si el recorte no los eliminó todos)
Frases de transición: "bueno", "entonces", "como decía"
Saludos iniciales ya cortados por el recorte
Despedidas estándar (ya cubierto por el beat de CIERRE)
Secciones donde ya hay otro beat activo (no solapar)
```

---

## Regla 8 — Espaciado mínimo entre beats

- Mínimo **2 segundos** entre el final de un beat y el inicio del siguiente antes de considerar un segundo trigger independiente
- Si dos triggers ocurren con menos de 2s de diferencia, elegir el más importante y descartar el otro
- Prioridad: NÚMERO > ÉNFASIS > LISTA > CTA > URGENCIA > PRUEBA SOCIAL
- Este espaciado **no es "vídeo limpio" sin refuerzo visual** — el hueco resultante entre beats se cubre siempre por el mecanismo de Fase 3.5 (prolongación de la card vecina o beat de relleno contextual), nunca queda sin animación

---

## Resumen de decisión (árbol rápido)

```
¿Es el inicio del vídeo? → INTRO (obligatorio)
¿Es el final del vídeo?  → CIERRE (obligatorio)
¿Hay un número/dato?     → STAT CARD
¿Hay una lista?          → BULLET LIST (escalonada)
¿Hay énfasis/pausa?      → HIGHLIGHT
¿Hay un CTA?             → CTA CARD
¿Hay urgencia/escasez?   → URGENCY CARD
¿Hay prueba social?      → PROOF CARD
¿Encaja con un objeto animado (Regla 6.5)? → AÑADIR objeto decorativo (nunca sustituye a lo anterior)
¿Ninguno de los anteriores? → No animar ese segmento
```
