$FFMPEG  = "C:\Users\cgil\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.1-full_build\bin\ffmpeg.exe"
$FFPROBE = "C:\Users\cgil\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.1-full_build\bin\ffprobe.exe"
$INPUT   = "d:\Repositorios\divisual-video-editor-kit 2\input"
$OUT     = "d:\Repositorios\divisual-video-editor-kit 2\output\trimmed"

# Video 1 — segmentos: 0→2.12, 2.57→16.53
Write-Host "[1/5] Procesando video 1..."
$fc1 = "[0:v]trim=start=0:end=2.12,setpts=PTS-STARTPTS[v0];[0:a]atrim=start=0:end=2.12,asetpts=PTS-STARTPTS[a0];[0:v]trim=start=2.57:end=16.53,setpts=PTS-STARTPTS[v1];[0:a]atrim=start=2.57:end=16.53,asetpts=PTS-STARTPTS[a1];[v0][a0][v1][a1]concat=n=2:v=1:a=1[vo][ao]"
& $FFMPEG -i "$INPUT\1.MP4" -filter_complex $fc1 -map "[vo]" -map "[ao]" -c:v libx264 -crf 18 -preset fast -c:a aac -b:a 192k -movflags +faststart "$OUT\trimmed_1.mp4" -y
Write-Host "[1/5] DONE — exit $LASTEXITCODE"

# Video 2 — segmentos: 1.14→2.06, 2.60→14.51, 14.99→17.72
Write-Host "[2/5] Procesando video 2..."
$fc2 = "[0:v]trim=start=1.14:end=2.06,setpts=PTS-STARTPTS[v0];[0:a]atrim=start=1.14:end=2.06,asetpts=PTS-STARTPTS[a0];[0:v]trim=start=2.60:end=14.51,setpts=PTS-STARTPTS[v1];[0:a]atrim=start=2.60:end=14.51,asetpts=PTS-STARTPTS[a1];[0:v]trim=start=14.99:end=17.72,setpts=PTS-STARTPTS[v2];[0:a]atrim=start=14.99:end=17.72,asetpts=PTS-STARTPTS[a2];[v0][a0][v1][a1][v2][a2]concat=n=3:v=1:a=1[vo][ao]"
& $FFMPEG -i "$INPUT\2.MP4" -filter_complex $fc2 -map "[vo]" -map "[ao]" -c:v libx264 -crf 18 -preset fast -c:a aac -b:a 192k -movflags +faststart "$OUT\trimmed_2.mp4" -y
Write-Host "[2/5] DONE — exit $LASTEXITCODE"

# Video 3 — completo (ya existe pero lo rehacemos para consistencia)
Write-Host "[3/5] Procesando video 3..."
& $FFMPEG -i "$INPUT\3.MP4" -c:v libx264 -crf 18 -preset fast -c:a aac -b:a 192k -movflags +faststart "$OUT\trimmed_3.mp4" -y
Write-Host "[3/5] DONE — exit $LASTEXITCODE"

# Video 4 — corte en 25.02s
Write-Host "[4/5] Procesando video 4..."
& $FFMPEG -i "$INPUT\4.MP4" -t 25.02 -c:v libx264 -crf 18 -preset fast -c:a aac -b:a 192k -movflags +faststart "$OUT\trimmed_4.mp4" -y
Write-Host "[4/5] DONE — exit $LASTEXITCODE"

# Video 5 — corte en 18.78s
Write-Host "[5/5] Procesando video 5..."
& $FFMPEG -i "$INPUT\5.MP4" -t 18.78 -c:v libx264 -crf 18 -preset fast -c:a aac -b:a 192k -movflags +faststart "$OUT\trimmed_5.mp4" -y
Write-Host "[5/5] DONE — exit $LASTEXITCODE"

Write-Host ""
Write-Host "=== RESUMEN ==="
foreach ($n in 1..5) {
    $f = "$OUT\trimmed_$n.mp4"
    if (Test-Path $f) {
        $sz  = [math]::Round((Get-Item $f).Length/1MB, 2)
        $dur = & $FFPROBE -v quiet -show_entries "format=duration" -of "csv=p=0" $f
        Write-Host "trimmed_$n.mp4  $([math]::Round([double]$dur,2))s  $sz MB"
    } else {
        Write-Host "trimmed_$n.mp4  FALTA"
    }
}
