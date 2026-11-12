// Records the board in use, in a real browser, against a deployed URL.
// Usage: node record/record.mjs <boardUrl> <outDir> [--mode step1|step2]
// Writes <outDir>/raw.webm (Playwright) and <outDir>/log.json (what happened, at which mm:ss, with ack receipts).
// The overlay (pointer dot, caption, rec clock) is drawn by this recorder only; it is not part of the board.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [url, outDir] = process.argv.slice(2);
const mode = process.argv.includes('--mode') ? process.argv[process.argv.indexOf('--mode') + 1] : 'step1';
mkdirSync(outDir, { recursive: true });
const launch = { args: [] };
if (process.env.CHROME) launch.executablePath = process.env.CHROME;
if (process.env.NO_PROXY_SERVER) launch.args.push('--no-proxy-server');
const browser = await chromium.launch(launch);
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: outDir, size: { width: 1280, height: 720 } },
  locale: process.env.LOCALE || 'en-AU',
  timezoneId: process.env.TZ_ID || 'Australia/Brisbane',
});
const t0 = Date.now();
const mmss = (t = Date.now()) => {
  const s = Math.max(0, Math.floor((t - t0) / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
const events = [];
const acks = [];
const note = (what, extra = {}) => {
  const e = { at: mmss(), ms: Date.now() - t0, what, ...extra };
  events.push(e);
  console.log(e.at, what, Object.keys(extra).length ? JSON.stringify(extra) : '');
  return e;
};

await ctx.addInitScript((t0) => {
  const boot = () => {
    const css = document.createElement('style');
    css.textContent = `
      #rec-dot{position:fixed;z-index:99999;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;
        background:rgba(230,40,40,.45);border:2px solid #e62828;pointer-events:none;left:-50px;top:-50px;transition:transform .08s}
      #rec-dot.down{transform:scale(.6);background:#e62828}
      #rec-bar{position:fixed;z-index:99998;left:0;right:0;bottom:0;padding:8px 16px;background:rgba(20,20,24,.88);color:#fff;
        font:14px/1.35 ui-monospace,monospace;pointer-events:none;display:flex;gap:16px}
      #rec-clock{color:#ffcf4a;white-space:nowrap}`;
    document.head.appendChild(css);
    const dot = Object.assign(document.createElement('div'), { id: 'rec-dot' });
    const bar = Object.assign(document.createElement('div'), { id: 'rec-bar' });
    bar.innerHTML = '<span id="rec-clock">rec 00:00</span><span id="rec-cap">recorder overlay · not part of the board</span>';
    document.body.append(dot, bar);
    addEventListener('mousemove', (e) => { dot.style.left = e.clientX + 'px'; dot.style.top = e.clientY + 'px'; }, true);
    addEventListener('mousedown', () => dot.classList.add('down'), true);
    addEventListener('mouseup', () => dot.classList.remove('down'), true);
    setInterval(() => {
      const s = Math.floor((Date.now() - t0) / 1000);
      document.getElementById('rec-clock').textContent = `rec ${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    }, 200);
    window.__cap = (t) => { document.getElementById('rec-cap').textContent = t; };
  };
  if (document.body) boot(); else document.addEventListener('DOMContentLoaded', boot);
}, t0);

const page = await ctx.newPage();
if (process.env.MOCK) {
  // Dev only: a fake API with a new incident every 10 s, so the recorder can be tried without touching the course.
  const list = Array.from({ length: 8 }, (_, k) => ({ id: `INC-${100 + k}`, service: 'auth', region: 'eu-west', summary: 'mock', severity: 'sev3', openedAt: new Date(t0 - (k + 1) * 6e5).toISOString() }));
  let n = 200;
  setInterval(() => list.unshift({ id: `INC-${n++}`, service: 'booking-api', region: 'ap-southeast', summary: 'mock new', severity: 'sev2', openedAt: new Date().toISOString() }), 10000);
  await page.route('https://hq.mega.dev/**', async (route) => {
    const u = new URL(route.request().url());
    if (u.pathname.endsWith('/ack')) return route.fulfill({ json: { id: u.searchParams.get('id'), ackedAt: new Date().toISOString(), receipt: 'mock-' + u.searchParams.get('id') } });
    return route.fulfill({ json: { updatedAt: new Date().toISOString(), incidents: list, cursor: 'c' } });
  });
}
page.on('console', (m) => {
  const t = m.text();
  if (t.startsWith('ack ')) {
    const [, id, ackedAt, receipt] = t.split(' ');
    acks.push({ at: mmss(), id, ackedAt, receipt });
  }
});
const cap = (t) => page.evaluate((t) => window.__cap && window.__cap(t), t).catch(() => {});
const topId = () => page.getByTestId('incident-row').first().getAttribute('data-id');
const waitForArrival = async (timeout = 30000) => {
  const before = await topId();
  await page.waitForFunction(
    (b) => document.querySelector('[data-testid="incident-row"]')?.dataset.id !== b,
    before,
    { timeout, polling: 'raf' },
  );
  return { before, now: await topId() };
};
const ackBox = async (id) => page.locator(`[data-testid="incident-row"][data-id="${id}"] [data-testid="ack"]`).boundingBox();
const ackedIn = async () =>
  page.$$eval('[data-testid="incident-row"]', (rs) => rs.filter((r) => r.querySelector('[data-testid="acked"]')).map((r) => r.dataset.id));
const glide = async (box) => {
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y, { steps: 25 });
  return { x, y };
};

// open-board
await page.mouse.move(640, 300);
note('open-board: goto', { url });
await page.goto(url, { waitUntil: 'commit' });
const loaderSeen = await page.getByTestId('loader').waitFor({ state: 'visible', timeout: 5000 }).then(() => true, () => false);
note('loader visible', { loaderSeen });
await page.getByTestId('incident-row').first().waitFor({ timeout: 20000 });
const sha = await page.locator('meta[name=build]').getAttribute('content');
const footerSha = await page.getByTestId('build-sha').textContent();
note('incidents on screen, loader gone', { rows: await page.getByTestId('incident-row').count(), sha, footerSha });
await cap(`open-board · build ${sha.slice(0, 7)} · tonight's incidents, newest first`);
await page.waitForTimeout(2500);

// watch-board
await cap('watch-board · board left open, no reload · waiting for the next incident');
const a1 = await waitForArrival();
note('watch-board: new incident on top without reload', a1);
await cap(`watch-board · ${a1.now} arrived on top, no reload`);
await page.waitForTimeout(2500);

if (mode === 'step1') {
  // ack-incident, calm moment: right after an arrival the list holds still for a few seconds
  await cap('ack-incident · right after an arrival: point at row 3 and click Ack');
  const calmId = await page.getByTestId('incident-row').nth(2).getAttribute('data-id');
  const p1 = await glide(await ackBox(calmId));
  await page.waitForTimeout(400);
  note('ack-incident (calm): click', { aimed: calmId, ...p1 });
  await page.mouse.click(p1.x, p1.y);
  await page.locator(`[data-id="${calmId}"] [data-testid="acked"]`).waitFor({ timeout: 10000 });
  note('ack-incident (calm): acked', { acked: calmId });
  await cap(`ack-incident · ${calmId} acked as aimed`);
  await page.waitForTimeout(2500);

  // ack-incident, as on-call does it: point, then click; a refresh lands in between
  const aimedId = await page.getByTestId('incident-row').nth(6).getAttribute('data-id');
  const aboveId = await page.getByTestId('incident-row').nth(5).getAttribute('data-id');
  await cap(`ack-incident · pointing at ${aimedId}'s Ack, about to click`);
  const p2 = await glide(await ackBox(aimedId));
  note('ack-incident (moving list): pointer on Ack', { aimed: aimedId, ...p2 });
  const arr = await waitForArrival();
  const shiftAt = note('refresh inserts a new incident on top; rows move down under the pointer', arr);
  await page.waitForTimeout(250); // a person's click lands a few hundred ms after they aim
  const before = new Set(await ackedIn());
  const clickAt = note('ack-incident (moving list): click, pointer never moved', { aimed: aimedId, ...p2 });
  await page.mouse.click(p2.x, p2.y);
  await page.waitForFunction((n) => document.querySelectorAll('[data-testid="acked"]').length > n, before.size, { timeout: 10000 });
  const got = (await ackedIn()).filter((id) => !before.has(id));
  note('ack-incident (moving list): acked', { aimed: aimedId, acked: got, rowThatSlidUnder: aboveId });
  await cap(`ack-incident · aimed ${aimedId}, the click acked ${got.join(',')} (it slid under the pointer at ${shiftAt.at})`);
  await page.waitForTimeout(4000);
  writeFileSync(join(outDir, 'moment.json'), JSON.stringify({ shiftAt: shiftAt.at, clickAt: clickAt.at, aimed: aimedId, acked: got }, null, 2));
} else {
  // step2 flows are written after product's answer
  const mod = await import(process.env.STEP2_FLOW || './step2.mjs');
  await mod.default({ page, note, cap, waitForArrival, ackBox, ackedIn, glide, acks });
}

await page.waitForTimeout(1000);
note('end');
const video = page.video();
await page.close();
await ctx.close();
await video.saveAs(join(outDir, 'raw.webm'));
await video.delete().catch(() => {});
await browser.close();
writeFileSync(join(outDir, 'log.json'), JSON.stringify({ url, mode, t0: new Date(t0).toISOString(), sha, footerSha, events, acks }, null, 2));
console.log('done', { sha, acks: acks.length });
process.exit(0);
