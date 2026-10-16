# Spend Pulse — demo click script

Signals 1 to 5, in order. Each line is one click and what it does.
Start on **Spend Pulse** (the landing page), signal rail at the top.
Every completed action raises an "Action Taken" toast and flips that action's
panel in the drawer to its done state.

---

## Signal 1 — ASN Indicates Delayed Shipment

| # | Click | What happens |
|---|---|---|
| 1 | The signal card (anywhere on its body) | Opens the signal drawer |
| 2 | **Initiate Transfer** in the Actions panel | Opens the Internal Warehouse Transfer form |
| 3 | **Save** in the form footer | Transfer initiated, back to the drawer, action marked taken |
| 4 | **View Transfer Document** (optional) | The record the transfer produced |
| 5 | The drawer's ✕ | Back to the rail — the card now reads Viewed |

---

## Signal 2 — Expiring Supplier Certificate

| # | Click | What happens |
|---|---|---|
| 1 | The signal card | Opens the certificate drawer (certificate details, supplier exposure) |
| 2 | **Renew Certificate** in the Actions panel | Leaves the drawer for the supplier's Certificates page; **Suppliers** lights in the main menu. Nothing is committed yet — the request still has to be sent |
| 3 | The ➤ send glyph on the expiring MBE row | Opens **Request an External Update Form or Process** — the org's external forms, for Meridian Packaging Solutions (the filter above the table is already set, so the expiring certificate is the row on screen) |
| 4 | **Send Request** on **Certificate Renewal Request** | Request sent to the supplier, action marked taken. The modal closes to the page you were on, not back into the signal |
| 5 | **Spend Pulse** in the main menu | Back to the rail |

---

## Signal 3 — Supplier Risk Score Change

Two actions. The demo runs through Review Contracts; **Start Risk Reassessment**
(the first panel, and the card's button) is a dead link and does nothing.

| # | Click | What happens |
|---|---|---|
| 1 | The signal card | Opens the drawer — two action panels |
| 2 | **Review Contracts** (second panel) | Marks the action taken *as you leave* and lands on the Contracts list; **Contracts** lights in the main menu |
| 3 | The ✎ pencil on contract CTR-2024-0881 | Opens the contract review form (contract, its renewal clock, the two POs in flight) |
| 4 | **Flag For Review** | Contract flagged |
| 5 | **Spend Pulse** in the main menu | Back to the rail |

---

## Signal 4 — Price Index Decreased: Bulk Solvent

The long one: drawer → Navi → event in Draft → Publish → bid analysis.

| # | Click | What happens |
|---|---|---|
| 1 | The signal card | Opens the drawer — BLS index chart, impacts, category exposure |
| 2 | **Create Sourcing Event** in the Actions panel | Drawer closes and the Navi chat opens; it plays the ask, the Autonomous Event Creation Agent working, and the draft coming back |
| 3 | The **Review Request Form** card in the chat | Expands Navi to the full-page Review Request workspace |
| 4 | A line item header (optional) | Opens that line's request and sourcing details; one at a time |
| 5 | **Generate Sourcing Event** | Event SE-2026-0417 opens in **Draft** on the Sourcing page, Navi closes, **Sourcing** lights in the main menu |
| 6 | The ✦ beside **Base Price** on line 1 | Reopens Navi on the one field the agent left empty — the Analytics Agent recommends a base price |
| 7 | The **Price Trend (Last 12 Months)** card | Opens the chart full page, with the rail of artifacts on the left |
| 8 | **Back** (or ←) | Back into the chat thread |
| 9 | **Publish** in the footer | Event moves to **Production**, all 5 invited suppliers notified, Navi collapses to its bubble |
| 10 | **Analyze** on Cascade Solvents' row in the Responses table | Opens that supplier's response as its own tab and Navi analyses the bid |
| 11 | The ✦ beside **Price per Unit** (optional) | Same analysis for a different line |
| 12 | **Compare All Supplier Bids** pill | Bar chart artifact in the chat; the pill isn't offered again |
| 13 | **Recommend Best Supplier** pill | Navi's award recommendation |
| 14 | **Send All Awards for Approval** in the footer | Where the prototype stops — the approval chain after it is out of scope |
| 15 | **Spend Pulse** in the main menu | Back to the rail |

---

## Signal 5 — Supplier Fragmentation Opportunity (IT Hardware)

Three actions: refine the agent, view the opportunity, source it.

| # | Click | What happens |
|---|---|---|
| 1 | The signal card | Opens the drawer — three action panels |
| 2 | **View Opportunity** (second panel) | The $1,789,520 opportunity broken down by subcategory; read-only, so it never marks as taken |
| 3 | **Back to Signal** in the footer | Returns to the drawer's actions |
| 4 | **Refine Agent Parameters** (first panel) | Leaves the drawer for the agent's page in Agent Studio |
| 5 | **Copy** | Confirmation modal |
| 6 | **Copy** in the modal | Opens the copied agent — blue banner, vertical stepper, name pre-filled "copy of Supplier Fragmentation Opportunity Analysis" |
| 7 | The **Agent Name** and **Instructions** fields | Both editable — re-scope the agent to laptops by region |
| 8 | **Save** in the footer | Agent saved and run; lands on the **CFO Dashboard - Summary** with 4 laptop fragmentation opportunities, and **Reports** lights in the main menu |
| 9 | The Laptop Supplier Concentration by Region tile | A bar per region — the share of that region's laptop spend the top 2 suppliers hold today — against the dashed 97% goal line. The four opportunities the agent published, with their addressable amounts, are in the table under it |
| 10 | The **North America** bar | Opens the **Opportunities** workbench filtered to that region's opportunity: one row, $84,300 addressable against Vantage IT |
| 11 | The **✕** on the Region chip | Widens the grid to all four published opportunities, $193,000 in total |
| 12 | **Back to CFO Dashboard** | Returns to the dashboard |
| 13 | **Spend Pulse** in the main menu, then the signal card | Back in the drawer, the refine action now taken |
| 14 | **Initiate a Sourcing Event** (third panel) | The IT Hardware event: invite list, award scenarios against the 80% target |
| 15 | **Draft Event with Navi** | Event SE-2026-0512 drafted |

---

### Resetting between runs

State is in memory only — reload the page to put every signal back to New,
the event back to Draft and the copied agent back to nothing.

### Two things worth pointing out while clicking

- Signal cards start **unpinned**. Pinning one moves it to the front of the rail
  and raises a toast; the rest hold their order.
- **View All** on the rail opens every signal in a table, with a Change column
  per metric.
