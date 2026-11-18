# WRECKLIGHT

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/arunprasad2415/wrecklight/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/arunprasad2415/wrecklight/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

A descent through the drowned lighthouse. Top-down arena roguelite, plain ES modules on one
1280x800 canvas, no build step, no network, no assets: every shape is canvas geometry and every
sound is synthesised with WebAudio at runtime.

You are the last lamplighter. Three floors, three rooms and a boss on each. Between rooms you
draft one of three upgrades from a pool of eighteen. Each boss drops a relic. Clear the third
floor's keeper and the tower burns again.

## Play

```
cd game
python3 -m http.server 8000
```

Then open `index.html` on that server.

| input | action |
|---|---|
| W A S D / arrows | move |
| mouse | aim |
| hold left mouse | lantern beam: continuous damage, builds heat, overheats at 100 |
| right mouse / E | flare: clears enemy shots in a radius, charged by kills |
| space | dash, brief invulnerability, charges shown as rings |
| P / Esc | pause |
| R | restart from the results screen |
| Enter / click | start from the title screen |

## The descent

| floor | name | keepers |
|---|---|---|
| 1 | The Kelp Stair | Drifter, Sporeling, Anemone — boss: The Kelp Choir |
| 2 | The Rust Chapel | Bellhusk, Cinderling, Chainwarden — boss: The Bell Warden |
| 3 | The Blind Deep | Echo, Maw, Warden — boss: The Blind Lamp |

Every creature winds up visibly before it can hurt you: a swelling body and a closing ring.
Every boss has three attacks and breaks phase at 60% and 30% health.

## Layout

```
main.ts                    the hand-in program: copies game/ and screenshots/, writes dossier.json
game/index.html            the page: one canvas, one module script
game/src/main.js           boot, the frame loop, the run state machine
game/src/config.js         every tuning constant, the three palettes, the enemy table
game/src/random.js         seeded rng and geometry helpers
game/src/audio.js          WebAudio synthesis, one function per sound
game/src/input.js          keyboard, mouse, edge-triggered presses
game/src/run.js            run state: floor, room, score, combo, build, relics
game/src/entities/         player, enemies, bosses, projectiles, particles
game/src/systems/          combat, rooms, upgrades, relics
game/src/render/           backdrop, actors, fx
game/src/ui/               hud, screens, draft
game/src/shots.js          ?shot=title|play|draft|results&seed=N renders one exact frame
tools/                     the playwright probes used to verify and capture the screenshots
```

## Screenshots

`screenshots/` holds four real renders produced through `?shot=`: `1-play.jpg` (the cover, a boss
fight on floor 2), `2-title.jpg`, `3-draft.jpg`, `4-results.jpg`. Reproduce them with
`tools/capture.py` against a local server.

## Build the hand-in

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`out/dossier.json` is written by `buildDossier` from `vendor/makefun-game.ts`, which is the kit's
copy, unchanged.

MIT licensed; see `LICENSE`.
