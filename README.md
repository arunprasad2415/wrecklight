# WRECKLIGHT

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/arunprasad2415/wrecklight/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/arunprasad2415/wrecklight/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

A descent through the drowned lighthouse. Top-down arena roguelite, plain ES modules on one
1280x800 canvas, no build step, no network, no assets: every shape is canvas geometry and every
sound is synthesised with WebAudio at runtime.

You are the last lamplighter. Three floors, three rooms and a keeper on each. Between rooms you
draft one of three upgrades from a pool of twenty-six. Every kill drops salvage, every keeper
drops a relic, and after each keeper a salvage table opens before two doors: an elite room that
pays more, or a rest room that heals. Clear the third floor's keeper and the tower burns again.

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
| 1 2 3 | take a draft card, or buy from the salvage table |
| 1 / 2 | choose a door after a keeper |
| P / Esc | pause |
| R | restart from the results screen |
| Enter / click | start from the title screen |

## The descent

| floor | name | creatures | keeper |
|---|---|---|---|
| 1 | The Kelp Stair | Drifter, Sporeling, Anemone, Gloomfin | The Kelp Choir |
| 2 | The Rust Chapel | Bellhusk, Cinderling, Chainwarden, Slaghand | The Bell Warden |
| 3 | The Blind Deep | Echo, Maw, Warden, Voidgazer | The Blind Lamp |

Every creature winds up visibly before it can hurt you: a swelling body and a closing ring.
Every keeper has three attacks and breaks phase at 60% and 30% health, with a hitstop on the
break.

The route is fixed and always visible: three fights, a keeper, then a shop between floors. The
route strip is drawn on the draft screen, the salvage table and the results screen, so the shape
of the whole run reads at a glance.

## Systems

- **Draft.** Twenty-six upgrades across three rarities, three offered after every fight room.
  Chain lightning on hit, orbiting wisps that fire, a beam that forks in two, a dash that leaves
  a burning trail, kills that chill everything nearby, a flare that blinds, an overheat that
  vents a shockwave, and a lodestone that pulls embers and salvage in from anywhere.
- **Salvage.** Kills drop scrap tags. Salvage buys from the table between floors and carries
  over, so a quiet room is never wasted.
- **Relics.** Six in the pool, one per keeper, each with a drawn icon beside the hull pips.
- **Feel.** 40ms hitstop on every kill, 90ms on a keeper's phase break, chromatic split and
  screen shake when the lamplighter is hit, a red vignette that pulses at two hull or less,
  crits in a bigger accent-coloured number, and a ROOM CLEAR banner with the room and what it
  paid.

## Layout

```
main.ts                    the hand-in program: copies game/ and screenshots/, writes dossier.json
game/index.html            the page: one canvas, one module script
game/src/main.js           boot, the frame loop, the run state machine
game/src/config.js         every tuning constant, the three palettes, the enemy table, shop prices
game/src/random.js         seeded rng and geometry helpers
game/src/audio.js          WebAudio synthesis, one function per sound
game/src/input.js          keyboard, mouse, edge-triggered presses
game/src/run.js            run state: floor, room, score, combo, build, relics, salvage, route
game/src/entities/         player, enemies, bosses, projectiles, particles
game/src/systems/          combat, rooms, upgrades, relics, shop
game/src/render/           backdrop, actors, fx
game/src/ui/               hud, screens, draft, shop, route
game/src/shots.js          ?shot=title|play|draft|results&seed=N renders one exact frame
tools/                     the playwright probes used to verify and capture the screenshots
```

## Screenshots

`screenshots/` holds four real renders produced through `?shot=`: `1-play.jpg` (the cover, a
keeper fight on floor 2), `2-title.jpg`, `3-draft.jpg`, `4-results.jpg`. Reproduce them with
`tools/capture.py` against a local server, then check them with `tools/verify_shots.py`.

## Verify

```
python3 -m http.server 8731 &        # inside game/
/root/pw-venv/bin/python tools/playtest.py     # real input, score, rooms, draft, card taken
/root/pw-venv/bin/python tools/flowtest.py     # the whole loop, through shop and route choice
/root/pw-venv/bin/python tools/featuretest.py  # every upgrade, relic, creature and screen
/root/pw-venv/bin/python tools/capture.py      # the four screenshots
python3 tools/verify_shots.py                  # dimensions, bytes, lit share, balance
```

## Build the hand-in

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`out/dossier.json` is written by `buildDossier` from `vendor/makefun-game.ts`, which is the kit's
copy, unchanged.

MIT licensed; see `LICENSE`.
