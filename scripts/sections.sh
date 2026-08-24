#!/bin/sh
# Does the page reorder, and do the two text sections do what they claim?
#
#   scripts/sections.sh
#   W=390 H=844 scripts/sections.sh     # the one-column form
set -e
PW=$(ls -d "$HOME"/.npm/_npx/*/node_modules/playwright | head -1)
PW_BASE="$(dirname "$(dirname "$PW")")/" exec node "$(dirname "$0")/sections.mjs"
