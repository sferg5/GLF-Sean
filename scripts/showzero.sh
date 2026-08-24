#!/bin/sh
# The show-zero hero: scroll equals scrub, and specimen b stays clean.
#
#   scripts/showzero.sh
set -e
PW=$(ls -d "$HOME"/.npm/_npx/*/node_modules/playwright | head -1)
PW_BASE="$(dirname "$(dirname "$PW")")/" exec node "$(dirname "$0")/showzero.mjs"
