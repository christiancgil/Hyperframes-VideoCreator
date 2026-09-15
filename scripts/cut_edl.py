"""Cut the 14 keep-segments for cinco-pasos-sonrisa from the original source clips.

Segments were derived from output/edit/transcripts/video_completo.json (word-level),
cross-checked against per-clip silencedetect to correct 3 words whose Scribe timestamp
absorbed the silence spanning a clip splice ("tratamiento.", "posible.", "vender.").
Each segment lists (source_clip, local_start, local_end) already padded to word boundaries.
"""
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).parent.parent
SRC = ROOT / "input" / "originales"
OUT = ROOT / "output" / "edit" / "segments_final"
OUT.mkdir(parents=True, exist_ok=True)

FFMPEG = (r"C:\Users\cgil\AppData\Local\Microsoft\WinGet\Packages"
          r"\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe"
          r"\ffmpeg-8.1.1-full_build\bin\ffmpeg.exe")

# (clip filename, local_start, local_end, beat_label)
# Orden corregido 2026-08-16: el cliente etiquetó mal 1 y 2 al grabar; el
# orden real es dolor (clip2) -> hook (clip1) -> pasos-intro (clip3mp4).
SEGMENTS = [
    ("2.mp4",      1.690, 8.280, "B_ocultan"),
    ("2.mp4",      8.790, 17.160, "C_experiencias"),
    ("1.mp4",      1.070, 6.200, "A_intro"),
    ("3mp4.mp4",   2.363, 8.393, "D_cinco_pasos"),
    ("4.mp4",      0.917, 1.687, "E_paso1_label"),
    ("4.mp4",      2.917, 8.367, "F_paso1_body"),
    ("5.mp4",      2.290, 2.960, "G_paso2_label"),
    ("5.mp4",      4.110, 7.560, "H_paso2_body"),
    ("6.mp4",      1.250, 2.060, "I_paso3_label"),
    ("6.mp4",      2.990, 7.590, "J1_paso3_body"),
    ("7.mp4",      1.517, 8.254, "J2_paso4"),
    ("8.mp4",      1.570, 6.930, "J3_tecnologia"),
    ("9.mp4",      3.020, 8.330, "K_resultado"),
    ("10.mp4",     2.663, 10.967, "L_cta"),
]

FADE = 0.03  # 30ms audio fade per Hard Rule 3 (video-use)


def cut(clip, t0, t1, out, idx):
    # -ss/-to here are OUTPUT options: ffmpeg decodes+filters on the ORIGINAL
    # input timeline and only trims at the muxer, so -af timestamps must be
    # absolute (t0/t1), not segment-relative, or the fade lands outside the
    # kept window and (for -out) permanently silences everything after it.
    fade_in_start = t0
    fade_out_start = t1 - FADE
    af = f"afade=t=in:st={fade_in_start:.3f}:d={FADE},afade=t=out:st={fade_out_start:.3f}:d={FADE}"
    cmd = [
        FFMPEG, "-y",
        "-i", str(SRC / clip),
        "-ss", f"{t0:.3f}", "-to", f"{t1:.3f}",
        "-c:v", "libx264", "-preset", "fast", "-crf", "18",
        "-vf", "scale=576:1024",
        "-r", "30", "-vsync", "cfr",
        "-af", af,
        "-c:a", "aac", "-b:a", "192k",
        str(out),
    ]
    r = subprocess.run(cmd, capture_output=True)
    if r.returncode != 0:
        print(f"  ERROR: {r.stderr.decode(errors='replace')[-500:]}")
        return False
    return True


manifest = []
for i, (clip, t0, t1, label) in enumerate(SEGMENTS, start=1):
    out = OUT / f"seg_{i:02d}_{label}.mp4"
    print(f"[{i:02d}] {clip}  {t0:.3f}-{t1:.3f}  ({t1-t0:.2f}s)  -> {out.name}", end=" ")
    ok = cut(clip, t0, t1, out, i)
    print("OK" if ok else "FAILED")
    if ok:
        manifest.append(out)

concat_path = OUT / "concat_list.txt"
concat_path.write_text(
    "\n".join(f"file '{p.name}'" for p in manifest),
    encoding="utf-8",
)
print(f"\n{len(manifest)}/{len(SEGMENTS)} segmentos OK. Concat list: {concat_path}")
