"""Composite the 11 ProRes 4444 beat overlays onto the edited base video."""
import subprocess
import pathlib

ROOT = pathlib.Path(__file__).parent.parent
BASE = ROOT / "output" / "cinco-pasos-sonrisa_edited.mp4"
RENDERS = ROOT / "output" / "compositions" / "cinco-pasos-sonrisa" / "renders"
OUT = ROOT / "output" / "cinco-pasos-sonrisa_final.mp4"

FFMPEG = (r"C:\Users\cgil\AppData\Local\Microsoft\WinGet\Packages"
          r"\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe"
          r"\ffmpeg-8.1.1-full_build\bin\ffmpeg.exe")

# (mov filename, start_in_output, duration)
# Orden corregido 2026-08-16: dolor1 -> dolor2 -> hook -> pasos_intro -> resto igual.
BEATS = [
    ("beat_02_dolor1.mov",      0.000, 6.600),
    ("beat_03_dolor2.mov",      6.600, 8.400),
    ("beat_01_hook.mov",       15.000, 5.133),
    ("beat_04_pasos_intro.mov",20.133, 6.034),
    ("beat_05_paso1.mov",      26.167, 6.266),
    ("beat_06_paso2.mov",      32.433, 4.167),
    ("beat_07_paso3.mov",      36.600, 5.433),
    ("beat_08_paso4.mov",      42.033, 6.767),
    ("beat_09_confianza.mov",  48.800, 5.367),
    ("beat_10_resultado.mov",  54.167, 5.333),
    ("beat_11_cta.mov",        59.500, 8.304),
]

cmd = [FFMPEG, "-y", "-i", str(BASE)]
for fname, _, _ in BEATS:
    cmd += ["-i", str(RENDERS / fname)]

filter_parts = []
prev_label = "0:v"
for i, (fname, start, dur) in enumerate(BEATS, start=1):
    ov_label = f"ov{i}"
    tmp_label = f"tmp{i}"
    filter_parts.append(f"[{i}:v]setpts=PTS-STARTPTS+{start}/TB[{ov_label}]")
    end = start + dur
    filter_parts.append(
        f"[{prev_label}][{ov_label}]overlay=0:0:enable='between(t,{start},{end})'[{tmp_label}]"
    )
    prev_label = tmp_label

filter_complex = ";".join(filter_parts)

cmd += [
    "-filter_complex", filter_complex,
    "-map", f"[{prev_label}]", "-map", "0:a",
    "-c:v", "libx264", "-preset", "slow", "-crf", "18",
    "-c:a", "copy",
    str(OUT),
]

print("Compositing", len(BEATS), "beats onto", BASE.name)
r = subprocess.run(cmd, capture_output=True, text=True)
print(r.stdout[-2000:])
print(r.stderr[-3000:])
if r.returncode != 0:
    raise SystemExit(f"ffmpeg failed with code {r.returncode}")
print("OK ->", OUT)
