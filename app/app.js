import { fetchIncidents, ack } from './api.js';

const REFRESH_MS = 2000; // R4

const loader = document.querySelector('[data-testid="loader"]');
const empty = document.querySelector('[data-testid="empty"]');
const list = document.querySelector('[data-testid="incident-list"]');
const errorBox = document.querySelector('[data-role="error"]');

/** id -> <li>. Rows are kept across refreshes so an acked mark and a pending click survive (R2, R4). */
const rows = new Map();
/** id -> ack reply. */
const acked = new Map();

// R5: the viewer's own zone and locale order (en-GB/de-DE/fr-FR… give dd/mm, en-US gives mm/dd).
const timeFmt = new Intl.DateTimeFormat(undefined, {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23', // 24 h: "04:03 pm" reads as 04:03 at a glance
  timeZoneName: 'short',
});
const localTime = (iso) => timeFmt.format(new Date(iso));

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function rowFor(i) {
  const li = document.createElement('li');
  li.setAttribute('data-testid', 'incident-row');
  li.dataset.id = i.id;
  li.className = `row ${i.severity}`;
  li.innerHTML = `<span class="id">${esc(i.id)}</span>
    <span class="sev">${esc(i.severity)}</span>
    <span class="what">${esc(i.service)} · ${esc(i.region)} · ${esc(i.summary)}</span>
    <time datetime="${esc(i.openedAt)}" title="${esc(i.openedAt)}">${esc(localTime(i.openedAt))}</time>
    <span class="act"><button type="button" data-testid="ack">Ack</button></span>`;
  return li;
}

function markAcked(li, reply) {
  li.classList.add('is-acked');
  li.querySelector('.act').innerHTML =
    `<span data-testid="acked" class="acked" title="receipt ${esc(reply.receipt)}">✓ acked ${esc(localTime(reply.ackedAt))}</span>`;
}

list.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-testid="ack"]');
  if (!btn) return;
  const li = btn.closest('[data-testid="incident-row"]');
  const id = li.dataset.id;
  btn.disabled = true;
  btn.textContent = 'Acking…';
  try {
    const reply = await ack(id);
    acked.set(id, reply);
    markAcked(li, reply);
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Ack';
    showError(`Ack failed for ${id}: ${err.message}`);
  }
});

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.hidden = !msg;
}

/** Make the list match the page: newest first, existing rows reused, new rows in place (R1). */
function render(incidents) {
  const sorted = [...incidents].sort((a, b) => Date.parse(b.openedAt) - Date.parse(a.openedAt));
  const ids = new Set(sorted.map((i) => i.id));
  for (const [id, li] of rows) {
    if (!ids.has(id)) {
      li.remove();
      rows.delete(id);
    }
  }
  let prev = null;
  for (const i of sorted) {
    let li = rows.get(i.id);
    if (!li) {
      li = rowFor(i);
      rows.set(i.id, li);
      if (acked.has(i.id)) markAcked(li, acked.get(i.id));
    }
    const want = prev ? prev.nextSibling : list.firstChild;
    if (li !== want) list.insertBefore(li, want);
    prev = li;
  }
  list.hidden = sorted.length === 0;
  empty.hidden = sorted.length !== 0;
}

let inFlight = false;
let loaded = false;
async function refresh() {
  if (inFlight) return;
  inFlight = true;
  try {
    const page = await fetchIncidents();
    render(page.incidents);
    showError('');
    if (!loaded) {
      loaded = true;
      loader.remove(); // R3: gone once incidents are on screen
    }
  } catch (err) {
    showError(`Could not load incidents: ${err.message}. Retrying…`);
  } finally {
    inFlight = false;
  }
}

await refresh();
setInterval(refresh, REFRESH_MS); // R4
