#!/bin/bash
SONIC_PI_ROOT="${SONIC_PI_PATH:-$(dirname "$0")/../../sonic-pi}"
DEST="$(dirname "$0")/../media/tutorial"

mkdir -p "$DEST/images"
cp "$SONIC_PI_ROOT/etc/doc/tutorial/"*.md "$DEST/"
cp -r "$SONIC_PI_ROOT/etc/doc/images/tutorial/"* "$DEST/images/" 2>/dev/null || true

echo "Copied tutorial content to $DEST"
ls "$DEST/"*.md | wc -l | xargs echo "Chapters:"
ls "$DEST/images/" 2>/dev/null | wc -l | xargs echo "Images:"
