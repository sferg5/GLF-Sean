#!/bin/sh
# Does every column of the reel paint, and does the room change? Reads the pixels,
# because the failure it exists for reports nothing.
#
#   scripts/reel.sh
#   W=390 H=844 scripts/reel.sh              # the three-column form
#   STEPS=0,0.5,1 scripts/reel.sh
#   KEEP=/tmp/reel scripts/reel.sh           # keep the screenshots it sampled
set -e
PW=$(ls -d "$HOME"/.npm/_npx/*/node_modules/playwright | head -1)
PW_BASE="$(dirname "$(dirname "$PW")")/" exec node "$(dirname "$0")/reel.mjs"
