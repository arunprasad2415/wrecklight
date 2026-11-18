// WRECKLIGHT's hand-in program (Node 22, standard library only). The game itself is this
// repository's game/ folder: plain static files a desktop browser loads offline, with no
// library and no network request. This program copies game/ and screenshots/ to the output
// directory and writes dossier.json with the vendored make.fun library.
//
// Serve the game locally with `python3 -m http.server` inside game/, then open index.html.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's own caps, passed straight through to buildDossier: text_max_bytes bounds the
// dossier's source text; the rest only refuse an entry the scorer would refuse (more than 4
// screenshots or one over 256 KiB; more than 993 entries or 48 MiB under game/, or a path there
// over 1000 bytes, since game/ counts alongside /output's own 1000-entry cap).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

console.log(`WRECKLIGHT handed in at ${out}`);
