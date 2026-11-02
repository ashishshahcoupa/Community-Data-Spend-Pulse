# Prototype versions

The site root is the **default** — what https://spendpulse-alpha.vercel.app opens on.
Every dated version is a frozen copy under `v/<date>/`, with its own link:
`https://spendpulse-alpha.vercel.app/v/2026-11-02/#/landing`.
`versions.html` lists them all (read from `versions.json`).

## Start a new version

    sh scripts/new-version.sh 2026-11-09 "What changes in this version"

Copies the default's app into `v/2026-11-09/` and lists it on the versions page.
Make the changes inside that folder; the default is left alone. Add the version
badge to its `index.html` (copy the `version-badge` block from an earlier version).

## Make a version the default

    sh scripts/promote.sh 2026-11-02

Archives the current default as `v/<its date>/` first (so its link keeps
working), copies the version's app to the root without its badge, and records
it as the default in `versions.json`. The version's own folder stays.

Both scripts need Ruby, which macOS ships with. Run them from the repo root.
