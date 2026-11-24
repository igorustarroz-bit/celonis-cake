#!/usr/bin/env bash
# Export every version's illustrations to cake/versions/<slug>/webp/<slot>.webp — 2x (1078 px wide), as the page
# shows them, animated where the slot moves (15 fps). Then rebuild the index, whose thumbnails use these files.
# Needs: ffmpeg (with libwebp), python3 + Pillow, node + playwright (for the WebGL slots).
# Run from the repo root:  bash cake/tools/export-webp.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
V=cake/versions; T=cake/tools; TMP=$(mktemp -d)
SLOTS="hero shortlist step-1 step-2 step-3"
still() {  # still <src image> <dst.webp> [multiply bg grey 0-255]
  python3 - "$1" "$2" "${3:-255}" <<'PY'
import sys
from PIL import Image, ImageChops
im = Image.open(sys.argv[1]); g = int(sys.argv[3])
if g < 255: im = ImageChops.multiply(im.convert('RGB'), Image.new('RGB', im.size, (g, g, g)))
im.save(sys.argv[2], quality=90, method=6)
PY
}
anim() {   # anim <frames dir> <dst.webp>
  ffmpeg -v error -y -framerate 15 -i "$1/%04d.png" -c:v libwebp_anim -loop 0 -quality 75 -compression_level 4 "$2"
}
for d in $V/*/; do
  slug=$(basename "$d"); mkdir -p "$d/webp"
  webgl=$(python3 -c "import json,sys; print(' '.join(f'{k}={v}' for k,v in json.load(open('$d/version.json')).get('webgl',{}).items()))")
  for s in $SLOTS; do
    scene=$(echo " $webgl " | grep -o " $s=[^ ]*" | cut -d= -f2 || true)
    out="$d/webp/$s.webp"
    if [ -n "$scene" ]; then
      # WebGL: loop length per slot (ms; 0 = a still: the slice hero and the held shortlist)
      case "$scene:$s" in
        # classic-3d (cake-3d-classic.js): the still hero/shortlist loop their ambient motion (api.loop(): 4.2 s, light WebPs)
        classic-story:hero) ms=28200 ;;
        classic:hero|classic-light:shortlist) ms=4200 ;; classic-light:step-1) ms=10400 ;;
        classic-light:step-2) ms=11600 ;; classic-light:step-3) ms=11200 ;;
        cake-3d:hero) ms=27900 ;; cake-3d-slice:hero) ms=0 ;;
        *:shortlist) ms=0 ;; *:step-1) ms=9300 ;; *:step-2) ms=10700 ;; *:step-3) ms=11200 ;;
      esac
      f="$TMP/$slug-$s"; mkdir -p "$f"
      fps=15; [ "$ms" -gt 15000 ] && fps=5                 # long story heroes: 5 fps, half size (weight)
      node $T/capture-webgl.js "$slug" "$s" "$ms" $fps "$f"
      grey=255; [ "$s" = shortlist ] && grey=245          # canvas is multiplied onto the module (#f5f5f5)
      if [ "$ms" = 0 ]; then still "$f/0000.png" "$out" $grey
      else
        [ "$grey" != 255 ] && for fr in "$f"/*.png; do still "$fr" "$fr" $grey; done   # animated shortlist: same module grey
        if [ "$fps" = 5 ]; then
          ffmpeg -v error -y -framerate 5 -i "$f/%04d.png" -vf "scale=iw/2:-2:flags=lanczos" -c:v libwebp_anim -loop 0 -quality 60 -compression_level 4 "$out"
        else anim "$f" "$out"; fi
      fi
    elif [ -f "$d/img/$s.mp4" ]; then
      # 16:9 clip shown "contain" in a 4:3 box on the module's background (black hero, #f5f5f5 shortlist, white steps)
      bg=white; [ "$s" = hero ] && bg=black; [ "$s" = shortlist ] && bg=0xf5f5f5
      # 30 s clips: 7.5 fps, half size (weight)
      ffmpeg -v error -y -i "$d/img/$s.mp4" -vf "fps=7.5,scale=1078:-2:flags=lanczos,pad=1078:808:0:(oh-ih)/2:$bg,scale=539:-2:flags=lanczos" -c:v libwebp_anim -loop 0 -quality 70 -compression_level 4 "$out"
    else
      still "$d/img/$s.png" "$out"
    fi
    echo "$out"
  done
done
rm -rf "$TMP"
python3 cake/make-version.py index
