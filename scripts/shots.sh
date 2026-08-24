#!/bin/sh
# Screenshot the variants. Playwright comes from the npx cache so the prototype's
# own dependency list stays short.
#
#   scripts/shots.sh                                  all 5, five frames each
#   VARIANTS=3 STEPS=0,0.2,0.4,0.6,0.8,1 scripts/shots.sh
#   EXTRA='&diff=1&gain=4' SUFFIX=-diff scripts/shots.sh    registration check
#   REDUCED=1 SUFFIX=-reduced scripts/shots.sh
set -e
PW=$(ls -d "$HOME"/.npm/_npx/*/node_modules/playwright | head -1)
PW_BASE="$(dirname "$(dirname "$PW")")/" exec node "$(dirname "$0")/shots.mjs"
