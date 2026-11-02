#!/bin/sh
# Start a dated version from the current default:
#   sh scripts/new-version.sh 2026-11-09 "What changes in this version"
# Copies the site root's app (index.html, app.js, styles.css, assets/) into
# v/<date>/ and lists it on versions.html. Edit v/<date>/ from there; the
# default (the site root) is left alone. Run from the repo root.
set -e
cd "$(dirname "$0")/.."
DATE="$1"; NOTE="$2"
case "$DATE" in ????-??-??) ;; *) echo "usage: sh scripts/new-version.sh YYYY-MM-DD \"note\""; exit 1;; esac
[ -e "v/$DATE" ] && { echo "v/$DATE already exists"; exit 1; }
mkdir -p "v/$DATE"
cp index.html app.js styles.css "v/$DATE/"
cp -R assets "v/$DATE/"
[ -d navi ] && cp -R navi "v/$DATE/"
ruby -rjson -e '
  f = "versions.json"; v = JSON.parse(File.read(f))
  v["versions"].reject! { |x| x["date"] == ARGV[0] }
  v["versions"] << { "date" => ARGV[0], "note" => ARGV[1].to_s }
  File.write(f, JSON.pretty_generate(v) + "\n")' "$DATE" "$NOTE"
echo "v/$DATE created from the default and listed on versions.html"
