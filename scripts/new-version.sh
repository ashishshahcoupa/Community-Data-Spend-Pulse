#!/bin/sh
# Start a version, from the current default or from another version:
#   sh scripts/new-version.sh 2026-11-09 "What changes in this version"
#   LABEL="R49 updates" sh scripts/new-version.sh r49 "What changes"
#   FROM=r48 sh scripts/new-version.sh 2026-11-16 "What changes"
# The id is the folder, v/<id>/: a date (YYYY-MM-DD) or a short name (r48).
# A named version takes LABEL as what versions.html calls it, and DATE
# (default: today) as its date. Copies the app (index.html, app.js,
# styles.css, assets/, navi/) and lists it on versions.html. Edit v/<id>/
# from there; the default (the site root) is left alone. Run from the repo root.
set -e
cd "$(dirname "$0")/.."
ID="$1"; NOTE="$2"
case "$ID" in ''|*/*|*' '*) echo "usage: [LABEL=..] [FROM=<id>] sh scripts/new-version.sh <date or name> \"note\""; exit 1;; esac
case "$ID" in ????-??-??) DATE="${DATE:-$ID}";; *) DATE="${DATE:-$(date +%F)}";; esac
SRC=.; [ -n "$FROM" ] && SRC="v/$FROM"
[ -f "$SRC/index.html" ] || { echo "no $SRC to copy from"; exit 1; }
[ -e "v/$ID" ] && { echo "v/$ID already exists"; exit 1; }
mkdir -p "v/$ID"
cp "$SRC/index.html" "$SRC/app.js" "$SRC/styles.css" "v/$ID/"
cp -R "$SRC/assets" "v/$ID/"
[ -d "$SRC/navi" ] && cp -R "$SRC/navi" "v/$ID/"
# The badge is re-added by hand with the new name; a copied one would be stale.
ruby -e 'f = ARGV[0]; s = File.read(f); s.sub!(/\n?<!-- version-badge -->.*?<!-- \/version-badge -->\n?/m, "\n"); File.write(f, s)' "v/$ID/index.html"
ruby -rjson -e '
  f = "versions.json"; v = JSON.parse(File.read(f)); id, note, date, label = ARGV
  v["versions"].reject! { |x| (x["id"] || x["date"]) == id }
  e = { "id" => id }; e["label"] = label unless label.to_s.empty?
  e["date"] = date; e["note"] = note.to_s
  v["versions"] << e
  File.write(f, JSON.pretty_generate(v) + "\n")' "$ID" "$NOTE" "$DATE" "$LABEL"
echo "v/$ID created from $SRC and listed on versions.html; add its version badge before </body>"
