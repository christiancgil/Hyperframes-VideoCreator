"""Transcribe all mp4 files in input/ using ElevenLabs Scribe."""
import os, sys, json, pathlib, requests

ROOT    = pathlib.Path(__file__).parent.parent
INPUT   = ROOT / "input"
OUT_DIR = ROOT / "output" / "edit" / "transcripts"
OUT_DIR.mkdir(parents=True, exist_ok=True)

API_KEY = ""
env_file = ROOT / ".env"
if env_file.exists():
    for line in env_file.read_text(encoding="utf-8").splitlines():
        if line.startswith("ELEVENLABS_API_KEY="):
            API_KEY = line.split("=", 1)[1].strip()

if not API_KEY:
    sys.exit("ERROR: ELEVENLABS_API_KEY no encontrado en .env")

def transcribe(video_path: pathlib.Path) -> dict:
    print(f"  Transcribiendo {video_path.name} ...", flush=True)
    with open(video_path, "rb") as f:
        resp = requests.post(
            "https://api.elevenlabs.io/v1/speech-to-text",
            headers={"xi-api-key": API_KEY},
            files={"file": (video_path.name, f, "video/mp4")},
            data={
                "model_id": "scribe_v1",
                "timestamps_granularity": "word",
                "diarize": "false",
            },
            timeout=120,
        )
    resp.raise_for_status()
    return resp.json()

videos = sorted(INPUT.glob("*.mp4"))
if not videos:
    sys.exit("ERROR: No hay mp4 en input/")

for v in videos:
    out = OUT_DIR / (v.stem + ".json")
    if out.exists():
        print(f"  {v.name} ya transcrito, saltando.")
        continue
    data = transcribe(v)
    out.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    words = len(data.get("words", []))
    print(f"  -> {out.name}  ({words} palabras)")

print("Transcripcion completada.")
