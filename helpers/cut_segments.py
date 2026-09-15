"""
Cut speaking segments from each input video.
- Detects speech from word timestamps (ElevenLabs Scribe)
- Merges words within GAP_S seconds into one segment
- Adds PRE/POST padding
- Re-encodes to true portrait 576x1024 (removing rotation tag)
- Saves output/edit/segments/VID_segN.mp4
"""
import os, sys, json, pathlib, subprocess

ROOT    = pathlib.Path(__file__).parent.parent
TRANS   = ROOT / "output" / "edit" / "transcripts"
SEG_DIR = ROOT / "output" / "edit" / "segments"
SEG_DIR.mkdir(parents=True, exist_ok=True)

FFMPEG  = (r"C:\Users\cgil\AppData\Local\Microsoft\WinGet\Packages"
           r"\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe"
           r"\ffmpeg-8.1.1-full_build\bin\ffmpeg.exe")

GAP_S   = 0.50   # silences longer than this split segments
PRE_S   = 0.10   # padding before first word
POST_S  = 0.25   # padding after last word

def load_words(json_path):
    data = json.loads(json_path.read_text(encoding="utf-8"))
    words = data.get("words", [])
    # keep only real speech words — filter out audio_event (ruidos, pausas) y spacing
    return [w for w in words if w.get("type") == "word"]

def group_segments(words):
    """Merge consecutive words into segments, splitting on gaps > GAP_S."""
    if not words:
        return []
    segs, start, end = [], words[0]["start"], words[0]["end"]
    for w in words[1:]:
        if w["start"] - end > GAP_S:
            segs.append((start, end))
            start = w["start"]
        end = w["end"]
    segs.append((start, end))
    return segs

def cut(video: pathlib.Path, seg_start: float, seg_end: float, out: pathlib.Path):
    t_start = max(0, seg_start - PRE_S)
    t_end   = seg_end + POST_S
    cmd = [
        FFMPEG, "-y",
        "-i", str(video),
        "-ss", f"{t_start:.3f}",
        "-to", f"{t_end:.3f}",
        # Re-encode: ffmpeg auto-applies the -90° rotation during decode.
        # The output is true portrait 576x1024 with no rotation tag.
        "-c:v", "libx264", "-preset", "fast", "-crf", "18",
        "-vf", "scale=576:1024",
        "-r", "30",           # forzar CFR 30fps para evitar VFR mismatch en concat
        "-vsync", "cfr",      # constant frame rate
        "-c:a", "aac", "-b:a", "192k",
        str(out),
    ]
    r = subprocess.run(cmd, capture_output=True)
    if r.returncode != 0:
        print(f"    ERROR ffmpeg: {r.stderr.decode(errors='replace')[-300:]}")
        return False
    return True

videos = sorted((ROOT / "input").glob("*.mp4"))
manifest = []   # list of segment file paths in order

for v in videos:
    tj = TRANS / (v.stem + ".json")
    if not tj.exists():
        print(f"  Sin transcripcion para {v.name}, saltando.")
        continue

    words = load_words(tj)
    segs  = group_segments(words)
    dur   = float(subprocess.check_output([
        FFMPEG.replace("ffmpeg.exe","ffprobe.exe"),
        "-v","quiet","-show_entries","format=duration","-of","csv=p=0", str(v)
    ]).decode().strip())

    print(f"\n{v.name}  ({dur:.1f}s)  → {len(segs)} segmento(s) de habla")
    for i, (ss, se) in enumerate(segs):
        out = SEG_DIR / f"{v.stem}_{i+1:02d}.mp4"
        print(f"  [{ss:.2f}s – {se:.2f}s]  → {out.name}", end=" ", flush=True)
        ok = cut(v, ss, se, out)
        if ok:
            manifest.append(str(out))
            print("OK")

# Write concat list
concat = ROOT / "output" / "edit" / "concat_list.txt"
concat.write_text(
    "\n".join(f"file '{p}'" for p in manifest),
    encoding="utf-8"
)
print(f"\n{len(manifest)} segmentos guardados.")
print(f"Concat list: {concat}")
