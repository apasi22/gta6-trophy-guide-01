// GTA VI trophy guide entry (Node 22, standard library only).
// The guide is this directory's app/ folder: plain static files a browser
// opens at app/index.html, offline, loading nothing over the network.
// The program hands the guide in: it copies app/ and screenshots/ from
// beside this file to the output directory and writes dossier.json there,
// the summary the judge reads (the screenshots, the first load's files
// and bytes, and the source), with the vendored make.fun library.
// The output directory is /output in the grader; outside it,
// MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

// Build the dossier from this repository (its app/ and screenshots/).
// The caps are the competition's: text 160 KiB, at most 4 screenshots of
// at most 256 KiB each, app/ at most 993 files and 48 MiB, paths at most
// 1,000 bytes. buildDossier throws if the app tree breaks any of them.
const dossier = buildDossier(repoRoot, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 256 * 1024 },
  app_max_files: 993,
  app_max_bytes: 48 * 1024 * 1024,
  app_path_max_bytes: 1000,
});

// Write a fresh output directory: app/, screenshots/, dossier.json.
// Never rmSync(outDir) itself: in the grader /output is a root-owned mount
// the sandbox user (65534) cannot delete (EACCES). The output directory is
// always fresh there; mkdirSync + cpSync (overwrite) is enough.
mkdirSync(outDir, { recursive: true });
cpSync(join(repoRoot, 'app'), join(outDir, 'app'), { recursive: true });
cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
writeFileSync(join(outDir, 'dossier.json'), dossier);

console.log(`wrote ${outDir} (dossier ${dossier.length} bytes)`);
