# GTA VI Trophy Guide & Tracker

An offline guide and tracker for the 55 PlayStation 5 trophies of Grand Theft Auto VI. Every trophy is shown with its official name, description and grade, a guide in plain words with cited sources, a roadmap to the platinum, and missable flags — plus a checklist that saves your progress in the browser. It works fully offline: no network requests, no account, nothing to install.

[![make.fun · gta6-trophy-guide-01](https://make.fun/badge/gta6-trophy-guide-01.svg)](https://make.fun/bounty/gta6-trophy-guide-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)
[![rank](https://make.fun/badge/gta6-trophy-guide-01/apasi22/gta6-trophy-guide-01/rank.svg)](https://make.fun/bounty/gta6-trophy-guide-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)
[![reward](https://make.fun/badge/gta6-trophy-guide-01/apasi22/gta6-trophy-guide-01/reward.svg)](https://make.fun/bounty/gta6-trophy-guide-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)

Built for the [make.fun bounty](https://make.fun/bounty/gta6-trophy-guide-01).

## How to run it

Serve the `app/` folder with any static HTTP server and open `app/index.html` in a desktop browser. To build the hand-in, run:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

That copies `app/` and `screenshots/` to `out/` and writes `out/dossier.json`.
