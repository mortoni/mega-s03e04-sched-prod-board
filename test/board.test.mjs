// Plan checks (R1-R6, hooks) against a mocked API, so no acks reach the course.
// Usage: node test/board.test.mjs <served board url> <sha it was built at>
import { chromium } from 'playwright';
const [url, sha] = process.argv.slice(2);
const results = [];
const ok = (name, cond, info = '') => { results.push({ name, pass: !!cond, info }); };

function mockApi(state) {
  return async (route) => {
    const u = new URL(route.request().url());
    if (u.pathname.endsWith('/incidents')) {
      if (state.delay) await new Promise((r) => setTimeout(r, state.delay));
      state.calls.push({ t: Date.now(), since: u.searchParams.get('since') });
      return route.fulfill({ json: { updatedAt: new Date().toISOString(), incidents: state.incidents, cursor: 'c' + state.calls.length } });
    }
    if (u.pathname.endsWith('/ack')) {
      const id = u.searchParams.get('id');
      state.acks.push({ id, cursor: u.searchParams.get('cursor') });
      return route.fulfill({ json: { id, ackedAt: '2026-11-12T21:30:00.000Z', receipt: 'r-' + id } });
    }
    return route.abort();
  };
}
const inc = (n, openedAt, extra = {}) => ({ id: `INC-${n}`, service: 'auth', region: 'eu-west', summary: 's' + n, severity: 'sev3', openedAt, ...extra });

const browser = await chromium.launch({ ...(process.env.CHROME ? { executablePath: process.env.CHROME } : {}), args: ['--no-proxy-server'] });

// 1. loader, list, order, sha, new row at top, ack, acked survives refresh, refresh cadence
{
  const state = { calls: [], acks: [], delay: 800, incidents: [inc(2, '2026-11-12T03:03:00.000Z'), inc(1, '2026-11-12T02:00:00.000Z')] };
  const ctx = await browser.newContext({ locale: 'en-GB', timezoneId: 'Europe/Berlin' });
  const page = await ctx.newPage();
  await page.route('https://hq.mega.dev/**', mockApi(state));
  await page.goto(url);
  ok('R3 loader visible on open', await page.getByTestId('loader').isVisible());
  await page.getByTestId('incident-row').first().waitFor();
  ok('R3 loader gone after load', (await page.getByTestId('loader').count()) === 0);
  ok('R6 meta build = sha', (await page.locator('meta[name=build]').getAttribute('content')) === sha);
  ok('R6 footer build-sha = sha', (await page.getByTestId('build-sha').textContent()) === sha);
  state.delay = 0;
  await page.getByTestId('ack').last().click();
  ok('SCHED-4515 confirm names the id', /INC-1\b/.test(await page.getByTestId('confirm').innerText()) && !(await page.getByTestId('confirm').innerText()).includes('INC-2'));
  ok('SCHED-4515 nothing sent before confirm', state.acks.length === 0);
  await page.getByTestId('confirm-cancel').click();
  ok('SCHED-4515 cancel closes, sends nothing', !(await page.getByTestId('confirm').isVisible()) && state.acks.length === 0);
  await page.getByTestId('ack').last().click();
  await page.keyboard.press('Escape');
  ok('SCHED-4515 Esc closes, sends nothing', !(await page.getByTestId('confirm').isVisible()) && state.acks.length === 0);
  await page.getByTestId('ack').last().click();
  await page.getByTestId('confirm-ack').click();
  await page.locator('[data-id="INC-1"] [data-testid="acked"]').waitFor();
  ok('R2 ack calls api with that id and latest cursor', state.acks[0]?.id === 'INC-1' && state.acks[0]?.cursor?.startsWith('c'), JSON.stringify(state.acks));
  state.incidents = [inc(3, '2026-11-12T04:00:00.000Z'), ...state.incidents];
  await page.locator('[data-testid="incident-row"]').first().and(page.locator('[data-id="INC-3"]')).waitFor({ timeout: 5000 });
  ok('R1 new incident on top without reload', (await page.getByTestId('incident-row').first().getAttribute('data-id')) === 'INC-3');
  state.incidents = state.incidents.filter((i) => i.id !== 'INC-2');
  await page.waitForTimeout(2500);
  ok('R4 a refresh never takes a row off', (await page.locator('[data-id="INC-2"]').count()) === 1);
  ok('R2 acked mark survives refresh', (await page.locator('[data-id="INC-1"] [data-testid="acked"]').count()) === 1);
  const n0 = state.calls.length; await page.waitForTimeout(6100); const n = state.calls.length - n0;
  ok('R4 refresh about every 2 s', n >= 2 && n <= 4, `${n} calls in 6.1 s`);
  ok('R5 datetime keeps full UTC', (await page.locator('[data-id="INC-2"] time').getAttribute('datetime')) === '2026-11-12T03:03:00.000Z');
  await ctx.close();
}
// 2. R5 per zone/locale
for (const [locale, timezoneId, want] of [['de-DE', 'Europe/Berlin', /12\.11\..*04:03/], ['en-NZ', 'Pacific/Auckland', /12\/11.*16:03/], ['en-GB', 'Europe/Berlin', /12\/11.*04:03/], ['en-US', 'America/New_York', /11\/11.*22:03/]]) {
  const state = { calls: [], acks: [], incidents: [inc(2, '2026-11-12T03:03:00.000Z')] };
  const ctx = await browser.newContext({ locale, timezoneId });
  const page = await ctx.newPage();
  await page.route('https://hq.mega.dev/**', mockApi(state));
  await page.goto(url);
  const t = await page.locator('[data-id="INC-2"] time').textContent();
  ok(`R5 ${locale} ${timezoneId}`, want.test(t), t);
  await ctx.close();
}
// 3. empty
{
  const state = { calls: [], acks: [], incidents: [] };
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  await page.route('https://hq.mega.dev/**', mockApi(state));
  await page.goto(url); await page.getByTestId('empty').waitFor({ state: 'visible' });
  ok('empty state shows with no incidents', true);
  await ctx.close();
}
await browser.close();
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.info ? '  · ' + r.info : ''}`);
process.exit(results.every((r) => r.pass) ? 0 : 1);
