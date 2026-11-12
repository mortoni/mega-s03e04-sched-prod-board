#!/usr/bin/env bash
# smoke.sh <live url> <sha> [video path...]: the live board names this build; listed videos are served.
set -uo pipefail
live=$1; sha=$2; shift 2; fail=0
for i in $(seq 1 20); do
  got=$(curl -fsS "$live/?v=$RANDOM" | sed -n 's/.*<meta name="build" content="\([^"]*\)".*/\1/p')
  [ "$got" = "$sha" ] && break; sleep 3
done
echo "live build: ${got:-none} (want $sha)"; [ "$got" = "$sha" ] || fail=1
for v in "$@"; do
  h=$(curl -fsSI "$live/$v" | tr -d '\r' | grep -iE '^(HTTP|content-type|content-length)' | tr '\n' ' ')
  echo "video $v: $h"; echo "$h" | grep -q ' 200' || fail=1
done
exit $fail
