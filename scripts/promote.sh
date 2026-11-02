#!/bin/sh
# Make a version the new default:
#   sh scripts/promote.sh 2026-11-02
#   sh scripts/promote.sh r48
# The outgoing default is archived first as v/<its id or date>/ (unless it
# already is), so nothing is lost; then v/<id>/'s app is copied to the site
# root and versions.json records it as the default. The version's own folder
# stays, so its link keeps working. Run from the repo root.
set -e
cd "$(dirname "$0")/.."
ID="$1"
[ -d "v/$ID" ] || { echo "no v/$ID to promote"; exit 1; }
OLD=$(ruby -rjson -e 'd = JSON.parse(File.read("versions.json"))["default"]; puts d["id"] || d["date"]')
if [ "$OLD" != "$ID" ] && [ ! -e "v/$OLD" ]; then
  mkdir -p "v/$OLD"
  cp index.html app.js styles.css "v/$OLD/"
  cp -R assets "v/$OLD/"
  [ -d navi ] && cp -R navi "v/$OLD/"
fi
cp "v/$ID/index.html" "v/$ID/app.js" "v/$ID/styles.css" .
rm -rf assets && cp -R "v/$ID/assets" assets
if [ -d "v/$ID/navi" ]; then rm -rf navi; cp -R "v/$ID/navi" navi; else rm -rf navi; fi
# The version badge is for the copies under v/ only; the default carries none.
ruby -e 'f = "index.html"; s = File.read(f); s.sub!(/\n?<!-- version-badge -->.*?<!-- \/version-badge -->\n?/m, "\n"); File.write(f, s)'
ruby -rjson -e '
  f = "versions.json"; v = JSON.parse(File.read(f)); new, old = ARGV
  key = ->(x) { x["id"] || x["date"] }
  if old != new && v["versions"].none? { |x| key[x] == old }
    v["versions"] << { "id" => old }.merge(v["default"].reject { |k, _| k == "id" })
  end
  v["default"] = { "id" => new }.merge((v["versions"].find { |x| key[x] == new } || {}).reject { |k, _| k == "id" })
  File.write(f, JSON.pretty_generate(v) + "\n")' "$ID" "$OLD"
echo "v/$ID is now the default; the previous default is kept as v/$OLD"
