#!/bin/sh
# Regenerates the Navi script embedded in index.html from navi/spend-pulse.yaml:
# validates every `next` / `auto_next`, flags unreachable nodes, and writes the
# JSON into the <script id="navi-script-data"> block. Run from the repo root:
#   sh navi/build.sh
set -e
cd "$(dirname "$0")/.."
ruby -ryaml -rjson -e '
s = YAML.load_file("navi/spend-pulse.yaml")
nodes = s["nodes"] || {}; errs = []
chk = ->(list, where) { (list || []).each { |c| errs << "#{where}: chip #{c["id"]} -> #{c["next"]}" if c["next"] && !nodes.key?(c["next"]) } }
chk.(s["entry_chips"], "entry_chips")
(s["intents"] || []).each { |i| errs << "intent #{i["id"]} -> #{i["next"]}" unless nodes.key?(i["next"]) }
nodes.each { |id, n| chk.(n["chips"], id); errs << "#{id}: auto_next -> #{n["auto_next"]}" if n["auto_next"] && !nodes.key?(n["auto_next"]) }
abort("Broken references:\n  " + errs.join("\n  ")) unless errs.empty?
seen = {}; q = (s["entry_chips"] + (s["intents"] || [])).map { |c| c["next"] }
while (id = q.shift); next if seen[id] || !nodes[id]; seen[id] = 1; n = nodes[id]
  (n["chips"] || []).each { |c| q << c["next"] if c["next"] }; q << n["auto_next"] if n["auto_next"]; end
orph = nodes.keys - seen.keys
warn "Unreachable nodes: #{orph.join(", ")}" unless orph.empty?
json = JSON.generate(s).gsub("</", "<\\/")
html = File.read("index.html")
re = /(<script id="navi-script-data" type="application\/json">).*?(<\/script>)/m
abort("navi-script-data block not found in index.html") unless html =~ re
File.write("index.html", html.sub(re) { "#{$1}#{json}#{$2}" })
puts "navi: #{nodes.size} nodes, #{s["entry_chips"].size} entry chips, #{(s["intents"] || []).size} intents written to index.html"'
