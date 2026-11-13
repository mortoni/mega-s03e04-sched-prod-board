// Step-2 flow (SCHED-4515): the same moving-list click as step 1, now with the confirm.
// Called by record.mjs with its helpers.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

export default async function ({ page, note, cap, waitForArrival, ackBox, ackedIn, glide, acks, outDir }) {
  const rows = page.getByTestId('incident-row');
  const confirm = page.getByTestId('confirm');
  const centre = async (loc) => {
    const b = await loc.boundingBox();
    return glide(b);
  };

  // 1. The step-1 moment again: pointer on an Ack, a refresh lands, the click lands on the row that slid under.
  const aimedId = await rows.nth(5).getAttribute('data-id');
  const aboveId = await rows.nth(4).getAttribute('data-id');
  await cap(`ack-incident · pointing at ${aimedId}'s Ack, about to click (same as step 1 at 00:21)`);
  const p = await glide(await ackBox(aimedId));
  note('ack-incident: pointer on Ack', { aimed: aimedId });
  const arr = await waitForArrival();
  const shift = note('refresh inserts a new incident on top; rows move down under the pointer', arr);
  await page.waitForTimeout(250);
  const ackedBefore = acks.length;
  const click1 = note('ack-incident: click, pointer never moved', { aimed: aimedId });
  await page.mouse.click(p.x, p.y);
  await confirm.waitFor({ state: 'visible', timeout: 5000 });
  const said1 = (await confirm.innerText()).replace(/\s+/g, ' ').trim();
  const wrong = note('confirm opens and names the row the click landed on', { confirm: said1, aimed: aimedId, rowThatSlidUnder: aboveId });
  await cap(`confirm says "${said1.split(' ').slice(0, 2).join(' ')}" but I aimed at ${aimedId} · Cancel`);
  await page.waitForTimeout(2500);
  await centre(page.getByTestId('confirm-cancel'));
  await page.mouse.down();
  await page.mouse.up();
  await confirm.waitFor({ state: 'hidden', timeout: 5000 });
  await page.waitForTimeout(1000);
  const cancelled = note('cancelled: no ack sent', { acksSent: acks.length - ackedBefore, acked: await ackedIn() });
  await cap(`Cancel · nothing acked (${aboveId} and ${aimedId} both still open)`);
  await page.waitForTimeout(2000);

  // 2. Pick the intended row again; the confirm names it; Ack.
  await cap(`ack-incident · Ack on ${aimedId} again`);
  await glide(await ackBox(aimedId));
  await page.waitForTimeout(300);
  await page.mouse.down();
  await page.mouse.up();
  await confirm.waitFor({ state: 'visible', timeout: 5000 });
  const said2 = (await confirm.innerText()).replace(/\s+/g, ' ').trim();
  const right = note('confirm names the intended incident', { confirm: said2, aimed: aimedId });
  await cap(`confirm says "${said2.split(' ').slice(0, 2).join(' ')}" · Ack`);
  await page.waitForTimeout(2000);
  await centre(page.getByTestId('confirm-ack'));
  const confirmAt = note('confirm-ack clicked', { aimed: aimedId });
  await page.mouse.down();
  await page.mouse.up();
  await page.locator(`[data-id="${aimedId}"] [data-testid="acked"]`).waitFor({ timeout: 10000 });
  const done = note('acked as aimed', { aimed: aimedId, acked: await ackedIn(), ack: acks[acks.length - 1] });
  await cap(`${aimedId} acked as aimed · ${aboveId} still open`);
  await page.waitForTimeout(3500);

  writeFileSync(
    join(outDir, 'moment.json'),
    JSON.stringify(
      {
        aimed: aimedId,
        rowThatSlidUnder: aboveId,
        shiftAt: shift.at,
        click1At: click1.at,
        wrongConfirmAt: wrong.at,
        wrongConfirm: said1,
        cancelledAt: cancelled.at,
        rightConfirmAt: right.at,
        rightConfirm: said2,
        confirmAckAt: confirmAt.at,
        ackedAt: done.at,
        got: acks.slice(ackedBefore).map((a) => a.id),
      },
      null,
      2,
    ),
  );
}
