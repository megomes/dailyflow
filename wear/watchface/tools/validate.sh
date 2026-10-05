#!/bin/sh
# Regenerates and validates the face with Google's validator (gh release download release -R google/watchface -p wff-validator.jar).
cd "$(dirname "$0")/.." && node tools/generate.mjs >/dev/null && java -jar "${WFF_VALIDATOR:-$TEMP/wff-validator.jar}" 4 "$(cygpath -w "$PWD/src/main/res/raw/watchface.xml" 2>/dev/null || echo "$PWD/src/main/res/raw/watchface.xml")" 2>&1 | grep -v "^INFO: WFF"
