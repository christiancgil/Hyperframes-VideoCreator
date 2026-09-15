#!/bin/bash
# Arranca Quick Tunnel para HyperFrames y exporta la URL pública
PORT=${1:-5190}
LOG=/tmp/cloudflared_tunnel.log

pkill -f "cloudflared tunnel" 2>/dev/null || true
sleep 1

cloudflared tunnel --url http://localhost:$PORT > $LOG 2>&1 &
echo $! > /tmp/cloudflared.pid

# Esperar hasta 20s a que aparezca la URL
for i in $(seq 1 20); do
  URL=$(grep -o 'https://[a-zA-Z0-9-]*\.trycloudflare\.com' $LOG 2>/dev/null | head -1)
  if [ -n "$URL" ]; then
    echo "$URL"
    exit 0
  fi
  sleep 1
done

echo 'ERROR: tunnel no arrancó' && exit 1
