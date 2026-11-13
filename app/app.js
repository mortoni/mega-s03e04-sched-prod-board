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

// Product's decision on SCHED-4515: Ack asks to confirm, and the confirm names the incident id.
// The id is taken from the row the click landed on, at click time; the confirm sits in a fixed overlay,
// so refreshes that move rows while it is open cannot change what it acks.
const confirmBox = document.querySelector('[data-testid="confirm"]');
const confirmText = confirmBox.querySelector('[data-role="confirm-text"]');
const confirmWhat = confirmBox.querySelector('[data-role="confirm-what"]');
const confirmAck = confirmBox.querySelector('[data-testid="confirm-ack"]');
const confirmCancel = confirmBox.querySelector('[data-testid="confirm-cancel"]');
let pending = null; // { id, li }

function openConfirm(li) {
  const id = li.dataset.id;
  pending = { id, li };
  confirmText.textContent = `Ack ${id}?`;
  confirmWhat.textContent = li.querySelector('.what').textContent;
  confirmBox.dataset.id = id;
  confirmBox.hidden = false;
  confirmAck.focus();
}

function closeConfirm() {
  pending = null;
  confirmBox.hidden = true;
  delete confirmBox.dataset.id;
}

async function sendAck({ id, li }) {
  const btn = li.querySelector('[data-testid="ack"]');
  if (!btn) return;
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
}

list.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-testid="ack"]');
  if (!btn || btn.disabled) return;
  openConfirm(btn.closest('[data-testid="incident-row"]'));
});
confirmAck.addEventListener('click', () => {
  const p = pending;
  closeConfirm();
  if (p) sendAck(p);
});
confirmCancel.addEventListener('click', closeConfirm);
confirmBox.addEventListener('click', (e) => {
  if (e.target === confirmBox) closeConfirm(); // a click on the backdrop cancels
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && pending) closeConfirm();
});

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.hidden = !msg;
}

/**
 * Add what is new, in the page's order (newest first, R1). A row already on the board is never moved or
 * taken off by a refresh: only new rows are inserted, so the rows under the pointer change only by an arrival.
 */
function render(incidents) {
  let next = null; // the row that follows, in page order
  for (let k = incidents.length - 1; k >= 0; k--) {
    const i = incidents[k];
    let li = rows.get(i.id);
    if (!li) {
      li = rowFor(i);
      rows.set(i.id, li);
      if (acked.has(i.id)) markAcked(li, acked.get(i.id));
      list.insertBefore(li, next); // next === null: append
    }
    next = li;
  }
  list.hidden = rows.size === 0;
  empty.hidden = rows.size !== 0;
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
