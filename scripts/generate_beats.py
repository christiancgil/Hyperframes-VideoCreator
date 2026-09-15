# -*- coding: utf-8 -*-
"""Generate the 11 motion-graphics beats for cinco-pasos-sonrisa.
Style: llamativo (styles/client-style-llamativo.md) + 9:16 rules (styles/aspect-ratios.md).
Animations are plain CSS @keyframes, deterministically seekable via the Web
Animations API (document.getAnimations()) in capture.js — no GSAP dependency.
"""
import base64
import pathlib

ROOT = pathlib.Path(__file__).parent.parent
OUT = ROOT / "output" / "compositions" / "cinco-pasos-sonrisa"
OUT.mkdir(parents=True, exist_ok=True)

VIDEO_W, VIDEO_H = 576, 1024

LOGO_B64 = base64.b64encode((ROOT / "brand" / "logo.png").read_bytes()).decode()
LOGO_URI = f"data:image/png;base64,{LOGO_B64}"

FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com">'
         '<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700'
         '&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">')

BASE_CSS = f"""
* {{ margin:0; padding:0; box-sizing:border-box; }}
html, body {{
  width:{VIDEO_W}px; height:{VIDEO_H}px;
  background: transparent;
  font-family:'Inter', sans-serif;
  overflow:hidden;
}}
.scene {{ position:absolute; inset:0; }}
.card {{
  position:absolute;
  background: rgba(30,41,59,0.60);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(96,165,250,0.15);
  border-radius: 14px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
}}
.accent {{ color:#60a5fa; }}
.green {{ color:#4ade80; }}
.yellow {{ color:#fbbf24; }}
.soft {{ color:#888888; }}
.title-font {{ font-family:'Space Grotesk', sans-serif; font-weight:700; }}

@keyframes popIn {{
  0%   {{ opacity:0; transform:scale(0.85); }}
  70%  {{ opacity:1; transform:scale(1.03); }}
  100% {{ opacity:1; transform:scale(1); }}
}}
@keyframes slideInFast {{
  from {{ opacity:0; transform:translateY(16px); }}
  to   {{ opacity:1; transform:translateY(0); }}
}}
@keyframes slamIn {{
  0%   {{ opacity:0; transform:scale(1.1); }}
  100% {{ opacity:1; transform:scale(1); }}
}}
@keyframes checkPop {{
  0%   {{ opacity:0; transform:scale(0) rotate(-15deg); }}
  60%  {{ opacity:1; transform:scale(1.15) rotate(4deg); }}
  100% {{ opacity:1; transform:scale(1) rotate(0deg); }}
}}
"""


def page(body, extra_css="", title="beat"):
    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>{title}</title>
{FONTS}
<style>
{BASE_CSS}
{extra_css}
</style>
</head>
<body>
<div class="scene">
{body}
</div>
</body>
</html>
"""


def write(name, html):
    (OUT / name).write_text(html, encoding="utf-8")
    print(f"  {name}")


# ── Beat 01 — HOOK (ahora en mitad del vídeo, sin logo) ─────────────────────
b01 = page(
    body="""
  <div style="position:absolute; top:8%; left:6%; width:88%; text-align:center;
    opacity:0; animation: slamIn 0.5s cubic-bezier(0.16,1,0.3,1) 0.2s forwards;">
    <div class="title-font" style="font-size:clamp(28px,7.5vw,46px); color:#e0e0e0;
      line-height:1.15; text-shadow:0 4px 20px rgba(0,0,0,0.9);">
      Vuelve a <span class="accent">reír</span>, <span class="accent">besar</span>,<br>
      hablar con <span class="yellow">total naturalidad</span>
    </div>
  </div>
""",
    title="01 hook",
)
write("beat_01_hook.html", b01)

# ── Beat 02 — DOLOR 1 / INTRO (ahora es el primer beat del vídeo, con logo) ──
b02 = page(
    body=f"""
  <img src="{LOGO_URI}" style="position:absolute; top:4%; left:4%; width:8%; height:auto;
    object-fit:contain; opacity:0; animation: slideInFast 0.4s ease 0.1s forwards;">
  <div class="card" style="bottom:8%; left:5%; width:90%; padding:26px 28px;
    opacity:0; animation: popIn 0.35s cubic-bezier(0.16,1,0.3,1) 0.1s forwards;">
    <div class="title-font" style="font-size:clamp(24px,5.5vw,34px); color:#e0e0e0; line-height:1.25;">
      Muchas personas <span class="accent">ocultan su sonrisa</span>
    </div>
    <div style="margin-top:10px; font-size:clamp(18px,4vw,24px); color:#cbd5e1;">
      dientes chuecos, amarillos... o simplemente no les gusta
    </div>
  </div>
""",
    title="02 dolor1",
)
write("beat_02_dolor1.html", b02)

# ── Beat 03 — DOLOR 2 ────────────────────────────────────────────────────────
b03 = page(
    body="""
  <div class="card" style="bottom:8%; left:5%; width:90%; padding:26px 28px;
    opacity:0; animation: popIn 0.35s cubic-bezier(0.16,1,0.3,1) 0.1s forwards;">
    <div class="title-font" style="font-size:clamp(22px,5vw,30px); color:#e0e0e0; line-height:1.3;">
      ¿Malas experiencias en <span class="accent">citas pasadas</span>?
    </div>
    <div style="margin-top:10px; font-size:clamp(17px,3.8vw,22px); color:#cbd5e1;">
      No te han hecho sentir bien. Lo entendemos.
    </div>
  </div>
""",
    title="03 dolor2",
)
write("beat_03_dolor2.html", b03)

# ── Beat 04 — TITULO 5 PASOS ─────────────────────────────────────────────────
b04 = page(
    body="""
  <div style="position:absolute; bottom:6%; left:5%; width:90%; text-align:center;
    opacity:0; animation: slamIn 0.45s cubic-bezier(0.16,1,0.3,1) 0.15s forwards;">
    <div class="title-font" style="font-size:clamp(30px,7vw,48px); color:#ffffff;
      text-shadow:0 4px 20px rgba(0,0,0,0.9);">
      <span class="accent">5 PASOS</span><br>para tu nueva sonrisa
    </div>
  </div>
""",
    title="04 pasos-intro",
)
write("beat_04_pasos_intro.html", b04)

# ── Beats 05-08 — Lista de pasos (persistente, un paso activo por beat) ──────
PASOS = [
    "Eres una historia, no una cifra",
    "Traes tus exámenes",
    "Cuéntanos el motivo de tu consulta",
    "Plan de tratamiento a tu medida",
]


def bullet_list_beat(active_index):
    items = []
    for i, text in enumerate(PASOS):
        n = i + 1
        is_active = i == active_index
        is_done = i < active_index
        is_future = i > active_index
        if is_future:
            continue  # not mentioned yet
        color = "accent" if is_active else "soft"
        anim = ("opacity:0; animation: slideInFast 0.3s cubic-bezier(0.16,1,0.3,1) 0.1s forwards;"
                if is_active else "opacity:1;")
        weight = "600" if is_active else "400"
        items.append(f"""
    <div style="display:flex; align-items:flex-start; gap:12px; margin-top:{0 if i==0 else 14}px; {anim}">
      <div class="title-font {color}" style="font-size:clamp(20px,4.5vw,28px); flex-shrink:0;">{n:02d}</div>
      <div style="font-size:clamp(18px,4.2vw,26px); font-weight:{weight}; color:{'#e0e0e0' if is_active or is_done else '#888'};">{text}</div>
    </div>""")
    return page(
        body=f"""
  <div class="card" style="bottom:8%; left:5%; width:90%; padding:24px 26px;">
    {''.join(items)}
  </div>
""",
        title=f"paso {active_index+1}",
    )


for i in range(4):
    write(f"beat_{5+i:02d}_paso{i+1}.html", bullet_list_beat(i))

# ── Beat 09 — CONFIANZA (tecnología + trato humano) ─────────────────────────
b09 = page(
    body="""
  <div class="card" style="bottom:8%; left:8%; width:84%; padding:26px 24px;
    display:flex; align-items:center; gap:18px;
    opacity:0; animation: popIn 0.35s cubic-bezier(0.16,1,0.3,1) 0.1s forwards;">
    <div style="width:54px; height:54px; border-radius:50%; background:rgba(74,222,128,0.15);
      display:flex; align-items:center; justify-content:center; flex-shrink:0;
      opacity:0; animation: checkPop 0.5s cubic-bezier(0.16,1,0.3,1) 0.25s forwards;">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path d="M4 12.5L9.5 18L20 6.5" stroke="#4ade80" stroke-width="3"
          stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
    <div>
      <div class="title-font" style="font-size:clamp(20px,4.5vw,26px); color:#e0e0e0;">
        Tecnología de punta
      </div>
      <div class="green" style="font-size:clamp(17px,3.8vw,22px); font-weight:600; margin-top:4px;">
        + tratamiento 100% humano
      </div>
    </div>
  </div>
""",
    title="09 confianza",
)
write("beat_09_confianza.html", b09)

# ── Beat 10 — RESULTADO (quote-contraste) ────────────────────────────────────
b10 = page(
    body="""
  <div style="position:absolute; bottom:7%; left:6%; width:88%; text-align:center;
    opacity:0; animation: slamIn 0.45s cubic-bezier(0.16,1,0.3,1) 0.15s forwards;
    border-left:3px solid #fbbf24; padding-left:18px; text-align:left;">
    <div class="title-font" style="font-size:clamp(24px,5.5vw,34px); color:#ffffff; line-height:1.3;
      text-shadow:0 4px 20px rgba(0,0,0,0.9);">
      La sonrisa que <span class="yellow">TÚ quieres</span>,<br>
      no la que <span style="color:#888; text-decoration:line-through; text-decoration-thickness:2px;">te quisieron vender</span>
    </div>
  </div>
""",
    title="10 resultado",
)
write("beat_10_resultado.html", b10)

# ── Beat 11 — CTA + GRATIS + logo cierre ─────────────────────────────────────
b11 = page(
    body=f"""
  <div class="card" style="bottom:8%; left:5%; width:90%; padding:28px 26px;
    border:2px solid #60a5fa; background:rgba(96,165,250,0.10);
    opacity:0; animation: popIn 0.35s cubic-bezier(0.16,1,0.3,1) 0.1s forwards;">
    <div style="display:flex; align-items:center; justify-content:center; margin-bottom:14px;">
      <img src="{LOGO_URI}" style="width:22%; height:auto; object-fit:contain;">
    </div>
    <div class="title-font" style="font-size:clamp(22px,5vw,30px); color:#ffffff; text-align:center; line-height:1.3;">
      Toca el link en mi biografía
    </div>
    <div style="display:flex; align-items:center; justify-content:center; margin-top:14px;">
      <div style="background:#4ade80; color:#0a0a0a; font-weight:700; font-family:'Space Grotesk',sans-serif;
        font-size:clamp(14px,3.2vw,18px); padding:6px 18px; border-radius:20px;
        opacity:0; animation: popIn 0.3s cubic-bezier(0.16,1,0.3,1) 0.4s forwards;">
        VALORACIÓN GRATIS
      </div>
    </div>
  </div>
""",
    title="11 cta",
)
write("beat_11_cta.html", b11)

print("\n11 beats generados en", OUT)
