# Keeping the repository free of personal data

**Name:** publish check

**Description:** this repository is public and holds only the app. Three
layers keep instance data out: the runtime never writes here
([INSTANCE.md](INSTANCE.md)), `kb_promote` refuses skills that hold names or
coordinates, and `scripts/check-publish.mjs` scans tracked or staged files
before every commit and in CI.

**When to use:** it runs by itself. `npm ci` installs the pre-commit hook
(`.githooks/pre-commit`, through `npm prepare`); CI runs `npm run
check:publish` on every push and pull request. Run it by hand before a pull
request that adds skills or docs.

## What it refuses

| Kind | Rule |
|---|---|
| Paths | `knowledge/episodes/`, `knowledge/worlds/`, evidence and deprecated skills under `knowledge/learned/`, a `crew.json` or `augi.config.json` outside `templates/`, server, voice, recordings and instance folders, `.env`, `.codex/`, `docs/film/`, recordings, replays, logs and keys |
| Content | home-directory paths (`/Users/<x>/`, `/home/<x>/`, `C:\Users\<x>\`), API keys and tokens, private keys |
| Coordinates | world coordinates in docs, role files, templates and the starter pack: three numbers separated by commas, an `x: … y: … z: …` group, or an x and z pair or range, where x or z is 100 or more. Tests and code are exempt, and so are the third-party Voyager seeds. |
| People | every name in your instance's `crew.json` (`voice.players`, `people`, workers' `player`), also without its trailing digits, when `AUGI_HOME` has one. The public repository never holds the list; your instance does, and the check reads it there. Placeholder names such as `Player1` are allowed. |

The MAP.md template in `knowledge/core/` is allowed only while its generated
section is empty.

## What is shareable

Skills and helper programs that hold in any world. `kb_promote` only moves a
skill to `learned/validated/` when it holds no world coordinates (x and z
with or without y, one of them 100 or more), no name from `crew.json` and no
home path; `kb_save_skill` warns at save time so the agent can fix it before
promotion. A test (`test/home.test.js`) runs the same scan over the starter
pack in this repo (`validated/` and `candidates/`) and checks that evidence
lists hold only dates, not episode names.

The check only knows the names your own `crew.json` lists. A first name, a
nickname or a pet's name that is not there passes: read what you share.

To contribute what your bots learned: copy files from
`$AUGI_HOME/knowledge/learned/validated/` into `knowledge/learned/validated/`,
cut each `evidence` episode id down to its date and time
(`2026-10-17-17-55-59`), run `npm test` and `npm run check:publish`, and open
a pull request.

## If something slipped through

Remove it in a new commit, then rewrite history before the next push if the
data is sensitive (`git filter-repo` on the file path). Rotate any key that was
exposed; removing it from history is not enough once it was pushed.
