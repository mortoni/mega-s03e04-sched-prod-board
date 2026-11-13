---
id: SCHED-4515
title: Ack asks to confirm, naming the incident
status: done
plan: R2
---

Found on the step-1 recording (00:21): a refresh put a new incident on top while on-call pointed at INC-3881's
Ack; every row moved down one row and the click acked INC-9173.

Product's decision: new incidents stay live at the top and Ack stays on the row, but Ack asks to confirm, and
the confirm names the incident id.

- Ack on a row opens a confirm (`data-testid="confirm"`) that names the id of the row the click landed on.
- `confirm-ack` sends `api.ack(<that id>)` and marks that row acked; `confirm-cancel`, Esc or a click outside sends
  nothing.
- The confirm is a fixed overlay, so refreshes behind it cannot move it or change the id it acks.

Acceptance: a click that lands on the wrong row shows the wrong id in the confirm, and Cancel leaves both
incidents unacked; Ack on the intended row, then confirm, acks exactly that incident.
