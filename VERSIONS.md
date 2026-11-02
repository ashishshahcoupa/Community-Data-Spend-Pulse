# Prototype versions

The site root is the **default** — what https://spendpulse-alpha.vercel.app opens on.
Every other version is a copy under `v/<id>/`, with its own link. The id is a
date or a short name:

| Version | Link | Source |
|---|---|---|
| Default (Oct 19, 2026) | `/#/landing` | site root |
| Nov 2, 2026 | `/v/2026-11-02/#/landing` | edited in place |
| R48 updates | `/v/r48/#/landing` | copied from the `jitin-updates` branch |

`versions.html` lists them all (read from `versions.json`; a named version has a
`label` as well as its `id`).

## Start a new version

    sh scripts/new-version.sh 2026-11-09 "What changes in this version"
    LABEL="R49 updates" sh scripts/new-version.sh r49 "What changes"
    FROM=r48 sh scripts/new-version.sh 2026-11-16 "What changes"

Copies the default's app (or `v/<FROM>/`'s) into `v/<id>/` and lists it on the
versions page. Make the changes inside that folder; the default is left alone.
Add the version badge to its `index.html` (copy the `version-badge` block from
an earlier version and change its text).

## Update R48 from jitin-updates

`v/r48/` is a copy of `jitin-updates`, which stays the source. After changing
that branch, copy `index.html`, `app.js`, `styles.css`, `assets/` and `navi/`
into `v/r48/` again and put the badge back before `</body>`.

## Make a version the default

    sh scripts/promote.sh 2026-11-02
    sh scripts/promote.sh r48

Archives the current default as `v/<its id or date>/` first (so its link keeps
working), copies the version's app to the root without its badge, and records
it as the default in `versions.json`. The version's own folder stays.

Both scripts need Ruby, which macOS ships with. Run them from the repo root.
