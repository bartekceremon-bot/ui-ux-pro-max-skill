#!/usr/bin/env bash
# Builds a signed Android APK locally.
#
# Requirements:
#   - Godot 4.4 on PATH as `godot` (or set GODOT=/path/to/godot)
#   - Android export templates installed for the same Godot version
#   - Android SDK with platform-tools and build-tools, path set in the Godot
#     editor settings (Editor > Editor Settings > Export > Android)
#
# Usage:
#   tools/build_android.sh              # debug APK, debug keystore
#   tools/build_android.sh release      # release APK, needs the env vars below:
#       GODOT_ANDROID_KEYSTORE_RELEASE_PATH
#       GODOT_ANDROID_KEYSTORE_RELEASE_USER
#       GODOT_ANDROID_KEYSTORE_RELEASE_PASSWORD

set -euo pipefail

GODOT="${GODOT:-godot}"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="${1:-debug}"
OUT="build/PrismRun.apk"

cd "$PROJECT_DIR"
mkdir -p build

echo "==> Importing resources"
"$GODOT" --headless --path . --import

echo "==> Running the gameplay smoke test"
"$GODOT" --headless --path . tests/smoke.tscn

echo "==> Exporting ($MODE)"
if [ "$MODE" = "release" ]; then
	"$GODOT" --headless --path . --export-release "Android" "$OUT"
else
	"$GODOT" --headless --path . --export-debug "Android" "$OUT"
fi

echo "==> Done: $PROJECT_DIR/$OUT"
ls -lh "$OUT"
