#!/bin/bash
# Run a single client-side render parity test
# Usage: ./run-parity-test.sh <test-name> <width> <height> <fps>
set -e

TEST_NAME=$1
WIDTH=${2:-1080}
HEIGHT=${3:-1920}
FPS=${4:-30}
PORT=4789
OUTPUT_DIR="renders/parity-regression/$TEST_NAME"

echo "[$TEST_NAME] Rendering ${WIDTH}x${HEIGHT} @ ${FPS}fps..."

# Create a render page
cat > "$OUTPUT_DIR/render-page.html" <<HTMLEOF
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Rendering...</title></head>
<body>
<pre id="log"></pre>
<script type="module">
function log(msg) {
  document.getElementById('log').textContent += msg + '\\n';
}
try {
  const { render } = await import('http://localhost:${PORT}/packages/renderer/dist/renderer.bundle.js');
  log('Renderer loaded, starting render...');

  const result = await render({
    composition: 'http://localhost:${PORT}/${OUTPUT_DIR}/compiled.html',
    fps: ${FPS},
    width: ${WIDTH},
    height: ${HEIGHT},
    codec: 'h264',
    format: 'mp4',
    concurrency: 1,
    workerUrl: 'http://localhost:${PORT}/packages/renderer/dist/worker.bundle.js',
    onProgress: (p) => {
      document.title = p.stage + ' ' + Math.round(p.progress * 100) + '%';
    },
  });

  log('Render complete! Blob size: ' + result.blob.size);

  // Store blob globally for extraction
  window.__renderBlob = result.blob;
  document.title = 'DONE:' + result.blob.size;
} catch (err) {
  log('ERROR: ' + err.message);
  document.title = 'ERROR:' + err.message;
}
</script>
</body></html>
HTMLEOF

# Open in browser
agent-browser --session "parity-$TEST_NAME" open "http://localhost:${PORT}/${OUTPUT_DIR}/render-page.html" 2>&1 | tail -1

# Wait for render to complete (up to 2 minutes)
agent-browser --session "parity-$TEST_NAME" wait --fn "document.title.startsWith('DONE') || document.title.startsWith('ERROR')" --timeout 120000 2>&1 | tail -1

# Get title (contains result)
TITLE=$(agent-browser --session "parity-$TEST_NAME" get title 2>&1)
echo "[$TEST_NAME] Title: $TITLE"

if [[ "$TITLE" == ERROR* ]]; then
  echo "[$TEST_NAME] ✗ Render failed: $TITLE"
  agent-browser --session "parity-$TEST_NAME" close 2>&1 > /dev/null
  exit 1
fi

# Extract rendered video as base64 chunks and save to disk
echo "[$TEST_NAME] Extracting video blob..."
agent-browser --session "parity-$TEST_NAME" eval --stdin <<'EXTRACTEOF' > "$OUTPUT_DIR/client-render.b64"
(async () => {
  const blob = window.__renderBlob;
  if (!blob) return 'ERROR:no blob';
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let result = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    result += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
  }
  return btoa(result);
})()
EXTRACTEOF

# Close browser
agent-browser --session "parity-$TEST_NAME" close 2>&1 > /dev/null

# Decode base64 to MP4
if [[ ! -f "$OUTPUT_DIR/client-render.b64" ]]; then
  echo "[$TEST_NAME] ✗ Failed to extract video blob"
  exit 1
fi

# Strip quotes from the base64 output
sed -i '' 's/^"//;s/"$//' "$OUTPUT_DIR/client-render.b64" 2>/dev/null || sed -i 's/^"//;s/"$//' "$OUTPUT_DIR/client-render.b64"
base64 -d < "$OUTPUT_DIR/client-render.b64" > "$OUTPUT_DIR/client-render.mp4" 2>/dev/null || base64 --decode < "$OUTPUT_DIR/client-render.b64" > "$OUTPUT_DIR/client-render.mp4"

if [[ ! -f "$OUTPUT_DIR/client-render.mp4" ]] || [[ ! -s "$OUTPUT_DIR/client-render.mp4" ]]; then
  echo "[$TEST_NAME] ✗ Failed to decode video"
  exit 1
fi

FILE_SIZE=$(stat -f%z "$OUTPUT_DIR/client-render.mp4" 2>/dev/null || stat -c%s "$OUTPUT_DIR/client-render.mp4" 2>/dev/null)
echo "[$TEST_NAME] ✓ Rendered: ${FILE_SIZE} bytes"

# PSNR comparison against golden reference
GOLDEN="packages/producer/tests/$TEST_NAME/output/output.mp4"
if [[ ! -f "$GOLDEN" ]]; then
  GOLDEN="packages/producer/tests/$TEST_NAME/output/output.webm"
fi

if [[ ! -f "$GOLDEN" ]]; then
  echo "[$TEST_NAME] ⚠ No golden reference found, skipping PSNR"
  exit 0
fi

# Get video duration
DURATION=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUTPUT_DIR/client-render.mp4" 2>/dev/null | head -1)
echo "[$TEST_NAME] Duration: ${DURATION}s"

# Compare at 10 checkpoints
TOTAL_PSNR=0
FAILED=0
CHECKED=0
for i in $(seq 0 9); do
  TIME=$(echo "$DURATION * $i / 10" | bc -l 2>/dev/null || echo "0")
  PSNR_RAW=$(ffmpeg -ss "$TIME" -i "$OUTPUT_DIR/client-render.mp4" -ss "$TIME" -i "$GOLDEN" -frames:v 1 -lavfi "psnr=stats_file=/dev/null" -f null - 2>&1)
  PSNR=$(echo "$PSNR_RAW" | grep -o 'average:[0-9.]*\|average:inf' | sed 's/average://' | head -1)

  if [[ "$PSNR" == "inf" ]]; then
    PSNR=100
  fi

  PASS="✓"
  if (( $(echo "$PSNR < 25" | bc -l 2>/dev/null || echo 1) )); then
    PASS="✗"
    FAILED=$((FAILED + 1))
  fi

  echo "  ${PASS} checkpoint $i (t=${TIME}s): PSNR=${PSNR}dB"
  TOTAL_PSNR=$(echo "$TOTAL_PSNR + ${PSNR:-0}" | bc -l 2>/dev/null || echo "$TOTAL_PSNR")
  CHECKED=$((CHECKED + 1))
done

AVG_PSNR=$(echo "$TOTAL_PSNR / $CHECKED" | bc -l 2>/dev/null || echo "0")
echo ""
echo "[$TEST_NAME] Avg PSNR: ${AVG_PSNR}dB | Failed: ${FAILED}/${CHECKED}"
