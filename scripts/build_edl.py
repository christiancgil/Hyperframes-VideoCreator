import json
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).parent.parent
SEG_DIR = ROOT / "output" / "edit" / "segments_final"
FFPROBE = (r"C:\Users\cgil\AppData\Local\Microsoft\WinGet\Packages"
           r"\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe"
           r"\ffmpeg-8.1.1-full_build\bin\ffprobe.exe")

BEATS = [
    ("seg_01_B_ocultan.mp4", "problema", "Muchas personas ocultan su sonrisa porque tienen los dientes chuecos o amarillos o simplemente no les gusta."),
    ("seg_02_C_experiencias.mp4", "problema", "A eso también le podemos agregar que han tenido malas experiencias en citas pasadas con odontólogos en donde no los han hecho sentir bien."),
    ("seg_03_A_intro.mp4", "hook", "Vuelve a reír, besar, hablar con total naturalidad siguiendo los siguientes pasos."),
    ("seg_04_D_cinco_pasos.mp4", "transicion", "Aquí te voy a dar los cinco pasos que utilizamos en nuestra consulta para darte la confianza y seguridad."),
    ("seg_05_E_paso1_label.mp4", "paso_label", "Paso uno:"),
    ("seg_06_F_paso1_body.mp4", "paso_body", "eres una historia, no una cifra. Cuéntanos cómo te sientes y lo que has intentado."),
    ("seg_07_G_paso2_label.mp4", "paso_label", "Paso dos:"),
    ("seg_08_H_paso2_body.mp4", "paso_body", "traes tus exámenes y cuéntame cómo te podemos ayudar."),
    ("seg_09_I_paso3_label.mp4", "paso_label", "Paso tres:"),
    ("seg_10_J1_paso3_body.mp4", "paso_body", "cuéntanos cuál es el motivo de tu consulta y te brindaremos muchas opciones de tratamiento."),
    ("seg_11_J2_paso4.mp4", "paso_label_body", "Paso cuatro: diseñamos planes de tratamiento de seis a diez citas con la menor molestia posible."),
    ("seg_12_J3_tecnologia.mp4", "cierre_pasos", "Aplicamos tecnología de punta con un tratamiento cien por ciento humano."),
    ("seg_13_K_resultado.mp4", "resultado", "Si haces esto, en pocas semanas tendrás la sonrisa que tú quieres y no la que te quisieron vender."),
    ("seg_14_L_cta.mp4", "cta", "Toca el link en mi biografía y recibirás una valoración especial y sin costo para ti."),
]


def dur(path):
    out = subprocess.check_output([
        FFPROBE, "-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)
    ])
    return float(out.decode().strip())


edl = {"version": 1, "source": "output/cinco-pasos-sonrisa_edited.mp4", "beats": []}
t = 0.0
for fname, kind, quote in BEATS:
    d = dur(SEG_DIR / fname)
    edl["beats"].append({
        "id": fname.split("_", 2)[1] + "_" + fname.rsplit("_", 1)[-1].replace(".mp4", ""),
        "kind": kind,
        "start": round(t, 3),
        "end": round(t + d, 3),
        "duration": round(d, 3),
        "quote": quote,
    })
    t += d

edl["total_duration"] = round(t, 3)

out_path = ROOT / "output" / "edit" / "edl.json"
out_path.write_text(json.dumps(edl, indent=2, ensure_ascii=False), encoding="utf-8")
print(f"EDL guardado: {out_path}")
print(f"Duración total: {t:.3f}s")
for b in edl["beats"]:
    print(f"  [{b['start']:7.3f}-{b['end']:7.3f}] {b['id']:20s} {b['quote'][:60]}")
