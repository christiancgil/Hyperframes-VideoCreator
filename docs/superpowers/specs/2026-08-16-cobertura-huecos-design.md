# Cobertura total de huecos sin karaoke plano — Diseño

**Fecha:** 2026-08-16
**Estado:** Aprobado

## Problema

El pipeline actual (Fase 3.5 de `CLAUDE.md`) tapa cualquier hueco ≥1.5s entre
cards con subtítulos karaoke simples. El resultado renderizado se ve como un
salto brusco: primero destaca una card animada, luego cae a texto plano. El
cliente quiere que las cards/animaciones dominen visualmente y que no existan
tramos "planos" — el karaoke deja de ser mecanismo de relleno independiente.

## Objetivo

Ningún tramo del vídeo debe quedar sin refuerzo visual animado. Karaoke deja
de ser un beat que se genera solo — pasa a ser una capa secundaria opcional
que acompaña a un beat visual activo (card o relleno ligero), nunca aparece
en solitario.

## Mecanismo de cobertura de huecos (sustituye la Fase 3.5 actual)

Se calculan los huecos igual que antes: tramos donde ningún beat está activo
(antes del primer beat, entre beats consecutivos, después del último beat
hasta el cierre).

1. **Hueco < 1.5s** → no se toca. Demasiado breve para percibirse; forzar
   algo aquí solo parpadearía y distraería.

2. **Hueco entre 1.5s y 3s** → se prolonga la card vecina (por defecto la
   card anterior extiende su salida hasta el inicio del siguiente beat real).
   No hay tope fijo de "8 segundos máximo" para esta extensión — el límite
   natural ya es el propio umbral de 3s del mecanismo.

3. **Hueco > 3s** → no se prolonga (una card estirada más de 3s más allá de
   su contenido natural empieza a sentirse estática/pegada). En su lugar se
   genera un beat de relleno nuevo del catálogo (`texto-resaltado`,
   `palabra-a-palabra`, objeto decorativo de la Regla 6.5, etc.), elegido por
   Claude según el contenido hablado en ese fragmento y aplicando
   `motion-philosophy.md`. No hay un tipo fijo por defecto.

   - **Si el hueco es largo (> 8s):** no se cubre con un único beat de
     relleno congelado durante todo el tramo. Se encadenan 2-3 beats de
     relleno más cortos, alineados a los límites de frase del transcript,
     igual que la regla ya existente "si la idea es larga, usa múltiples
     beats" aplicada ahora también al relleno.

4. **Transición entre un beat prolongado/de relleno y el siguiente beat
   real:** corte seco o cross-fade < 0.2s. Nunca solapar dos elementos
   visuales completos — se respeta el máximo de 2 elementos activos a la vez
   de `motion-philosophy.md`.

## Rol del karaoke

- Karaoke deja de ser un tipo de beat que Fase 3.5 genera para rellenar
  huecos.
- Sigue existiendo como capa secundaria opcional bajo cualquier beat visual
  activo (card grande o relleno ligero) — nunca solo, nunca como única
  animación de un tramo.
- Se sigue aplicando la regla de densidad existente: card arriba, karaoke
  abajo.

## Archivos afectados y cambios

- **`CLAUDE.md`** — reescribir Fase 3.5 completa con el algoritmo de arriba
  (prolongación / relleno contextual / encadenado en huecos largos), quitar
  la generación de beats `karaoke` independientes.
- **`styles/motion-philosophy.md`** — quitar "nunca mantener una card más de
  8 segundos" como regla absoluta; sustituir por "la card dura hasta el
  siguiente trigger real, con un máximo de +3s de prolongación por cobertura
  de huecos"; aclarar que karaoke es capa secundaria, nunca independiente.
- **`styles/triggers.md`** — Regla 8 (espaciado mínimo): aclarar que el
  hueco resultante entre dos beats con triggers cercanos ya no es "vídeo
  limpio" sin más — se cubre por el mecanismo de Fase 3.5 (prolongación o
  relleno), no queda sin animación.
- **`styles/video-profiles.md`** — matizar las notas de "densidad baja /
  espacios intencionales" (tutorial, educativo, storytelling, podcast) para
  dejar claro que se refieren a menos cards *grandes/salientes*, no a huecos
  sin ningún refuerzo visual — esos huecos se siguen cubriendo igual que en
  cualquier perfil.
- **`styles/effects-catalog.md`** — actualizar la entrada `karaoke` para
  reflejar que requiere un beat visual activo simultáneo, nunca aparece solo.

## Fuera de alcance

- No se cambia el sistema de triggers.md (reglas 1-7) que decide QUÉ card
  generar ante cada patrón — solo cómo se cubren los huecos entre ellas.
- No se cambia el pipeline de renderizado (Fase 5) ni el compositing.
