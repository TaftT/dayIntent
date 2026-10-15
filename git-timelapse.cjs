#!/usr/bin/env node
/**
 * git-timelapse.cjs
 *
 * Walks every commit on a ref (oldest -> newest), checks each one out in an
 * isolated git worktree, boots the Vite dev server, and screenshots MANY
 * surfaces of the app per commit (Day / Backlog / Stats / Home, desktop +
 * mobile, plus whatever modals it can open). Then writes a concat playlist and
 * prints an ffmpeg line to stitch the PNGs into an mp4.
 *
 * Only as granular as your history: N commits = N points in time. This just
 * maximizes how much of the app you see at each of those points.
 *
 * SETUP (once):
 *   npm install playwright
 *   npx playwright install chromium
 *
 * RUN (from the repo root):
 *   node git-timelapse.cjs
 *
 * Frames are re-used on re-run (delete timelapse-shots/ to start fresh).
 *
 * Windows notes:
 *  - git runs via execFileSync('git', [...args]) — never a shell string — so
 *    cmd.exe can't mangle quotes or treat "|" in --format as a pipe.
 *  - the dev server is `node node_modules/vite/bin/vite.js` (not `npm run
 *    dev`) so it's one node.exe tree we can kill with `taskkill /T /F`.
 *  - after each kill we poll until port 5173 is actually free — leftover
 *    esbuild/vite handles were what used to break the next `git checkout`.
 *  - vite runs with --strictPort so it fails loudly instead of drifting.
 */

const { execFileSync, spawn } = require('child_process');
const fs = require('fs');
const net = require('net');
const path = require('path');
const { chromium } = require('playwright');

// ==================== CONFIG ====================
const REPO_DIR = process.cwd();
const WORKTREE_DIR = path.resolve(REPO_DIR, '..', '.timelapse-worktree');
const OUTPUT_DIR = path.join(REPO_DIR, 'timelapse-shots');
const PORT = 5173;
const DEV_URL = `http://localhost:${PORT}`;
const VITE_BIN = path.join('node_modules', 'vite', 'bin', 'vite.js');
const BRANCH_OR_REF = 'HEAD';
const SERVER_TIMEOUT_MS = 60000;
const POLL_MS = 500;
const NAV_SETTLE_MS = 1800;        // wait after each in-app navigation before the shot
const NPM_INSTALL_TIMEOUT_MS = 300000;
const FRAME_SECONDS = 0.5;         // how long each frame is held in the video

// A fixed date so /day/:date resolves the same way at every commit. The DEV
// seed builds sample data relative to "now", so this day has content.
const DAY = new Date().toISOString().slice(0, 10);

const DEVICES = [
  { key: 'desktop', viewport: { width: 1440, height: 900 } },
  { key: 'mobile', viewport: { width: 390, height: 844 } },
];

// Routes to visit. `paths` lists candidates oldest-history-first so a commit
// whose route scheme differs still matches one of them.
const SURFACES = [
  { key: 'home', label: 'Home', paths: ['/'] },
  { key: 'day', label: 'Day view', paths: [`/day/${DAY}`, '/day', '/'] },
  { key: 'backlog', label: 'Backlog', paths: ['/backlog'] },
  { key: 'stats', label: 'Stats', paths: ['/stats'] },
];

// Best-effort modal captures on the desktop day view. Each tries a few
// selectors; if none open a dialog the frame is just skipped.
const MODALS = [
  { key: 'search', label: 'Search', selectors: ['[aria-label="Search" i]', 'button:has-text("Search")'] },
  { key: 'categories', label: 'Categories', selectors: ['[aria-label="Categories" i]', '[aria-label*="categor" i]', 'button:has-text("Categories")'] },
  { key: 'newitem', label: 'New item', selectors: ['[aria-label="Add item" i]', '[aria-label*="add" i]', 'button:has-text("Add")', 'button:has-text("New")', 'button:has-text("+")'] },
];
// ==================================================

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function git(args, cwd = REPO_DIR) {
  return execFileSync('git', args, { cwd, stdio: 'pipe', encoding: 'utf8' }).trim();
}
function tryGit(args, cwd = REPO_DIR, { verbose = false } = {}) {
  try {
    return git(args, cwd);
  } catch (e) {
    if (verbose) {
      const err = (e.stderr || e.stdout || e.message || '').toString().trim();
      console.warn(`    [git ${args.join(' ')}] failed:\n    ${err.replace(/\n/g, '\n    ')}`);
    }
    return null;
  }
}

function getCommits() {
  // \x1f = unit separator; safe against "|" / spaces in the subject.
  const log = git(['log', '--reverse', '--format=%H\x1f%ci\x1f%s', BRANCH_OR_REF]);
  return log.split('\n').filter(Boolean).map((line) => {
    const [hash, iso, message] = line.split('\x1f');
    return { hash, date: iso.slice(0, 10), message };
  });
}

// ---- ports -----------------------------------------------------------

function portFree(port) {
  return new Promise((resolve) => {
    const srv = net
      .createServer()
      .once('error', () => resolve(false))
      .once('listening', () => srv.close(() => resolve(true)))
      .listen(port, '127.0.0.1');
  });
}
async function waitForPortFree(port, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await portFree(port)) return true;
    await sleep(POLL_MS);
  }
  return false;
}
function killPidTree(pid) {
  if (!pid) return;
  try {
    if (process.platform === 'win32') execFileSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });
    else process.kill(-pid, 'SIGKILL');
  } catch { /* gone */ }
}
function killWhoeverIsOnPort(port) {
  if (process.platform !== 'win32') return;
  try {
    const out = execFileSync('netstat', ['-ano', '-p', 'tcp'], { encoding: 'utf8' });
    const pids = new Set();
    for (const line of out.split('\n')) {
      const m = line.match(new RegExp(`[:.]${port}\\s+.*LISTENING\\s+(\\d+)`));
      if (m) pids.add(m[1]);
    }
    for (const pid of pids) {
      console.log(`  freeing port ${port} (pid ${pid})`);
      killPidTree(pid);
    }
  } catch { /* nothing listening */ }
}

// ---- worktree ------------------------------------------------------

function setupWorktree() {
  tryGit(['worktree', 'remove', '--force', WORKTREE_DIR]);
  tryGit(['worktree', 'prune']);
  if (fs.existsSync(WORKTREE_DIR)) fs.rmSync(WORKTREE_DIR, { recursive: true, force: true });
  git(['worktree', 'add', '--force', '--detach', WORKTREE_DIR]);
}
function cleanupWorktree() {
  tryGit(['worktree', 'remove', '--force', WORKTREE_DIR]);
  tryGit(['worktree', 'prune']);
}

// ---- dev server ---------------------------------------------------

async function waitForServer(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return true;
    } catch { /* not up */ }
    await sleep(POLL_MS);
  }
  return false;
}
function startDevServer() {
  const viteInWorktree = path.join(WORKTREE_DIR, VITE_BIN);
  if (fs.existsSync(viteInWorktree)) {
    return spawn(process.execPath, [viteInWorktree, '--port', String(PORT), '--strictPort', '--clearScreen', 'false'], {
      cwd: WORKTREE_DIR, stdio: 'ignore', windowsHide: true,
    });
  }
  return spawn('npm', ['run', 'dev', '--', '--port', String(PORT), '--strictPort'], {
    cwd: WORKTREE_DIR, stdio: 'ignore', shell: process.platform === 'win32', windowsHide: true,
  });
}

// ---- capture helpers --------------------------------------------------

async function gotoFirst(page, paths) {
  for (const p of paths) {
    try {
      const res = await page.goto(DEV_URL + p, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForLoadState('load', { timeout: 8000 }).catch(() => {});
      await sleep(NAV_SETTLE_MS);
      // Treat a client-rendered 404 / redirect-to-root as "try the next path"
      // only if there are more candidates; otherwise take what we got.
      if (res && res.status() >= 500) continue;
      return p;
    } catch { /* try next */ }
  }
  return null;
}

// ---- main ---------------------------------------------------------

async function main() {
  const commits = getCommits();
  console.log(`Found ${commits.length} commits on ${BRANCH_OR_REF}.`);
  console.log(`Per commit: ${SURFACES.length} routes x ${DEVICES.length} devices + up to ${MODALS.length} modals.\n`);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  killWhoeverIsOnPort(PORT);
  setupWorktree();

  const browser = await chromium.launch();

  let lastLockHash = null;

  for (let ci = 0; ci < commits.length; ci++) {
    const c = commits[ci];
    const cnum = String(ci + 1).padStart(2, '0');
    const tag = `[${ci + 1}/${commits.length}] ${c.hash.slice(0, 7)}`;

    // Resume check. Route x device frames must all exist. Modal frames are
    // best-effort — a modal may not exist yet at an old commit — so we only
    // require that each modal has been *attempted*: either its .png or a
    // ".skip" marker written when it couldn't be opened. That way a missing
    // modal doesn't force a full re-run forever, but a genuinely new run
    // (or a new modal / new device) still gets tried.
    const has = (f) => fs.existsSync(path.join(OUTPUT_DIR, f));
    const routesDone = DEVICES.every((d) => SURFACES.every((s) => has(`c${cnum}_${s.key}_${d.key}.png`)));
    const modalsTried = DEVICES.every((d) =>
      MODALS.every((m) => has(`c${cnum}_${m.key}_${d.key}.png`) || has(`c${cnum}_${m.key}_${d.key}.skip`))
    );
    if (routesDone && modalsTried) {
      console.log(`${tag} ${c.message} — frames present, skipping`);
      continue;
    }

    console.log(`${tag} ${c.date}  ${c.message}`);
    if (tryGit(['checkout', '--force', '--detach', c.hash], WORKTREE_DIR, { verbose: true }) === null) {
      console.warn('  checkout failed, skipping commit\n');
      continue;
    }
    if (!fs.existsSync(path.join(WORKTREE_DIR, 'package.json'))) {
      console.warn('  no package.json here, skipping commit\n');
      continue;
    }

    const lockHash = tryGit(['hash-object', 'package-lock.json'], WORKTREE_DIR);
    if (lockHash !== lastLockHash) {
      console.log('  npm install...');
      try {
        execFileSync('npm', ['install', '--no-audit', '--no-fund', '--silent'], {
          cwd: WORKTREE_DIR, stdio: 'ignore', shell: process.platform === 'win32', timeout: NPM_INSTALL_TIMEOUT_MS,
        });
      } catch (e) {
        console.warn(`  npm install failed (${e.message}), skipping commit\n`);
        continue;
      }
      lastLockHash = lockHash;
    }
    fs.rmSync(path.join(WORKTREE_DIR, 'node_modules', '.vite'), { recursive: true, force: true });

    const server = startDevServer();
    let serverErr = null;
    server.on('error', (e) => { serverErr = e; });
    const up = await waitForServer(DEV_URL, SERVER_TIMEOUT_MS);
    if (!up) {
      console.warn(`  server never came up${serverErr ? ` (${serverErr.message})` : ''}, skipping commit\n`);
      killPidTree(server.pid);
      await waitForPortFree(PORT);
      continue;
    }

    // Fresh context per commit => clean IndexedDB => the DEV seed re-runs, so
    // every commit shows the same sample data instead of drifting.
    const context = await browser.newContext();
    const page = await context.newPage();

    let made = 0;
    for (const d of DEVICES) {
      await page.setViewportSize(d.viewport);

      for (const s of SURFACES) {
        const file = `c${cnum}_${s.key}_${d.key}.png`;
        const abs = path.join(OUTPUT_DIR, file);
        if (fs.existsSync(abs)) continue;
        const landed = await gotoFirst(page, s.paths);
        if (!landed) { console.warn(`  · ${s.key}/${d.key}: no route matched`); continue; }
        try {
          await page.screenshot({ path: abs, fullPage: d.key === 'desktop' && (s.key === 'backlog' || s.key === 'stats') });
          made++;
        } catch (e) {
          console.warn(`  · ${s.key}/${d.key} shot failed: ${e.message}`);
        }
      }

      // Modals (best effort), opened from the day view — on every device.
      for (const m of MODALS) {
        const file = `c${cnum}_${m.key}_${d.key}.png`;
        const abs = path.join(OUTPUT_DIR, file);
        const skip = abs.replace(/\.png$/, '.skip');
        if (fs.existsSync(abs) || fs.existsSync(skip)) continue;
        await gotoFirst(page, SURFACES.find((x) => x.key === 'day').paths);
        let opened = false;
        for (const sel of m.selectors) {
          try {
            await page.click(sel, { timeout: 1500 });
            await page.waitForSelector('.modal-overlay, [role="dialog"], .modal', { timeout: 2500 });
            opened = true;
            break;
          } catch { /* try next selector */ }
        }
        if (!opened) {
          console.warn(`  · ${m.key}/${d.key} modal: not found`);
          fs.writeFileSync(skip, ''); // don't retry on the next run
          continue;
        }
        await sleep(500);
        try {
          await page.screenshot({ path: abs });
          made++;
        } catch (e) {
          console.warn(`  · ${m.key} modal shot failed: ${e.message}`);
        }
        await page.keyboard.press('Escape').catch(() => {});
        await sleep(300);
      }
    }

    await context.close();
    console.log(`  ${made} new frame(s)\n`);

    killPidTree(server.pid);
    if (!(await waitForPortFree(PORT))) {
      console.warn(`  warning: port ${PORT} still busy after kill`);
      killWhoeverIsOnPort(PORT);
      await waitForPortFree(PORT);
    }
  }

  await browser.close();
  cleanupWorktree();

  // One playlist + one video per device (mixing a 1440-wide desktop shot and
  // a 390-wide phone shot in a single video is what stretched the mobile
  // frames). Each device gets a fixed canvas; frames are fit into it with
  // letterboxing, never distorted.
  const surfaceOrder = [...SURFACES.map((s) => s.key), ...MODALS.map((m) => m.key)];
  const CANVAS = { desktop: [1440, 900], mobile: [720, 1560] };
  const ffmpeg = findFfmpeg();
  const builds = [];

  for (const dev of ['desktop', 'mobile']) {
    const files = [];
    for (let ci = 0; ci < commits.length; ci++) {
      const cnum = String(ci + 1).padStart(2, '0');
      for (const key of surfaceOrder) {
        const f = `c${cnum}_${key}_${dev}.png`;
        if (fs.existsSync(path.join(OUTPUT_DIR, f))) files.push(f);
      }
    }
    if (!files.length) continue;

    const listPath = path.join(OUTPUT_DIR, `frames-${dev}.txt`);
    const lines = [];
    for (const f of files) lines.push(`file '${f}'`, `duration ${FRAME_SECONDS}`);
    lines.push(`file '${files[files.length - 1]}'`); // concat demuxer repeats the last
    fs.writeFileSync(listPath, lines.join('\n') + '\n');

    const [w, h] = CANVAS[dev];
    const vf =
      `scale=${w}:${h}:force_original_aspect_ratio=decrease:flags=lanczos,` +
      `pad=${w}:${h}:-1:-1:color=white,setsar=1,format=yuv420p`;
    const out = `timelapse-${dev}.mp4`;
    const args = ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-vf', vf,
      '-c:v', 'libx264', '-crf', '18', '-preset', 'slow', '-movflags', '+faststart', out];

    console.log(`\n${dev}: ${files.length} frames -> ${out}`);
    if (ffmpeg) {
      try {
        execFileSync(ffmpeg, args, { cwd: REPO_DIR, stdio: 'ignore' });
        console.log(`  built ${out}`);
      } catch (e) {
        console.warn(`  ffmpeg failed: ${e.message}`);
        builds.push(`  "${ffmpeg}" ${args.map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(' ')}`);
      }
    } else {
      builds.push(`  ffmpeg ${args.map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(' ')}`);
    }
  }

  if (builds.length) {
    console.log(`\nffmpeg not found on PATH — run these yourself:`);
    builds.forEach((b) => console.log(b));
  }
  console.log(`\n(edit FRAME_SECONDS at the top of this script to change pacing, then re-run — frames are cached.)`);
}

// Look for ffmpeg on PATH, then in the usual winget install locations.
function findFfmpeg() {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return 'ffmpeg';
  } catch { /* not on PATH */ }
  const la = process.env.LOCALAPPDATA || '';
  const candidates = [path.join(la, 'Microsoft', 'WinGet', 'Links', 'ffmpeg.exe')];
  const pkgRoot = path.join(la, 'Microsoft', 'WinGet', 'Packages');
  try {
    for (const d of fs.readdirSync(pkgRoot)) {
      if (!/ffmpeg/i.test(d)) continue;
      const build = path.join(pkgRoot, d);
      for (const sub of fs.readdirSync(build)) {
        candidates.push(path.join(build, sub, 'bin', 'ffmpeg.exe'));
      }
    }
  } catch { /* no winget packages dir */ }
  return candidates.find((c) => fs.existsSync(c)) || null;
}

main().catch((e) => {
  console.error(e);
  cleanupWorktree();
  process.exit(1);
});
