#!/bin/sh
# What do the two wind tunnels actually settle at, and is the airflow ratio still the
# porosity ratio? See scripts/air.mjs.
#
#   scripts/air.sh
set -e
cd "$(dirname "$0")/.."
# The model is TypeScript and shared with the page — compiling the one file is what keeps
# the harness measuring the thing that ships rather than a copy of it that can drift.
# `--typeRoots` at a path with nothing in it, because a stray `@types/*` in an ancestor
# `node_modules` is otherwise ambient here in a way it never is under the project's own
# tsconfig — `node` and `dom-webcodecs` both turn up and neither compiles against
# `--lib es2022`. The model imports nothing and touches no DOM, which is what makes that
# safe, and is the property worth keeping: a physics file that needs a browser to compile
# can't be checked without one.
npx tsc src/lib/air.ts --outDir .context/air --module esnext --target es2022 \
  --moduleResolution bundler --strict --lib es2022 --typeRoots .context/air/none
exec node scripts/air.mjs
