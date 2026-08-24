#!/bin/sh
# Does the film play once when three quarters of it is on screen, and does the frame
# close around it as you scroll — and open again on the way back?
#
#   scripts/clip.sh
#   W=390 H=844 scripts/clip.sh        # the phone encode
set -e
PW=$(ls -d "$HOME"/.npm/_npx/*/node_modules/playwright | head -1)
PW_BASE="$(dirname "$(dirname "$PW")")/" exec node "$(dirname "$0")/clip.mjs"
