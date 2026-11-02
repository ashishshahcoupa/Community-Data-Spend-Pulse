#!/bin/sh
# Make a dated version the new default:
#   sh scripts/promote.sh 2026-11-02
# The outgoing default is archived first as v/<its date>/ (unless it already
# is), so nothing is lost; then v/<date>/'s app is copied to the site root and
# versions.json records it as the default. The version's own folder stays, so
# its link keeps working. Run from the repo root.
set -e
cd "$(dirname "$0")/.."
DATE="$1"
[ -d "v/$DATE" ] || { echo "no v/$DATE to promote"; exit 1; }
OLD=$(ruby -rjson -e 'puts JSON.parse(File.read("versions.json"))["default"]["date"]')
OLDNOTE=$(ruby -rjson -e 'puts JSON.parse(File.read("versions.json"))["default"]["note"]')
if [ "$OLD" != "$DATE" ] && [ ! -e "v/$OLD" ]; then
  mkdir -p "v/$OLD"
  cp index.html app.js styles.css "v/$OLD/"
  cp -R assets "v/$OLD/"
  [ -d navi ] && cp -R navi "v/$OLD/"
fi
cp "v/$DATE/index.html" "v/$DATE/app.js" "v/$DATE/styles.css" .
rm -rf assets && cp -R "v/$DATE/assets" assets
[ -d "v/$DATE/navi" ] && { rm -rf navi; cp -R "v/$DATE/navi" navi; }
# The version badge is for the dated copies only; the default carries none.
ruby -e 'f = "index.html"; s = File.read(f); s.sub!(/\n?<!-- version-badge -->.*?<!-- \/version-badge -->\n?/m, "\n"); File.write(f, s)'
ruby -rjson -e '
  f = "versions.json"; v = JSON.parse(File.read(f)); new = ARGV[0]; old = ARGV[1]; oldnote = ARGV[2]
  note = (v["versions"].find { |x| x["date"] == new } || {})["note"].to_s
  if old != new && v["versions"].none? { |x| x["date"] == old }
    v["versions"] << { "date" => old, "note" => oldnote }
  end
  v["default"] = { "date" => new, "note" => note }
  File.write(f, JSON.pretty_generate(v) + "\n")' "$DATE" "$OLD" "$OLDNOTE"
echo "v/$DATE is now the default; the previous default is kept as v/$OLD"
