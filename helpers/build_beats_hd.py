"""
Genera los 8 beats HTML para 1080x1920 (Instagram Reel HD).
Estrategia: canvas interno 576x1024 escalado 1.875x con CSS transform.
Esto mantiene todas las proporciones y font-sizes correctas sin reescribir todo.
"""
import pathlib, shutil

ROOT    = pathlib.Path(__file__).parent.parent
SRC_DIR = ROOT / "skills/hyperframes/packages/studio/data/projects/dental-v2"
DST_STU = ROOT / "skills/hyperframes/packages/studio/data/projects/dental-v3"
DST_OUT = ROOT / "output/compositions/dental-v3"

SCALE = 1.875  # 1080/576

CSS_WRAPPER = """
html, body {
  background: transparent !important;
  width: 1080px; height: 1920px;
  overflow: hidden;
  margin: 0; padding: 0;
}
#scale-root {
  transform: scale(1.875);
  transform-origin: top left;
  width: 576px;
  height: 1024px;
  overflow: hidden;
  position: relative;
}
"""

def transform_html(src: pathlib.Path, beat_id: str, duration: float) -> str:
    text = src.read_text(encoding="utf-8")

    # 1. Reemplazar meta viewport
    text = text.replace(
        'content="width=576, height=1024"',
        'content="width=1080, height=1920"'
    )

    # 2. Reemplazar data atributos del root div
    text = text.replace('data-width="576" data-height="1024"',
                        'data-width="1080" data-height="1920"')

    # 3. Reemplazar estilos del body/html con el wrapper escalador
    # Buscar y eliminar el bloque html,body {...} y reemplazar por CSS_WRAPPER
    import re
    text = re.sub(
        r'html,\s*body\s*\{[^}]+\}',
        CSS_WRAPPER,
        text,
        count=1
    )

    # 4. Envolver el div#root en un div#scale-root
    text = text.replace(
        '<div id="root"',
        '<div id="scale-root"><div id="root"'
    )
    # Cerrar el scale-root antes del </body>
    text = text.replace(
        '</body>',
        '  </div>\n</body>'
    )

    # 5. Actualizar la posición de las imágenes del logo para dental-v3
    # (los paths relativos cambian porque estamos en el mismo nivel)

    return text

files = {
    "index.html":    ("beat-01", 5.0),
    "compositions/beat_02.html": ("beat-02", 5.0),
    "compositions/beat_03.html": ("beat-03", 5.0),
    "compositions/beat_04.html": ("beat-04", 4.0),
    "compositions/beat_05.html": ("beat-05", 7.0),
    "compositions/beat_06.html": ("beat-06", 5.0),
    "compositions/beat_07.html": ("beat-07", 5.0),
    "compositions/beat_08.html": ("beat-08", 4.7),
}

for rel, (beat_id, dur) in files.items():
    src = SRC_DIR / rel
    if not src.exists():
        print(f"  SKIP (no existe): {rel}")
        continue
    html = transform_html(src, beat_id, dur)

    # Destinos
    fname = pathlib.Path(rel).name
    stu = DST_STU / fname if "compositions" not in rel else DST_STU / "compositions" / fname
    out = DST_OUT / fname

    stu.parent.mkdir(parents=True, exist_ok=True)
    stu.write_text(html, encoding="utf-8")
    out.write_text(html, encoding="utf-8")
    print(f"  ✓ {fname}")

print("\nBeats HD generados en dental-v3")
