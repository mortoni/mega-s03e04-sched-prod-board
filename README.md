# sched-prod incident board

The on-call incident board for sched-prod: a static page (`app/`) that reads tonight's incidents from the
course's incident API. Read `plan.md` first, then the four ready issues in `issues/`.

## Run it

1. Fill `app/config.js` with `api` and `session` from start-challenge.
2. Serve `app/` with any static server: `npm run serve`.
3. Deploy `app/` to your own public **https** address — any static host works (GitHub Pages, Cloudflare
   Pages or Workers, Netlify, Vercel's production URL, …).

## The incident API

Base = `api` from start-challenge. `api.js` already wraps both calls; keep using it.

| call | answers |
|------|---------|
| `GET <api>/incidents?t=<session>[&since=<cursor>]` | `{ updatedAt, incidents: [{ id, service, region, summary, severity, openedAt }], cursor }` — newest first |
| `GET <api>/ack?t=<session>&id=<incident id>&cursor=<latest cursor>` | `{ id, ackedAt, receipt }` |

Every ack answers with a sealed **receipt** (opaque: the course reads it, you quote it). `api.js`
keeps them in `acks` and logs each one to the console.

## What to send

**Step 1 — evidence.** A recording of the board in use, at a public https link (a file in your repo, a
release asset, any host that serves the file itself), and a short Markdown report:

````markdown
## What you checked
<what you did on the board, and what you saw>

## When
<mm:ss in the recording>

## Where
<the file behind what you saw (file:line)>

## Options for product
<what product could decide, as options>

```evidence
{
  "flow": "<open-board | ack-incident | watch-board>",
  "at": "<mm:ss>",
  "receipt": "<the ack receipt for that moment>",
  "sha": "<the build the recording shows>",
  "videoLink": "https://<the recording>"
}
```
````

Send it with claim-challenge: `{ session, step: 1, url, report, videoLink }`. Product reads it and answers.

Product answers a few minutes later: by mail to your agent inbox (if you built one), and through
resume-challenge with `receipts: { productReceipt }`.

**Step 2 — proof of the new build.** Change what product decided, deploy, record it again, then run the
course's replay against your URL. Product's answer says how: on GitHub (this repo public, with
`.github/workflows/prove.yml` as shipped — Actions → prove → Run workflow), or on your machine. Send a
fresh report: a `## System Diff` section (what changed against the plan — behavior, UX, data — product's
decision, and the `data-testid` hooks it touched), and one ```` ```evidence ```` block naming the build your
recording shows:

```evidence
{ "sha": "<build>", "videoLink": "https://<the new recording>", "runUrl": "https://github.com/<you>/<repo>/actions/runs/<id>" }
```

`{ session, step: 2, productReceipt, url, report, videoLink }` — plus `replay` (what the replay printed)
when you ran it on your machine instead of GitHub.

## How this repo ships (added)

- `ci/build.sh` copies `app/` to `dist/` and stamps the commit sha into `<meta name="build">` and the footer (R6).
- `.github/workflows/ship.yml`: a push to `main` deploys `dist/` to https://sched-prod-board.mortoni-alan.workers.dev
  (Cloudflare Workers static assets) and checks the live page names that sha. A push to `rec/<name>` records the
  live board with `record/record.mjs` (Playwright, real Chromium), keeps the video on the `recordings` branch and
  serves it at `/rec/<name>.mp4`. Each run writes its result to the `ship-report` branch.
- `test/board.test.mjs` checks R1-R6 and the hooks against a mocked API: `npm run build && npx serve dist`, then
  `node test/board.test.mjs http://localhost:3000/ $(git rev-parse HEAD)`.
- `.github/workflows/prove.yml` is the course's, unchanged.
