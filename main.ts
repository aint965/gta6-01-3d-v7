// Palkon Auto's deterministic, offline Node 22 submission entrypoint.
// Stage F packages the title cover, city drive, operation and moonlit pursuit.

import { cpSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const maxCaptureBytes = 256 * 1024;
const submittedViews = [
  '1-title.jpg',
  '2-driving-day.jpg',
  '3-mission.jpg',
  '4-night-pursuit.jpg',
];

// Refuse an incomplete capture set before producing a partial submission.
for (const name of submittedViews) {
  const capture = statSync(join(here, 'screenshots', name));
  if (!capture.isFile() || capture.size > maxCaptureBytes) throw new Error(`Invalid competition capture: ${name}`);
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
for (const name of submittedViews) {
  cpSync(join(here, 'screenshots', name), join(out, 'screenshots', name));
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
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
