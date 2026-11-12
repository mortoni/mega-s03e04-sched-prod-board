#!/usr/bin/env bash
# build.sh <app dir> <sha> <recordings dir or ""> <out dir>: the deployable site, stamped with its build (R6).
set -euo pipefail
src=$1; sha=$2; rec=${3:-}; out=$4
rm -rf "$out"; mkdir -p "$out"
cp -R "$src"/. "$out"/
grep -q '__BUILD_SHA__' "$out/index.html"
sed -i "s/__BUILD_SHA__/$sha/g" "$out/index.html"
if [ -n "$rec" ] && [ -d "$rec/rec" ]; then mkdir -p "$out/rec"; cp "$rec"/rec/*.mp4 "$out/rec/" 2>/dev/null || true; fi
echo "built $out at $sha"; ls -R "$out" | head -40
