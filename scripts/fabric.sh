#!/bin/sh
# Do the two channels draw, and are the figures on screen the fields' own? See
# scripts/fabric.mjs. The physics itself is scripts/air.sh, which needs no browser.
#
#   scripts/fabric.sh
#   REDUCED=1 scripts/fabric.sh
#   W=390 H=844 scripts/fabric.sh       # the one-column form
set -e
PW=$(ls -d "$HOME"/.npm/_npx/*/node_modules/playwright | head -1)
PW_BASE="$(dirname "$(dirname "$PW")")/" exec node "$(dirname "$0")/fabric.mjs"
