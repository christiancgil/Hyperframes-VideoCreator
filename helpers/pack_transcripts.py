"""
Build a compact timeline of what was said and when.
Maps segment timestamps back to positions in the concatenated edited.mp4.
"""
import json, pathlib, subprocess

ROOT   = pathlib.Path(__file__).parent.parent
TRANS  = ROOT / "output" / "edit" / "transcripts"
SEG    = ROOT / "output" / "edit" / "segments"
FFPROBE = (r"C:\Users\cgil\AppData\Local\Microsoft\WinGet\Packages"
           r"\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe"
           r"\ffmpeg-8.1.1-full_build\bin\ffprobe.exe")

GAP_S  = 0.50
PRE_S  = 0.10
POST_S = 0.25

def seg_dur(path):
    return float(subprocess.check_output([
        FFPROBE,"-v","quiet","-show_entries","format=duration","-of","csv=p=0",str(path)
    ]).decode().strip())

def load_words(j):
    data = json.loads(j.read_text(encoding="utf-8"))
    return [w for w in data.get("words",[]) if w.get("type") == "word"]

def group_segments(words):
    if not words: return []
    segs,start,end=[],words[0]["start"],words[0]["end"]
    for w in words[1:]:
        if w["start"]-end>GAP_S:
            segs.append((start,end)); start=w["start"]
        end=w["end"]
    segs.append((start,end))
    return segs

videos = sorted((ROOT/"input").glob("*.mp4"))
timeline = []
cursor   = 0.0   # position in edited.mp4

for v in videos:
    tj = TRANS/(v.stem+".json")
    if not tj.exists(): continue
    words = load_words(tj)
    segs  = group_segments(words)

    for i,(ss,se) in enumerate(segs):
        seg_file = SEG/f"{v.stem}_{i+1:02d}.mp4"
        if not seg_file.exists(): continue
        d = seg_dur(seg_file)

        # Which words fall in this segment?
        t0 = max(0, ss-PRE_S)
        seg_words = [w for w in words if w["start"]>=ss-0.05 and w["end"]<=se+0.05]
        text = " ".join(w["text"] for w in seg_words)

        timeline.append({
            "file": v.name, "seg": i+1,
            "src_start": round(ss,3), "src_end": round(se,3),
            "edit_start": round(cursor,3),
            "edit_end":   round(cursor+d,3),
            "text": text
        })
        cursor += d

out = ROOT/"output"/"edit"/"timeline.json"
out.write_text(json.dumps(timeline, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Timeline: {len(timeline)} segmentos, {cursor:.1f}s total")
for t in timeline:
    print(f"  [{t['edit_start']:.1f}-{t['edit_end']:.1f}s] {t['file']} → {t['text'][:60]}")
