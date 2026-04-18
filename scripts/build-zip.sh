#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

VERSION=$(node -p "require('./manifest.json').version")
OUT_DIR="dist"
ZIP_NAME="cheapest-read-${VERSION}.zip"

RUNTIME_FILES=(
  manifest.json
  background.js
  content.js
  offers-content.js
  popup.html
  popup.js
)

for f in "${RUNTIME_FILES[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "build-zip: missing required file '$f'" >&2
    exit 1
  fi
done

mkdir -p "$OUT_DIR"
rm -f "$OUT_DIR/$ZIP_NAME"

zip -q "$OUT_DIR/$ZIP_NAME" "${RUNTIME_FILES[@]}"

echo "built $OUT_DIR/$ZIP_NAME"
unzip -l "$OUT_DIR/$ZIP_NAME"
