/* =============================================================================
   Spend Pulse Demo — Aug 26
   Responsive recreation of the Figma prototype
   file ucs3z1HpsFCDhXQkluHDEd, starting frame 37:25015.

   Structure
     1. data           – copy, table rows and chart series lifted from the file
     2. ui helpers      – small render primitives
     3. screens         – one render function per full-page prototype frame
     4. overlays        – drawers / modals / tooltips / toast (OVERLAY nodes)
     5. navi chat       – the agent flow an action hands off to (212:47337)
     6. router + wiring – NAVIGATE, OVERLAY, SWAP, BACK, CLOSE, ON_HOVER
   ========================================================================== */
'use strict';

/* ===========================================================================
   1. DATA
   ======================================================================== */

const NAV = [
  { label: 'Spend Pulse', route: 'landing', active: true },
  { label: 'Agent Studio', route: 'agent-studio' },
  { label: 'Requests' }, { label: 'Orders' }, { label: 'Invoices' },
  { label: 'Payments' }, { label: 'Category Planner' },
  { label: 'Reports', route: 'reports' },
  { label: 'Suppliers' }, { label: 'Setup', route: 'setup' },
];

/* ===========================================================================
   LANDING SIGNAL CARDS — EDIT COPY HERE
   ---------------------------------------------------------------------------
   One object per card on the landing page. Everything a card shows, and
   everything its Signal Details drawer shows, comes from here — nothing else
   needs to change to add, remove or reword a card.

     id        stable key; per-card runtime state is stored under it
     title     card heading. Clamped to ONE line with an ellipsis (Figma R46),
               so keep it to ~40 characters
     body      description. Clamped to FOUR lines on the card; the drawer
               always shows it in full
     navi      Navi-recommended text. Omit for cards with no recommendation
     cta       label of the primary footer button
     status    starting state — 'New' | 'Viewed' | 'Completed' | 'Dismissed'
     ago       relative timestamp
     pinned    true to start pinned
     actionTaken  true if the action has already been taken. Replaces the Navi
               box with the `Last Updated by:` line and enables Mark As Completed
     by / at   who last updated the signal and when. The card and drawer show
               them as one `Last Updated by: <by> at <at>` line (see metaLine);
               the All Signals list shows them as two columns. `at` is optional
     triggered when the signal fired — the list's `Signal Triggered On` column
     detail    id of a bespoke drawer in OVERLAYS. When omitted, the generic
               Signal Details drawer is built from the fields below
     impacts   [[heading, detail], …] rows for the drawer's Impacts block
     exposure  { title, text, stats:[[label, value], …] } — the numbers behind
               the impacts, rendered INSIDE the Impacts block
     series    { name, period, values, ticks, yTitle, note } — the index behind
               an index-driven signal, drawn on its drawer as evidence
     action    { title, text } for the drawer's Navi-recommended Actions block
     actions   [{ id, title, text, cta, icon, overlay, pick, doneTitle,
               doneText, doneCta }, …] — for a signal that offers several
               co-equal actions instead of one. Each renders as its own panel,
               and each is taken independently: `state.signals[id].actions[aid]`
               remembers which ones have been. `pick: true` marks Navi's
               recommended one, which leads the block. Authoring `actions`
               replaces `action`; `cta` on the card comes from the picked one
     doneCta   { label, icon, overlay } — a way back into what the action
               produced, shown in the Actions panel once it has been taken
     ctaOverlay  overlay the footer CTA opens instead of taking the action
                 inline (used by the bespoke transfer flow)
     source    { logo, name } — a third-party provider to credit on the card
               footer and the drawer's meta row (see sourceMark)
     action.naviFlow  id in NAVI_FLOWS. The action hands off to the Navi chat
               instead of an overlay: the drawer closes and the flow plays out
     transfer  { from, fromLoc, to, toLoc } for the Internal Warehouse Transfer
               form, which is shared by every ASN signal — so the warehouses it
               shows have to come from the signal that launched it
     supplierName  the supplier this signal is about, shown on the transfer
               flow's contact card

   The first three cards are the reference set from the Figma file — their copy
   is verbatim and should not be reworded.
   ======================================================================== */

/* Chart series a signal card authors directly, so they have to be declared
   before the cards that reference them.

   BLS Industrial Chemicals Index — the series behind the bulk solvent signal.
   Dec 25 (133) down to Jun 26 (117) is the 12% drop the card reports, so the
   chart is the evidence for the headline rather than a decoration beside it. */
const SOLVENT_INDEX = [128, 130, 132, 131, 130, 133, 129, 126, 122, 120, 118, 117];

/* Methanol contract price per gallon over the same year, drawn on the sourcing
   event's Pricing Intelligence block. It lags the index — that gap is the point
   of the block: what the market did against what we last paid. */
const METHANOL_PRICE = [1.86, 1.88, 1.85, 1.84, 1.82, 1.83, 1.79, 1.74, 1.70, 1.66, 1.63, 1.62];

/* The event's other two lines, for the Analytics Agent's price trend artifact
   (212:57685). Both are mapped to the same index as methanol — that is why they
   are in the same event — so they move with it rather than on their own, and
   are derived from it instead of being hand-drawn into a different shape. The
   ratios land each line on the market benchmark its line item quotes. */
const IPA_PRICE = METHANOL_PRICE.map((v) => Number((v * 1.2716).toFixed(2)));
const ACETONE_PRICE = METHANOL_PRICE.map((v) => Number((v * 0.7901).toFixed(2)));

const LANDING_SIGNALS = [
  {
    id: 'asn-delayed',
    title: 'ASN indicates delayed shipment',
    body: 'Shipment with ASN #4587321 from Supplier Apex Chemicals is delayed and now expected to arrive on Aug 15, 2026 instead of May 5, 2026, impacting raw material availability.',
    navi: 'Transfer stock from Pincrest Logistics Hub to Northgate Distribution Center to keep this delay from reaching manufacturing.',
    status: 'New', ago: '1h ago', cta: 'Initiate Transfer', pinned: true,
    by: 'John Doe', at: '8/1/2025 13:30:00', triggered: '8/1/2025 12:30:00',
    impacts: [
      ['It will negatively increase Average Fullfilment Time',
        'Average fulfillment time increased from 3 days to 3.5 days'],
      ['It will decrease Average Item Qty. Fill Rate',
        'Average item qty fill rate decreased from 94% to 92%'],
    ],
    action: {
      title: 'Internal Warehouse Transfer',
      text: 'Navi suggests transferring stock from Pincrest Logistics Hub in Chicago to Northgate Distribution Center in Texas, based on where your network currently has available stock — keeping this delay from reaching manufacturing.',
      doneTitle: 'Internal Warehouse Transfer was initiated on Aug 10, 2026',
      doneText: 'Internal warehouse transfer from Pincrest Logistics Hub in Chicago to Northgate Distribution Center in Texas was initiated on Aug 10, 2026',
    },
    supplier: true, supplierName: 'Apex Chemicals', ctaOverlay: 'sd-transfer',
    transfer: { from: 'Pincrest Logistics Hub', fromLoc: 'Chicago',
      to: 'Northgate Distribution Center', toLoc: 'Texas' },
  },
  {
    /* Demo signal 2. Replaced the Steel Mill price-index card, which moved to
       EXTRA_SIGNALS — its drawer is shared with the Silver signal, so nothing
       was lost by taking it off the landing rail. */
    id: 'cert-expiry-meridian',
    title: 'Expiring Supplier Certificate',
    body: 'The Minority Business Enterprise certificate for supplier Meridian Packaging Solutions expires in 30 days, and no renewal evaluation has been initiated in the system.',
    navi: 'Review the expiring Minority Business Enterprise certificate and send a renewal request to Meridian Packaging Solutions.',
    status: 'New', ago: '1h ago', cta: 'Review Certificate', pinned: true,
    by: 'Seraphina Wilde', at: '8/1/2025 09:15:00', triggered: '8/1/2025 08:15:00',
    impacts: [
      ['It will put supplier diversity compliance reporting at risk',
        'The certificate supports your supplier diversity commitments and lapses in 30 days with no renewal evaluation started'],
      ['It will affect 2 active contracts',
        'Contract terms tied to this supplier’s diversity status are at risk once the certificate lapses'],
    ],
    action: {
      title: 'Review and Renew Certificate',
      text: 'Spend Pulse recommends reviewing the expiring certificate and initiating a renewal request directly to Meridian Packaging Solutions — no spreadsheets or documentation chasing required.',
      doneTitle: 'Certificate renewal request was sent on Aug 10, 2026',
      doneText: 'A renewal request for the Minority Business Enterprise certificate was sent to Meridian Packaging Solutions on Aug 10, 2026',
    },
    /* The request that went out stays reachable after the action — the renewal
       form carries the certificate's own fields, so nothing had to be duplicated
       onto the drawer to keep it available. */
    doneCta: { label: 'View Renewal Request', overlay: 'sd-cert-renewal' },
    exposure: {
      title: 'Supplier Exposure',
      text: 'Meridian Packaging Solutions has 3 invoices awaiting payment and 2 active contracts tied to this certificate.',
      stats: [['Spend YTD', '$284K'], ['Invoices Awaiting Payment', '$42.5K'],
        ['Active Contracts', '2']],
    },
    supplierName: 'Meridian Packaging Solutions',
    detail: 'sd-cert-expiry', ctaOverlay: 'sd-cert-renewal',
    certificate: {
      name: 'Minority Business Enterprise (MBE)',
      body: 'National Minority Supplier Development Council',
      number: 'MBE-2023-48117',
      issued: 'Sep 11, 2023',
      expires: 'Sep 10, 2026',
      remaining: '30 days',
    },
  },
  {
    /* Demo signal 3. Replaced the SilverLine financial-risk card, which said the
       same thing with different numbers — two supplier-risk cards on one rail
       would have read as a duplicate rather than a second story. */
    id: 'supplier-risk-coastal',
    title: 'Supplier Risk Score Change',
    body: 'The risk score for supplier Coastal Fabrication Group has changed from Low to Moderate, driven by a weakening financial position.',
    navi: 'Flag the contract up for renewal for review and identify a backup supplier for upcoming orders.',
    status: 'New', ago: '2h ago', cta: 'Start Risk Reassessment', pinned: true,
    by: 'Evangeline Nightshade', at: '8/1/2025 14:05:00', triggered: '8/1/2025 12:05:00',
    impacts: [
      ['It will expose new spend to a higher-risk supplier',
        'Routing further spend to Coastal Fabrication Group without review carries risk if their financial position keeps deteriorating'],
      ['It will put 1 contract up for renewal at risk',
        'A contract renews in 45 days and 2 purchase orders are already in flight'],
    ],
    exposure: {
      title: 'Supplier Exposure',
      text: 'Coastal Fabrication Group has 2 open purchase orders currently in flight and 1 contract up for renewal in 45 days.',
      stats: [['Spend YTD', '$612K'], ['Open Purchase Orders', '2'],
        ['Contract Renewal', '45 days']],
    },
    action: {
      title: 'Start a Supplier Risk Reassessment',
      text: 'Spend Pulse recommends flagging this contract for review before renewal and identifying a backup supplier for upcoming orders.',
      doneTitle: 'Supplier risk reassessment was started on Aug 10, 2026',
      doneText: 'A risk reassessment for Coastal Fabrication Group was started on Aug 10, 2026 and the contract up for renewal was flagged for review',
    },
    /* The reassessment form is where the two suggested alternates live, so the
       Actions panel keeps a way back to it once the action is taken. */
    doneCta: { label: 'View Risk Reassessment', overlay: 'sd-risk-reassess' },
    supplierName: 'Coastal Fabrication Group',
    /* No `detail` — the generic drawer renders everything this signal has,
       including the exposure block. Only the action needs a bespoke form. */
    ctaOverlay: 'sd-risk-reassess',
    risk: {
      from: 'Low', to: 'Moderate',
      /* `Navi suggests two qualified alternate suppliers in the same category
         based on past performance and capacity` — the script's closing beat. */
      alternates: [
        ['Harbor Metalworks Inc.', 'Same category • 98% on-time over 24 months • capacity available'],
        ['Ironline Fabrication Co.', 'Same category • 96% on-time over 18 months • capacity available'],
      ],
    },
  },
  {
    /* Demo signal 4, the BLS beat. Replaced the HC WORLD off-contract card,
       which was a spend-leakage story rather than a market-movement one — the
       script's fourth signal is a price drop picked up from an index, so the
       drawer carries the index itself (`series`) as its evidence. */
    id: 'price-drop-bulk-solvent',
    title: 'Price Index decreased: Bulk Solvent',
    body: 'Bulk solvent price has dropped by 12% over the last 6 months. The shift was picked up from the BLS Industrial Chemicals Index.',
    navi: 'Navi recommends initiating a sourcing event for bulk solvent with your preferred suppliers while the market is below contract.',
    status: 'New', ago: '1h ago', cta: 'Create Sourcing Event', pinned: true,
    by: 'Bartholomew Finch', at: '8/1/2025 11:40:00', triggered: '8/1/2025 10:40:00',
    /* The only signal in the set whose evidence comes from outside Coupa, so
       the only one that credits a provider on its card (161:22433). The mark is
       the BLS logo exported from that frame — see `source` in signalCard. */
    source: { logo: 'assets/bls-logo.svg', name: 'U.S. Bureau of Labor Statistics' },
    /* The index the signal was picked up from, drawn above Impacts. Dec 25's
       peak of 133 down to 117 in Jun 26 is the 12% the card reports. */
    series: {
      name: 'BLS Industrial Chemicals Index', period: 'Last 1 Year',
      values: SOLVENT_INDEX, ticks: [140, 130, 120, 110, 100], yTitle: 'Index Value',
      note: 'The index for Industrial Chemicals held near 130 through the first half of the '
        + 'period, then fell steadily from its December peak of 133 to 117 in June — a 12% '
        + 'decline over six months. Bulk solvent is mapped to this series, so the drop applies '
        + 'to every contract and open order in the category.',
    },
    impacts: [
      ['It will leave contracted bulk solvent priced above market',
        '3 active contracts covering $1.9M of annual bulk solvent spend are priced against the pre-drop index'],
      ['It will overstate the cost of 4 open purchase orders',
        '4 purchase orders and 9 invoices in the category are still transacting at the old rate'],
    ],
    exposure: {
      title: 'Category Exposure',
      text: 'Bulk solvent spend is spread across 5 active suppliers, 3 active contracts, '
        + '4 open purchase orders and 9 invoices — all mapped to the Industrial Chemicals series.',
      stats: [['Estimated Spend Impact', '$228K'], ['Contracted Spend', '$1.9M'],
        ['Open PO Value', '$316K'], ['Invoices', '$74.2K']],
    },
    action: {
      title: 'Initiate a Sourcing Event',
      text: 'Navi’s autonomous event creation agent can draft a sourcing event for bulk solvent '
        + 'with your preferred suppliers — the line items, the market benchmark and the invite '
        + 'list are already assembled, so the day of prep this used to take is one click.',
      doneTitle: 'Sourcing event was drafted on Aug 10, 2026',
      doneText: 'Sourcing event SE-2026-0417 for Bulk Solvent was drafted by Navi’s autonomous '
        + 'event creation agent on Aug 10, 2026 and invites 5 preferred solvent suppliers',
      /* Launching the event *is* the hand-off to the agent, so this action does
         not open a form — it opens the Navi chat and lets the agent draft it
         (212:47337). See NAVI_FLOWS. `ctaOverlay` stays: it is where `doneCta`
         goes once the event exists. */
      naviFlow: 'sourcing-event',
    },
    /* The event draft is where the pricing intelligence and the bid comparison
       live, so the Actions panel keeps a way back into it once it is drafted. */
    doneCta: { label: 'View Sourcing Event', overlay: 'sd-sourcing-event' },
    supplierName: 'Bulk Solvent category',
    ctaOverlay: 'sd-sourcing-event',
    /* Everything the sourcing event form shows. `bids` is the side-by-side
       comparison — [supplier, unit price, total, lead time, vs index] — and
       `benchmark` is the pricing intelligence above it. */
    sourcing: {
      eventId: 'SE-2026-0417', item: 'Bulk Solvent',
      description: 'Methanol, technical grade, 55-gal drum',
      volume: '180,000 gal / yr',
      /* Units live in the label, not the value — `$1.62 – $1.88 / gal` wraps
         onto a second line in a stat card and drags the row's height with it. */
      benchmark: [['Last Purchase Price ($/gal)', '$1.83'],
        ['12-Month Range ($/gal)', '$1.62 – $1.88'],
        ['Market Benchmark ($/gal)', '$1.62'],
        ['Price Trend (6 Mo)', '−12.0%']],
      suppliers: [
        ['Cascade Solvents & Chemicals', 'Preferred • 4 contracts • 99% on-time'],
        ['Delta Industrial Chemicals', 'Preferred • 2 contracts • 97% on-time'],
        ['Northbridge Solvent Co.', 'Preferred • 1 contract • 96% on-time'],
        ['Verity Chemical Partners', 'Qualified • no current contract'],
        ['Sable Ridge Chemicals', 'Qualified • no current contract'],
      ],
      /* The event's line items, and the fields the agent filled in for each —
         what the Review Request page (212:43650) reads. `request` is the ask,
         `sourcing` is how it goes to market, which is the split the two cards
         in that frame make. Every value here follows from the signal: the
         index that moved, the contracts priced against it, and the preferred
         suppliers already under contract for the line. */
      lines: [
        {
          name: 'Methanol, Technical Grade',
          request: [
            ['Item Name', 'Methanol, technical grade, 55-gal drum'],
            ['Justification', 'The BLS Industrial Chemicals Index fell 12% over six months while '
              + '3 active contracts covering $1.9M of annual bulk solvent spend stayed priced '
              + 'against the pre-drop index. Taking the line to market now captures the drop '
              + 'before renewal.'],
            ['Category', 'Industrial Chemicals › Bulk Solvent'],
            ['Supplier', 'Cascade Solvents & Chemicals, Delta Industrial Chemicals, '
              + 'Northbridge Solvent Co.'],
          ],
          sourcing: [
            ['Contract Term', 'Annual'],
            ['Region', 'North America'],
            ['Needed by Date', '10/ 01/ 2026'],
            ['Quantity', '180,000 gal / yr'],
            ['Price/ Unit', '$1.62 / gal (market benchmark)'],
            ['Supporting Document', 'BLS Industrial Chemicals Index — Jun 2026.pdf'],
          ],
          /* The same line as the event's Details tab shows it once the event is
             in Draft (212:53121). The Review Request fields above are the ask
             in prose; these are the event's own fields, so they are the same
             facts in the shapes that page's controls take. There is no base
             price: the frame leaves that one field empty behind an AI sparkle,
             for the Analytics Agent to answer. */
          draft: {
            commodity: 'Industrial Chemicals', coupaCommodity: 'Bulk Solvent — Methanol',
            description: 'Methanol, technical grade, 55-gal drum',
            quantity: '180,000', unit: 'Gallons', currency: 'USD',
            needBy: '10/01/2026', shipping: 'FOB Destination',
          },
          /* What the Analytics Agent answers with when that sparkle is pressed
             (212:56139). `last` is what the line was last bought at — the
             pre-drop level, Dec 25 on the series — `range` is the series' own
             12-month span, and `rec` is the market benchmark the line is going
             to market at, so applying the recommendation agrees with the
             Price/ Unit above rather than contradicting it. */
          price: {
            last: '$1.83', range: '$1.62 – $1.88', rec: '1.62',
            basis: '5 similar events', confidence: 'Medium confidence',
            events: ['Solvent Supply #221 (Methanol, Technical Grade)',
              'Chemical Sourcing #309 (Methanol 99%)',
              'Bulk Solvents #401 (Industrial Methanol)',
              'Industrial Chemicals #187 (Methanol, Technical Grade)',
              'Process Solvents #254 (Methanol Blend)'],
            values: METHANOL_PRICE, ticks: [2, 1.9, 1.8, 1.7, 1.6, 1.5],
          },
        },
        {
          name: 'Isopropyl Alcohol, 99% USP',
          request: [
            ['Item Name', 'Isopropyl alcohol, 99% USP grade, 55-gal drum'],
            ['Justification', 'Mapped to the same index and covered by the same three contracts. '
              + 'The contracted rate is 9% above the June benchmark.'],
            ['Category', 'Industrial Chemicals › Bulk Solvent'],
            ['Supplier', 'Cascade Solvents & Chemicals, Verity Chemical Partners'],
          ],
          sourcing: [
            ['Contract Term', 'Annual'],
            ['Region', 'North America'],
            ['Needed by Date', '10/ 01/ 2026'],
            ['Quantity', '60,000 gal / yr'],
            ['Price/ Unit', '$2.06 / gal (market benchmark)'],
            ['Supporting Document', 'BLS Industrial Chemicals Index — Jun 2026.pdf'],
          ],
          draft: {
            commodity: 'Industrial Chemicals', coupaCommodity: 'Bulk Solvent — Alcohols',
            description: 'Isopropyl alcohol, 99% USP grade, 55-gal drum',
            quantity: '60,000', unit: 'Gallons', currency: 'USD',
            needBy: '10/01/2026', shipping: 'FOB Destination',
          },
          price: {
            last: '$2.33', range: '$2.06 – $2.39', rec: '2.06',
            basis: '4 similar events', confidence: 'Medium confidence',
            events: ['Chemical Sourcing #309 (Isopropyl Alcohol 99%)',
              'Bulk Solvents #401 (IPA, USP Grade)',
              'Cleanroom Supply #276 (Isopropyl Alcohol)',
              'Process Solvents #254 (IPA 99%)'],
            values: IPA_PRICE, ticks: [2.5, 2.4, 2.3, 2.2, 2.1, 2],
          },
        },
        {
          name: 'Acetone, Technical Grade',
          request: [
            ['Item Name', 'Acetone, technical grade, 55-gal drum'],
            ['Justification', 'Lowest volume of the three lines, but it renews with them — '
              + 'sourcing it in the same event keeps the category on one contract cycle.'],
            ['Category', 'Industrial Chemicals › Bulk Solvent'],
            ['Supplier', 'Delta Industrial Chemicals, Sable Ridge Chemicals'],
          ],
          sourcing: [
            ['Contract Term', 'Annual'],
            ['Region', 'North America'],
            ['Needed by Date', '10/ 01/ 2026'],
            ['Quantity', '45,000 gal / yr'],
            ['Price/ Unit', '$1.28 / gal (market benchmark)'],
            ['Supporting Document', 'BLS Industrial Chemicals Index — Jun 2026.pdf'],
          ],
          draft: {
            commodity: 'Industrial Chemicals', coupaCommodity: 'Bulk Solvent — Ketones',
            description: 'Acetone, technical grade, 55-gal drum',
            quantity: '45,000', unit: 'Gallons', currency: 'USD',
            needBy: '10/01/2026', shipping: 'FOB Destination',
          },
          price: {
            last: '$1.45', range: '$1.28 – $1.49', rec: '1.28',
            basis: '3 similar events', confidence: 'Low confidence',
            events: ['Bulk Solvents #401 (Acetone, Technical Grade)',
              'Process Solvents #254 (Acetone)',
              'Industrial Chemicals #187 (Acetone Blend)'],
            values: ACETONE_PRICE, ticks: [1.6, 1.5, 1.4, 1.3, 1.2],
          },
        },
      ],
      /* Bids as they stand once the event is out. `gap` is the bid against the
         $1.62 benchmark, which is what makes a number competitive or not. */
      bids: [
        ['Cascade Solvents & Chemicals', '$1.64', '$295.2K', '5 days', '+1.2%', 'competitive'],
        ['Delta Industrial Chemicals', '$1.67', '$300.6K', '7 days', '+3.1%', 'competitive'],
        ['Northbridge Solvent Co.', '$1.78', '$320.4K', '6 days', '+9.9%', 'above'],
        ['Verity Chemical Partners', '$1.81', '$325.8K', '9 days', '+11.7%', 'above'],
      ],
    },
  },
  {
    /* Demo signal 5, the fragmentation beat. The one signal on the rail that
       offers three co-equal actions rather than a single recommendation, and
       the only one whose recommended action leaves Spend Pulse: refining the
       Opportunity Analysis agent happens in Agent Studio, and the opportunities
       it creates land on the CFO Dashboard. */
    id: 'supplier-fragmentation-it-hardware',
    title: 'Supplier Fragmentation: IT Hardware',
    body: 'The top 5 suppliers provide only 56% of IT Hardware spend against your consolidation target of 80%. $1,789,520 was spent on IT Hardware in the first half of 2026, spread across 28 suppliers.',
    navi: 'Refine the Opportunity Analysis agent to focus on laptops by region before committing to a sourcing event.',
    status: 'New', ago: '4h ago', cta: 'Refine Agent Parameters', pinned: true,
    by: 'Cordelia Vane', at: '8/1/2025 10:10:00', triggered: '8/1/2025 06:10:00',
    /* One impact rather than three (207:26699). Fragmentation is a single
       condition — the three rows were three consequences of it, and the donut
       below now shows the condition itself, so the rows were reading the chart
       out loud. Everything they carried is folded into the detail. */
    impacts: [
      ['High Supplier Fragmentation',
        '28 suppliers carry the $1,789,520 spent on IT Hardware in H1 2026, and the top 5 cover '
        + 'only 56% of it against your 80% consolidation target. 23 of them sit below the volume '
        + 'thresholds where tier pricing starts, and 41 contracts and 312 invoices are being '
        + 'administered for a category a fifth that many suppliers could cover.'],
    ],
    /* Where the category spend actually sits, as a donut (206:26585). The five
       named shares are the same ones the sourcing event quotes for its
       incumbents, so the chart and the invite list cannot drift apart. The
       spends round to the $1,789,520 headline. */
    mix: {
      /* No centred value (207:26699). The 56% is already the impact's opening
         claim and a Category Spend Analysis card, so in the hole it was a third
         printing of the same number — and it read as the donut's total, which it
         is not: the ring divides the whole category, not the top 5. */
      label: 'IT Hardware Spend by Supplier',
      slices: [
        ['Vantage IT', 19, '$340,010'],
        ['Meridian Technology Group', 13, '$232,640'],
        ['Blue Ridge Systems', 11, '$196,850'],
        ['Halcyon Digital Supply', 8, '$143,160'],
        ['Ironwood Computing', 5, '$89,480'],
        ['Other Suppliers (23)', 44, '$787,380'],
      ],
      note: 'Closing the 24-point gap to your 80% target would move roughly $429K of spend onto '
        + 'these five strongest suppliers.',
    },
    exposure: {
      title: 'Category Spend Analysis',
      text: 'IT Hardware spend for the first six months of 2026, as measured by the Opportunity '
        + 'Analysis agent across all business units.',
      /* Share before count, so the two headline figures of the signal — what was
         spent and how little of it the top 5 carry — are the first two cards. */
      stats: [['Spend (H1 2026)', '$1,789,520'], ['Top 5 Supplier Share', '56%'],
        ['Suppliers', '28'], ['Consolidation Target', '80%']],
    },
    supplierName: 'IT Hardware category',
    /* Three actions, Navi's pick first. `route` sends an action to a full page
       rather than an overlay — the only action on the rail that does. */
    actions: [
      {
        id: 'refine-agent', pick: true,
        title: 'Refine Agent Parameters',
        text: 'Rather than sourcing the whole category at once, narrow the Supplier Fragmentation '
          + 'Opportunity Analysis agent to the subcategories worth consolidating first. Opening it '
          + 'in Agent Studio lets you copy the agent and re-scope it to laptops, broken down by region.',
        cta: 'Refine Agent Parameters', icon: 'tune', route: 'agent-fragmentation',
        doneTitle: 'Opportunity Analysis agent was refined and run on Aug 10, 2026',
        doneText: 'Supplier Fragmentation Opportunity Analysis (Laptops by Region) ran on '
          + 'Aug 10, 2026 and created 4 laptop fragmentation opportunities, one per region. They '
          + 'are on the CFO Dashboard - Summary.',
        doneCta: { label: 'View in Agent Studio', icon: 'open_in_new' },
      },
      {
        id: 'view-opportunity',
        title: 'View Opportunity',
        text: 'See how the $1,789,520 opportunity the agent generated breaks down — by IT Hardware '
          + 'subcategory, by how concentrated each one already is, and by how much of it is '
          + 'addressable — before deciding whether to act on it.',
        /* No icon: the alternatives run without one so the AI glyph on Navi's
           pick is the only glyph in the section (207:26699). */
        cta: 'View Opportunity', overlay: 'sd-fragmentation-opportunity',
        /* Reviewing the breakdown is not a commitment, so this panel never
           moves to a taken state — there is nothing for it to record. */
        readOnly: true,
      },
      {
        id: 'sourcing-event',
        title: 'Initiate a Sourcing Event',
        text: 'Take the whole category to market now and consolidate in one pass. Navi drafts an '
          + 'RFQ across the 28 incumbents with award scenarios sized to the 80% target.',
        cta: 'Initiate a Sourcing Event', overlay: 'sd-it-sourcing-event',
        doneTitle: 'IT Hardware sourcing event was drafted on Aug 10, 2026',
        doneText: 'Sourcing event SE-2026-0512 for IT Hardware was drafted on Aug 10, 2026 and '
          + 'invites the 8 suppliers that carry 71% of current category spend.',
        doneCta: { label: 'View Sourcing Event', icon: 'open_in_new' },
      },
    ],
    /* Everything the two IT Hardware action overlays show. `subcats` is the
       breakdown of the opportunity amount; `regions` is what the refined agent
       produces, and is also what the CFO Dashboard reads. */
    fragmentation: {
      total: '$1,789,520', suppliers: 28, top5: '56%', target: '80%',
      period: 'Jan 1 – Jun 30, 2026',
      addressable: '$429,485',
      /* [subcategory, spend, suppliers, top-2 share, addressable] — the spends
         sum to the $1,789,520 headline. */
      subcats: [
        ['Laptops & Notebooks', '$742,180', '11', '61%', '$193,000'],
        ['Desktops & Workstations', '$318,640', '6', '74%', '$62,400'],
        ['Monitors & Displays', '$246,900', '8', '52%', '$66,700'],
        ['Networking Hardware', '$214,300', '7', '58%', '$51,200'],
        ['Peripherals & Accessories', '$167,500', '12', '31%', '$46,185'],
        ['Servers & Storage', '$100,000', '4', '81%', '$10,000'],
      ],
      /* The event the second action drafts, if the category is taken to market
         as it stands rather than re-scoped first. */
      event: {
        eventId: 'SE-2026-0512', item: 'IT Hardware',
        description: 'Laptops, desktops, monitors, networking and peripherals',
        volume: '$3.6M / yr (annualised)',
        suppliers: [
          ['Vantage IT', 'Incumbent • 19% of category spend • 14 contracts'],
          ['Meridian Technology Group', 'Incumbent • 13% of category spend • 6 contracts'],
          ['Blue Ridge Systems', 'Incumbent • 11% of category spend • 4 contracts'],
          ['Halcyon Digital Supply', 'Incumbent • 8% of category spend • 3 contracts'],
          ['Ironwood Computing', 'Incumbent • 5% of category spend • 2 contracts'],
          ['Northgate Technology Partners', 'Qualified • no current contract'],
          ['Solstice Hardware Co.', 'Qualified • no current contract'],
          ['Cobalt IT Distribution', 'Qualified • no current contract'],
        ],
      },
      /* What the refined agent creates: one opportunity per region for laptops.
         [region, laptop spend, top-2 share, goal, suppliers, addressable] —
         North America's 70% against a 97% goal is the script's example, and the
         spends sum to the $742,180 laptop line above. */
      regions: [
        ['North America', '$312,400', '70%', '97%', '6', '$84,300'],
        ['EMEA', '$214,900', '58%', '97%', '5', '$62,100'],
        ['APAC', '$148,600', '64%', '97%', '4', '$34,400'],
        ['LATAM', '$66,280', '41%', '97%', '3', '$12,200'],
      ],
    },
  },
  /* A second ASN-delay card used to sit here — same title and same Initiate
     Transfer action as the first signal, differing only in supplier and dates.
     Read down the rail it looked like a duplicate rather than a sixth beat, so
     it is gone; the five demo signals each make their own point. */
  {
    id: 'stockout-packaging',
    title: 'Stock-Out Projected in 3 Days',
    body: 'Packaging & Assembly Components are projected to stock out within 3 days at the current consumption rate of 1,240 units per day. On-hand cover is 3,700 units.',
    navi: 'Navi recommends expediting PO #PO-88421 and splitting the balance to the Rotterdam hub.',
    status: 'New', ago: '3h ago', cta: 'Expedite PO',
    by: 'Genevieve Sterling', at: '8/1/2025 12:20:00', triggered: '8/1/2025 09:20:00',
    impacts: [
      ['It will decrease Average Item Qty. Fill Rate',
        'Average item qty fill rate is forecast to fall from 82% to 71%'],
      ['It will increase Lead Time',
        'Replenishment lead time increases from 7 days to 11 days'],
    ],
    action: {
      title: 'Expedite Purchase Order',
      text: 'Navi recommends expediting PO #PO-88421 and splitting the balance to the Rotterdam hub.',
    },
  },
  {
    id: 'contract-expiring-it',
    title: 'Contract Expiring: IT Hardware',
    body: 'Contract CN-10432 with Vantage IT covering $1.2M of annual IT Hardware spend expires in 28 days. No renewal or replacement sourcing event has been started.',
    navi: 'Navi recommends starting renewal now — historical renewals in this category take 34 days.',
    status: 'New', ago: '6h ago', cta: 'Start Renewal',
    by: 'Atticus Blackwood', at: '8/1/2025 08:00:00', triggered: '8/1/2025 06:00:00',
    impacts: [
      ['It will reduce Pre-Approved Contract Spend',
        '$1.2M of annual spend falls out of contract coverage on expiry'],
      ['It will expose spend to list pricing',
        'Negotiated discounts of 11% lapse across 24 catalogue items'],
    ],
    action: {
      title: 'Start Contract Renewal',
      text: 'Navi recommends starting renewal now — historical renewals in this category take 34 days.',
    },
  },
  {
    id: 'invoice-variance',
    title: 'Invoice Price Variance Detected',
    body: '142 invoices from Orion Manufacturing Co. were billed 6.4% above contracted unit price over the last 60 days, a total variance of $58.7K awaiting resolution.',
    navi: 'Navi recommends raising a single consolidated dispute covering all 142 invoices.',
    status: 'New', ago: '1d ago', cta: 'Review Variance',
    by: 'Isabelle Lovelace', at: '7/31/2025 16:45:00', triggered: '7/31/2025 14:45:00',
    impacts: [
      ['It will increase realised unit cost',
        'Effective unit cost is 6.4% above the contracted rate'],
      ['It will delay invoice settlement',
        '142 invoices totalling $58.7K are held pending resolution'],
    ],
    action: {
      title: 'Raise a Consolidated Dispute',
      text: 'Navi recommends raising a single consolidated dispute covering all 142 invoices.',
    },
  },
  {
    id: 'tariff-aluminium',
    title: 'Tariff Change: Aluminium Imports',
    body: 'A 12% import duty on aluminium takes effect Sep 1, 2025. 6 open purchase orders worth $310K ship after that date and would be assessed at the new rate.',
    /* Was `Viewed` with the action already taken, and so had no Navi line and a
       placeholder `Action` CTA. A New card shows the Navi recommendation in
       place of the Last Updated line, so it needs a real one of each. */
    navi: 'Navi recommends pulling 6 open purchase orders forward to ship before the duty takes effect on Sep 1, 2025.',
    status: 'New', ago: '1d ago', cta: 'Pull Orders Forward',
    by: 'Jasper Thorne', at: '7/31/2025 10:30:00', triggered: '7/31/2025 08:30:00',
    impacts: [
      ['It will increase landed cost',
        'Landed cost on $310K of open orders rises by an estimated $37.2K'],
      ['It will affect 4 active contracts',
        '4 contracts contain no duty pass-through clause'],
    ],
    action: {
      title: 'Pull Orders Forward',
      text: 'Navi recommends pulling 6 open purchase orders forward to ship before Sep 1, 2025.',
    },
  },
  {
    id: 'payment-terms-mismatch',
    title: 'Payment Terms Mismatch',
    body: '38 suppliers are being paid on Net 30 while their contracts specify Net 60, pulling $210K of working capital forward each month.',
    /* Was the rail's `Completed` card. Same treatment as the tariff signal above
       — a real Navi line and CTA, since New replaces the Last Updated line with
       the recommendation. The Completed variant is still reachable: take the
       action on any card and Mark As Completed in its drawer. */
    navi: 'Navi recommends bulk-updating the 38 supplier records to their contracted Net 60 terms.',
    status: 'New', ago: '2d ago', cta: 'Align Payment Terms',
    by: 'Alistair Valerian', at: '7/30/2025 17:10:00', triggered: '7/30/2025 15:10:00',
    impacts: [
      ['It will reduce available working capital',
        '$210K per month is disbursed ahead of contracted terms'],
      ['It affects 38 active suppliers',
        'Terms on 38 supplier records do not match their contract'],
    ],
    action: {
      title: 'Align Payment Terms',
      text: 'Navi recommends bulk-updating the 38 supplier records to their contracted Net 60 terms.',
    },
  },
];

/* --- landing metric strip ------------------------------------------------
   `lead` marks the tiles that carry the leading-indicator speedometer and the
   info affordance in the Figma file — only the first three do.

   `desc`, `objective` and `unit` are what the info modal adds on top of what
   the tile already shows; the modal takes its title, current value and peer
   average straight off the tile, so the two can never disagree.
   `id` keys the modal — `metric-info:<id>`.                                 */
const LANDING_METRICS = [
  { id: 'avg-fulfilment-time', label: 'Average Fulfilment Time',
    value: '3 Days', peer: '3.5 days', delta: '+0.2 Last Month', dir: 'up', lead: true,
    unit: 'Days', objective: 'The lower the better',
    desc: 'This metric captures the average time taken between a purchase order being issued and the goods being received. A lower score indicates a responsive supply base and reliable fulfilment performance.' },
  { id: 'item-qty-fill-rate', label: 'Average Item Quantity Fill Rate',
    value: '82%', peer: '89%', delta: '+0.2 Last Week', dir: 'up', lead: true,
    unit: '% of Ordered Quantity', objective: 'The higher the better',
    desc: 'This metric captures the proportion of ordered quantity that suppliers deliver in full on the first attempt. A higher score indicates dependable suppliers and fewer short shipments to reconcile.' },
  { id: 'turnover-ratio', label: 'Turnover Ratio',
    value: '6', peer: '8', delta: '+0.2 Last Week', dir: 'up', lead: true,
    unit: 'Ratio (times per year)', objective: 'The higher the better',
    desc: 'This metric captures how effectively inventory is converted into sales. A higher score indicates strong market demand and optimal stock management, signifying superior sales efficiency.' },
  { id: 'high-risk-suppliers', label: 'High-Risk Suppliers',
    value: '16%', peer: '18%', delta: 'No Change', dir: 'flat',
    unit: '% of Active Suppliers', objective: 'The lower the better',
    desc: 'This metric captures the share of active suppliers carrying an elevated risk score across financial, operational or ESG indicators. A lower score indicates a more resilient supply base.' },
  { id: 'pre-approved-contract-spend', label: 'Pre-Approved Contract Spend',
    value: '81%', peer: '86%', delta: '-2 Last Week', dir: 'down',
    unit: '% of Total Spend', objective: 'The higher the better',
    desc: 'This metric captures the share of total spend placed against a negotiated contract. A higher score indicates strong contract coverage and better realisation of agreed pricing.' },
  { id: 'lead-time', label: 'Lead Time',
    value: '7 Days', peer: '9 Days', delta: '+0.2 Last Week', dir: 'up',
    unit: 'Days', objective: 'The lower the better',
    desc: 'This metric captures the average time between raising a replenishment request and the stock becoming available to use. A lower score indicates shorter cycles and less buffer stock required.' },
];

/* --- price index trends chart -------------------------------------------
   `y` values are the Figma dot positions in chart-local pixels. The plot maps
   y=0 → +10% and y=250 → -10% (12.5px per point), exactly as in the file.   */
const MONTHS = ['Jul 25', 'Aug 25', 'Sep 25', 'Oct 25', 'Nov 25', 'Dec 25',
  'Jan 26', 'Feb 26', 'Mar 26', 'Apr 26', 'May 26', 'Jun 26'];

const CHART_SERIES = [
  { label: 'Energy in U.S. city average, all urban consumers', color: '#0059d6',
    y: [116, 108, 79, 102, 79, 119, 103, 57, 25, 55, 46, 46] },
  { label: 'Information and information processing in U.S. city average, all urban consumers', color: '#ffbf6c',
    y: [148, 148, 139, 169, 137, 91, 75, 115, 92, 115, 86, 78] },
  { label: 'All items in U.S. city average, all urban consumers', color: '#ef91f3',
    y: [107, 127, 124, 158, 152, 149, 128, 149, 160, 151, 163, 166] },
  { label: 'Commodities less food and energy commodities in U.S. city average', color: '#ca073e',
    y: [137, 137, 119, 122, 125, 135, 118, 107, 103, 140, 113, 144] },
  { label: 'Apparel less footwear', color: '#5c0dc5',
    y: [166, 163, 151, 160, 149, 128, 149, 152, 158, 124, 127, 107] },
];

/* OnHover-Legends overlay (37:22890) — a fixed snapshot for Jan 2026 */
const LEGEND_HOVER = {
  month: 'Jan 2026',
  rows: [
    { label: 'Energy', value: '2.4%', color: '#0059d6' },
    { label: 'Durables', value: '4.6%', color: '#ffbf6c' },
    { label: 'Commodities less food', value: '1.3%', color: '#ca073e' },
    { label: 'Cereals and bakery products', value: '0.3%', color: '#ef91f3' },
    { label: 'Apparel less footwear', value: '-2.1%', color: '#5c0dc5' },
  ],
};

/* Steel Mill Products index chart, used inside the price-index signal detail */
const STEEL_INDEX = [22, 30, 41, 38, 52, 58, 44, 36, 33, 55, 71, 85];

/* Add-Alert step 2 preview chart (37:20928) */
const ALERT_PREVIEW = [24, 30, 22, 34, 28, 40, 33, 26, 31, 38, 42, 36];

/* --- extra signals, All Signals only ------------------------------------
   The landing widget shows the top N signals; Signals › All Signals shows
   those SAME signals plus the older ones below, in both Card and List view.
   Anything added here needs the same fields as a LANDING_SIGNALS entry.    */
const EXTRA_SIGNALS = [
  {
    /* Was the second landing card until the demo script put the expiring
       certificate there. Kept because its bespoke `sd-price-index` drawer is
       the one the Silver signal below also opens. */
    id: 'price-index-steel',
    title: 'Price Index increased: Steel Mill Products',
    body: 'Price index for Series: Steel Mill Products has increased 8.2% over the last 6 months.',
    navi: 'Market index are fluctuating. Review your current contracts and category strategy to mitigate the impact on your forecasted spend.',
    status: 'Viewed', ago: '2d ago', cta: 'Create Category Strategy',
    by: 'Seraphina Wilde', at: '8/1/2025 09:15:00', triggered: '8/1/2025 08:15:00',
    detail: 'sd-price-index',
  },
  {
    id: 'off-po-it-services',
    title: 'Off-PO Spend Detected',
    body: '$350,000 in off-PO spend was detected for the IT Services category in North America, spread across 62 invoices with no supporting purchase order.',
    navi: 'Navi recommends consolidating this spend under a single contract with a preferred supplier.',
    status: 'New', ago: '2d ago', cta: 'Create Sourcing Event',
    by: 'Bartholomew Finch', at: '7/30/2025 09:15:00', triggered: '7/30/2025 07:15:00',
    impacts: [
      ['It will reduce Pre-Approved Contract Spend',
        '$350K of category spend sits outside a negotiated agreement'],
      ['It will increase invoice exception handling',
        '62 invoices require manual matching without a PO'],
    ],
    action: {
      title: 'Consolidate Under Contract',
      text: 'Navi recommends consolidating this spend under a single contract with a preferred supplier.',
    },
  },
  {
    id: 'silver-price-increase',
    title: 'Price Increase Alert: Silver',
    body: 'Silver prices have increased week over week, rising to 5.9%. 14 open orders for electrical components are exposed to the new rate.',
    navi: 'Review your current contracts and category strategy to mitigate the impact on your forecasted spend.',
    status: 'New', ago: '3d ago', cta: 'Create Category Strategy',
    by: 'Seraphina Wilde', at: '7/29/2025 11:00:00', triggered: '7/29/2025 08:00:00',
    detail: 'sd-price-index',
  },
  {
    id: 'demand-foot-pumps',
    title: 'Demand Increase: Digital Foot Pumps',
    body: 'Demand for Digital Foot Pumps in the Europe region has increased by 15% compared to the previous quarter, ahead of the current replenishment plan.',
    navi: 'Navi recommends raising the reorder point for the Europe region before the next planning cycle.',
    status: 'Viewed', ago: '4d ago', cta: 'Adjust Reorder Point',
    by: 'Jasper Thorne', at: '7/28/2025 15:40:00', triggered: '7/28/2025 13:40:00',
    impacts: [
      ['It will decrease Average Item Qty. Fill Rate',
        'Fill rate is forecast to fall from 82% to 76% in the Europe region'],
      ['It will increase Lead Time',
        'Replenishment lead time rises from 7 days to 9 days at the new volume'],
    ],
    action: {
      title: 'Raise the Reorder Point',
      text: 'Navi recommends raising the reorder point for the Europe region before the next planning cycle.',
    },
  },
  {
    id: 'off-contract-travel',
    title: 'Off-Contract Spend: Travel',
    body: '$100,000 in off-contract spend was detected for the Travel category, representing 18% of the total category spend this quarter.',
    status: 'Completed', ago: '5d ago', cta: 'Action', actionTaken: true,
    by: 'Isabelle Lovelace', at: '7/27/2025 10:05:00', triggered: '7/27/2025 08:05:00',
    impacts: [
      ['It reduced Pre-Approved Contract Spend',
        '18% of Travel category spend fell outside the negotiated agreement'],
      ['It affected 3 preferred agreements',
        'Volume commitments on 3 agreements were not met this quarter'],
    ],
    action: {
      title: 'Redirect Spend to Preferred Suppliers',
      text: 'Navi recommended redirecting Travel bookings to the two preferred agencies under contract.',
    },
  },
  {
    id: 'off-contract-it-hardware',
    title: 'Off-Contract Spend: IT Hardware',
    body: '$45,000 in off-contract spend was detected for IT Hardware & Equipment in North America across 9 suppliers outside the preferred list.',
    status: 'Completed', ago: '6d ago', cta: 'Action', actionTaken: true,
    by: 'Atticus Blackwood', at: '7/26/2025 16:20:00', triggered: '7/26/2025 14:20:00',
    impacts: [
      ['It reduced Pre-Approved Contract Spend',
        '$45K was purchased outside the IT Hardware agreement'],
      ['It exposed spend to list pricing',
        'Negotiated discounts of 9% did not apply to these orders'],
    ],
    action: {
      title: 'Consolidate to Preferred Suppliers',
      text: 'Navi recommended consolidating the 9 suppliers down to the 2 under contract.',
    },
  },
  {
    id: 'off-contract-cloud-solutions',
    title: 'New Supplier Off-Contract: IT Software',
    body: 'A total of $10,000 was spent off-contract with a new supplier, "Cloud Solutions Inc.," for IT Software with no completed risk assessment.',
    navi: 'Navi recommends running supplier onboarding before any further spend is committed.',
    status: 'Dismissed', ago: '1w ago', cta: 'Start Onboarding',
    by: 'Alistair Valerian', at: '7/25/2025 13:30:00', triggered: '7/25/2025 11:30:00',
    impacts: [
      ['It will increase High-Risk Suppliers',
        'A new supplier is transacting without a completed risk assessment'],
      ['It bypassed preferred-supplier controls',
        '$10K was committed outside the IT Software agreement'],
    ],
    action: {
      title: 'Run Supplier Onboarding',
      text: 'Navi recommends running supplier onboarding before any further spend is committed.',
    },
  },
  {
    id: 'off-contract-it-telecom',
    title: 'Off-Contract Spend: IT Telecom',
    body: '$55,000 of off-contract spend was detected for IT Telecom in North America, up from $18,000 in the previous quarter.',
    navi: 'Navi recommends initiating a sourcing event to bring IT Telecom spend back under contract.',
    status: 'New', ago: '1w ago', cta: 'Create Sourcing Event',
    by: 'John Doe', at: '7/24/2025 08:45:00', triggered: '7/24/2025 06:45:00',
    impacts: [
      ['It will reduce Pre-Approved Contract Spend',
        'Off-contract Telecom spend tripled quarter over quarter'],
      ['It will increase unmanaged category spend',
        '$55K moved outside a negotiated agreement this cycle'],
    ],
    action: {
      title: 'Initiate a Sourcing Event',
      text: 'Navi recommends initiating a sourcing event to bring IT Telecom spend back under contract.',
    },
  },
];

/** Every signal in the product: the landing widget's set, then the older ones.
    Signals › All Signals renders THIS list in both Card and List view, so the
    two views and the landing widget can never drift apart. */
const SIGNALS = LANDING_SIGNALS.concat(EXTRA_SIGNALS);

/* --- signals catalogue (Configure › Signals, admin › Signals) ------------ */
const SIGNAL_CATALOGUE = [
  ['Delayed Shipment', 'Inventory', "Alerts when a confirmed shipment's estimated arrival exceeds the original promise date.", true],
  ['Lower than promised quantity shipment', 'Inventory', 'Detects a discrepancy where the quantity received or in transit is less than the quantity specified in the Purchase Order or ASN.', true],
  ['Staggered shipment', 'Inventory', 'Identifies orders being delivered in multiple small installments rather than a single full shipment.', true],
  ['Off-PO Spend', 'Opportunity Analysis', 'Flags invoices or spend occurring without a supporting Purchase Order.', true],
  ['Off-Contract Spend', 'Opportunity Analysis', 'Detects purchasing from non-preferred suppliers or at prices that do not align with negotiated contract terms.', true],
  ['Expiring Supplier Certificate', 'SIRM', 'Alerts when a critical supplier document (e.g., Insurance, ISO, or Diversity certification) is nearing its expiration date.', false],
  ['Declining Risk Score', 'SIRM', "Detects a downward trend in a supplier's health based on financial, operational, or ESG indicators.", true],
  ['Price Index Fluctuations', 'Bureau of Labour Statistics (BLS)', "Detects monthly volatility, sudden spikes or drops in Bureau of Labor Statistics's CPI/PPI Index.", false, 'bls'],
];

/* --- metrics ------------------------------------------------------------- */
/* The Figma frame repeats one placeholder card four times. Each is its own
   pin, so each needs to be its own metric — the ids already scoped them by
   spend area, and the labels now say so too. They still truncate in the 202px
   card exactly as they do in the file. */
const RECOMMENDED_METRICS = [
  { id: 'rec-avg-fulfilment-time', label: 'Average Fulfilment Time', value: '3 Days', peer: '3.5 Days' },
  { id: 'rec-fill-rate-inventory', label: 'Average Item Quantity Fill Rate (Inventory)', value: '7.5%', peer: '8.25%' },
  { id: 'rec-fill-rate-direct', label: 'Average Item Quantity Fill Rate (Direct)', value: '7.5%', peer: '8.25%' },
  { id: 'rec-fill-rate-indirect', label: 'Average Item Quantity Fill Rate (Indirect)', value: '7.5%', peer: '8.25%' },
  { id: 'rec-fill-rate-services', label: 'Average Item Quantity Fill Rate (Services)', value: '7.5%', peer: '8.25%' },
];

/* [name, type, unit, current, peer] */
const ALL_METRICS = [
  ['High Risk Suppliers', 'KPI', 'Percentage(%)', '16%', '23%'],
  ['Pre-Approved Contract Spend', 'KPI', 'Percentage(%)', '81%', '42%'],
  ['Lead Time', 'KPI', 'Days', '7 Days', '10 Days'],
  ['Inventory Value', 'KPI', 'USD($)', '$167,890.45', '$234,567.89'],
  ['Total Warehouse Inventory', 'KPI', 'Units', '185,000', '210,000'],
  ['Total Inventory Items', 'KPI', 'Count', '4,200', '5,100'],
  ['Total Inventory Commodity', 'KPI', 'Percentage(%)', '65%', '71%'],
  ['Average Quantity Fill Ratye', 'KPI', 'Percentage(%)', '92.5%', '95.6%'],
  ['Total On Contract Spend', 'Leading Indicator', 'USD($)', '$75,575.57', '$98,765.43'],
  ['Contract Spend (No PO)', 'Leading Indicator', 'Percentage(%)', '62%', '62%'],
  ['Pre-Approved Contract Spend', 'Leading Indicator', 'USD($)', '$2,100,000', '—'],
  ['Off Contract Invoice Spend', 'Leading Indicator', 'USD($)', '$450,000', '—'],
  ['Spend Per Supplier', 'Leading Indicator', 'USD($)', '$55,000', '—'],
  ['Suppliers on Catalog', 'Leading Indicator', 'Count', '150', '—'],
  ['Orders on Catalog', 'Leading Indicator', 'Percentage(%)', '78%', '—'],
];

/* Description and objective by metric name, shared by every place a metric can
   be opened from. A metric not listed here falls back to a generic line, so a
   new row in ALL_METRICS still opens a coherent modal. */
const METRIC_COPY = {
  'Average Fulfilment Time': ['The lower the better',
    'This metric captures the average time taken between a purchase order being issued and the goods being received. A lower score indicates a responsive supply base and reliable fulfilment performance.'],
  'Average Item Quantity Fill Rate': ['The higher the better',
    'This metric captures the proportion of ordered quantity that suppliers deliver in full on the first attempt. A higher score indicates dependable suppliers and fewer short shipments to reconcile.'],
  'Average Quantity Fill Ratye': ['The higher the better',
    'This metric captures the proportion of ordered quantity that suppliers deliver in full on the first attempt. A higher score indicates dependable suppliers and fewer short shipments to reconcile.'],
  'Turnover Ratio': ['The higher the better',
    'This metric captures how effectively inventory is converted into sales. A higher score indicates strong market demand and optimal stock management, signifying superior sales efficiency.'],
  'High Risk Suppliers': ['The lower the better',
    'This metric captures the share of active suppliers carrying an elevated risk score across financial, operational or ESG indicators. A lower score indicates a more resilient supply base.'],
  'High-Risk Suppliers': ['The lower the better',
    'This metric captures the share of active suppliers carrying an elevated risk score across financial, operational or ESG indicators. A lower score indicates a more resilient supply base.'],
  'Pre-Approved Contract Spend': ['The higher the better',
    'This metric captures the share of total spend placed against a negotiated contract. A higher score indicates strong contract coverage and better realisation of agreed pricing.'],
  'Lead Time': ['The lower the better',
    'This metric captures the average time between raising a replenishment request and the stock becoming available to use. A lower score indicates shorter cycles and less buffer stock required.'],
  'Inventory Value': ['The lower the better',
    'This metric captures the total book value of stock currently on hand. A lower score indicates less working capital tied up in inventory for the same level of service.'],
  'Total Warehouse Inventory': ['The lower the better',
    'This metric captures the total number of units held across all warehouses. A lower score indicates leaner stock cover, provided fill rate holds.'],
  'Total Inventory Items': ['The lower the better',
    'This metric captures the number of distinct items carried in inventory. A lower score indicates a rationalised catalogue and less complexity to manage.'],
  'Total Inventory Commodity': ['The higher the better',
    'This metric captures the share of inventory mapped to a managed commodity. A higher score indicates better category coverage and more reliable spend analytics.'],
  'Total On Contract Spend': ['The higher the better',
    'This metric captures the absolute spend placed against negotiated contracts. A higher score indicates more of the wallet is under managed terms.'],
  'Contract Spend (No PO)': ['The lower the better',
    'This metric captures contracted spend invoiced without a supporting purchase order. A lower score indicates tighter process compliance and fewer invoice exceptions.'],
  'Off Contract Invoice Spend': ['The lower the better',
    'This metric captures invoiced spend with no supporting contract. A lower score indicates fewer leakage points and better price realisation.'],
  'Spend Per Supplier': ['The higher the better',
    'This metric captures the average spend placed with each active supplier. A higher score indicates a consolidated supply base with more negotiating leverage.'],
  'Suppliers on Catalog': ['The higher the better',
    'This metric captures how many suppliers publish a punchout or hosted catalogue. A higher score indicates more guided buying and fewer free-text requests.'],
  'Orders on Catalog': ['The higher the better',
    'This metric captures the share of orders raised from a catalogue rather than free text. A higher score indicates better buying-channel compliance.'],
};

/** Every metric the info modal can open, keyed by the id passed to it. Built
    from all three sources, so a modal always shows the values of the specific
    tile or row that opened it rather than a hard-coded set. */
const METRICS_BY_ID = {};
const registerMetric = (m) => {
  /* A label scoped by spend area — `… Fill Rate (Direct)` — shares its copy
     with the unscoped metric, so the parenthetical falls away for the lookup. */
  const [objective, desc] = METRIC_COPY[m.label]
    || METRIC_COPY[m.label.replace(/\s*\([^)]*\)$/, '')] || [];
  METRICS_BY_ID[m.id] = {
    objective: objective || 'Track against the peer average',
    desc: desc || `This metric captures ${m.label} for the current period, compared against the peer average for organisations of a similar profile.`,
    ...m,
  };
};
LANDING_METRICS.forEach(registerMetric);
RECOMMENDED_METRICS.forEach((m) => registerMetric({ ...m, unit: '—' }));
ALL_METRICS.forEach(([label, type, unit, value, peer], i) => registerMetric({
  id: `all-metric-${i}`, label, type, unit, value, peer,
}));

/* One metric can appear under more than one id — an All Metrics row and an
   authored landing tile can be the same thing (Lead Time, Pre-Approved
   Contract Spend). Pinning belongs to the metric, not to the row showing it,
   so the pin is keyed by label: every place that metric appears shows the same
   pin state, and the landing widget can never hold it twice. */
const metricKey = (m) => m.label;
/** The richest entry for a label — the authored landing metric if there is one,
    since that is what carries the unit, delta and trend chart. */
const metricByLabel = (label) => LANDING_METRICS.find((m) => m.label === label)
  || Object.values(METRICS_BY_ID).find((m) => m.label === label);

/* --- preferences --------------------------------------------------------- */
const PREF_COMMODITIES = ['Industrial Components', 'Raw Materials', 'Software Licenses', 'Marketing Services'];
const PREF_COMMODITIES_ADDED = PREF_COMMODITIES.concat(
  ['Industrial Steel', 'Electrical Components', 'Plumbing Fixtures', 'Safety Equipment']);
const PREF_SUPPLIERS = ['Initech', 'Globex Corporation', 'Vandelay Industries', 'Acme Corp', 'Soylent Inc'];
const PREF_SUPPLIERS_ADDED = PREF_SUPPLIERS.concat(
  ['Stryker Fabrication', 'Volta Electric', 'AquaFlow Systems']);

const TRACK_TIPS = {
  'commodity-selected': 'Receive signals only for the specific commodities you have added to your list.',
  'commodity-all': 'Receive signals for all commodities currently available in the system.',
  'commodity-none': 'Disable tracking entirely and stop receiving signals for any commodity.',
  'supplier-selected': 'Receive signals only for the specific suppliers you have added to your list.',
  'supplier-all': 'Receive signals for all suppliers currently available in the system.',
  'supplier-none': 'Disable tracking entirely and stop receiving signals for any supplier.',
};

const SUGGESTED_COMMODITIES = ['Industrial Steel', 'Electrical Components', 'Plumbing Fixtures',
  'Safety Equipment', 'HVAC Systems', 'Construction Materials'];
const SUGGESTED_SUPPLIERS = ['Stryker Fabrication', 'Volta Electric', 'AquaFlow Systems'];

/* --- admin --------------------------------------------------------------- */
const USERS = [
  ['Sarah Johnson', 'sarah,johnson@example.com', 'Spend Pulse Admin'],
  ['Ingrid Baumgartner', 'inventory@example.com', 'Spend Pulse User'],
  ["Niamh O'Connell", 'inventory@example.com', 'Spend Pulse User'],
  ['Kenji Tanaka', 'inventory@example.com', 'Spend Pulse User'],
  ['Omar Sharif', 'opportunity@example.com', 'Spend Pulse User'],
  ['Anya Petrova', 'opportunity@example.com', 'Spend Pulse User'],
  ['Zoya Hassan', 'sirm@example.com', 'Spend Pulse User'],
  ['Pavel Volkov', 'sirm@example.com', 'Spend Pulse User'],
  ['Sakura Yamamoto', 'bls@example.com', 'Spend Pulse User'],
  ['Lin Wei', 'bls@example.com', 'Spend Pulse User'],
  ['Rajesh Patel', 'bls@example.com', 'Spend Pulse User'],
];

const SERIES_LIB = [
  ['CU 564742', 'All items in U.S. city average, all urban consumers, seasonally adjusted'],
  ['CU 564743', 'Energy in U.S. city average, all urban consumers, seasonally adjusted'],
  ['CU 564749', 'Information and information processing in U.S. city average, all urban consumers'],
  ['CU 564744', 'Commodities less food and energy commodities in U.S. city average, all urban consumers'],
];

const ALERTS = [
  ['CU 564742', 'All items in U.S. city average, all urban consumers, seasonally adjusted', '% Change', '5', '3'],
  ['CU 564743', 'Energy in U.S. city average, all urban consumers, seasonally adjusted', 'Target Price', '192', '6'],
  ['CU 564749', 'Information and information processing in U.S. city average, all urban consumers', '% increased by', '10', '3'],
  ['CU 564744', 'Commodities less food and energy commodities in U.S. city average, all urban consumers', '% decreased by', '10', '2'],
];

const ALERT_HINTS = [
  'Alerts you when value changes by 5% over 3 months.',
  'Alerts you when target value reaches 192.',
  'Alerts you when value increases by 10% over 3 months.',
  'Alerts you when value decreases by 10% over 2 months.',
];

const MAPPINGS = [
  ['Steel Mill Products', 'CU 564742', 'All items in U.S. city average, all urban consumers', 'CPI', 'U.S. City Average', 'Seasonally Adjusted'],
  ['Crude Petroleum', 'CU 564743', 'Energy in U.S. city average, all urban consumers', 'CPI', 'U.S. City Average', 'Seasonally Adjusted'],
  ['Electronic Components', 'CU 564749', 'Information and information processing in U.S. city average', 'CPI', 'U.S. City Average', 'Seasonally Adjusted'],
  ['Chemicals', 'CU 564744', 'Commodities less food and energy commodities in U.S. city average', 'CPI', 'U.S. City Average', 'Seasonally Adjusted'],
  ['Wood Products', 'CU 564745', 'Durables in U.S. city average, all urban consumers', 'CPI', 'U.S. City Average', 'Not Seasonally Adjusted'],
  ['Transport Equipment', 'CU 564746', 'Durables in U.S. city average, all urban consumers', 'CPI', 'U.S. City Average', 'Not Seasonally Adjusted'],
  ['Consumer Price Index', 'CU 564747', 'All items in U.S. city average, all urban consumers', 'CPI', 'U.S. City Average', 'Seasonally Adjusted'],
  ['Agricultural Products', 'CU 564748', 'Food and beverages in U.S. city average, all urban consumers', 'CPI', 'U.S. City Average', 'Seasonally Adjusted'],
  ['Natural Gas', 'CU 564746', 'Energy in U.S. city average, all urban consumers', 'PPI', 'U.S. City Average', 'Not Seasonally Adjusted'],
  ['Precious Metals', 'CU 564747', 'Metals in U.S. city average, all urban consumers', 'PPI', 'U.S. City Average', 'Not Seasonally Adjusted'],
];

const AUTO_MAPPED = [
  ['Steel Mill Products', 'CU 987652 | Base Materials'],
  ['Crude Petroleum', 'CU 987653 | Base Materials'],
  ['Electronic Components', 'CU 987646 | Base Materials'],
  ['Chemicals', 'CU 987650 | Base Materials'],
  ['Wood Products', 'CU 987651 | Base Materials'],
  ['Transport Equipment', 'CU 987648 | Base Materials'],
  ['Consumer Price Index', 'CU 987649 | Base Materials'],
  ['Agricultural Products', 'CU 987654 | Base Materials'],
  ['Natural Gas', 'CU 987655 | Power'],
  ['Precious Metals', 'CU 987654 | Alloys'],
  ['S&P 500 Composite', 'CU 987657 | Directory'],
  ['S&P 500 Composite', 'CU 987657 | Directory'],
  ['S&P 500 Composite', 'CU 987657 | Directory'],
  ['S&P 500 Composite', 'CU 987657 | Directory'],
  ['S&P 500 Composite', 'CU 987657 | Directory'],
  ['NASDAQ Industrial Index', 'CU 564749 | Index'],
];

const COMMODITY_TREE = [
  ['Commodities', 0], ['Raw Materials', 1], ['Metals', 2], ['Ferrous Metals', 3],
  ['Chemical Additives', 1], ['Processed Materials', 1], ['Performance Enhancer', 1],
  ['Processing Aids', 1], ['Functional Materials', 1], ['Composite Materials', 1],
  ['Adhesives and Sealants', 1], ['Surface Treatments', 1],
];

const RECOMMENDED_INDICES = [
  ['CU 564738', 'Raw Materials'],
  ['CU 293847', 'Chemical Additives'],
  ['CU 847362', 'Processed Materials'],
];

const SELECTED_INDICES = [
  'Energy in U.S. city average, all urban consumers',
  'Information and information processing in U.S. city average, all urban consumers',
  'Commodities less food and energy commodities in U.S. city average',
  'All items in U.S. city average, all urban consumers',
  'Apparel less footwear',
];

const HISTORY = [
  'John Doe', 'Emily Clark', 'Emily Clark', 'Emily Clark', 'Emily Clark',
  'Emily Clark', 'Emily Clark', 'Emily Clark', 'Emily Clark', 'Emily Clark',
].map((name) => ({
  name,
  when: 'on 4/21/2026 at 10:57 PM',
  body: 'Enabled Delayed Shipment for All Users. \nSet Commodity Priority from Critical to Tactical',
}));

const SETUP_GROUPS = [
  ['Company Setup', ['Company Information', 'Locations', 'Departments', 'Cost Centers', 'Fiscal Calendars']],
  ['Analytics', ['Analytics Setup', 'Adoption Dashboard', { label: 'Spend Pulse Setup', route: 'admin-signals' }]],
  ['Procurement', ['Requisition Settings', 'Approval Chains', 'Punchout Sites', 'Forms']],
  ['Suppliers', ['Supplier Information', 'Supplier Portal', 'Supplier Risk', 'Diversity']],
  ['Services Procurement', ['Statements of Work', 'Rate Cards', 'Timesheets']],
  ['Items and Catalogs', ['Items', 'Catalogs', 'Commodities', 'Item Master']],
  ['Inventory', ['Warehouses', 'Stock Transfers', 'Cycle Counts', 'ASN Settings']],
  ['Platform', ['Single Sign-On', 'API Keys', 'Data Retention', 'Custom Fields']],
  ['Sourcing', ['Sourcing Events', 'Award Scenarios', 'Templates']],
  ['Invoicing', ['Invoice Settings', 'Coupa Pay Terms', 'Tax Codes']],
  ['Custom Objects', ['Object Definitions', 'Object Records']],
  ['Supply Chain Collaboration', ['Trading Partners', 'Documents', 'ASN Rules']],
  ['Payments', ['Payment Methods', 'Virtual Cards', 'Remit-To Addresses']],
  ['Opportunities', ['Savings Opportunities', 'Benchmarks']],
  ['History', ['Audit Trail', 'Change History']],
  ['Integrations', ['Integration Setup', 'Flat File Loads', 'Connectors']],
  ['Working Capital', ['Early Payment Discounts', 'Supply Chain Finance']],
  ['Home Page', ['Announcements', 'Quick Links']],
  ['Financial Setup', ['Chart of Accounts', 'Currencies', 'Exchange Rates']],
  ['Contracts', ['Contract Templates', 'Clause Library', 'Contract Types']],
  ['Smart Intake and Orchestration', ['Intake Forms', 'Orchestration Flows']],
  ['Reporting', ['Report Library', 'Scheduled Reports', 'Data Warehouse']],
];

/* ===========================================================================
   2. UI HELPERS
   ======================================================================== */

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const mi = (name, cls = '') => `<span class="mi ${cls}" aria-hidden="true">${name}</span>`;

/** Mutable prototype state — mirrors the alternate frames in the Figma file. */
const state = {
  suggestionsApplied: false,   // 37:16689 → 37:16814
  prefAlertOpen: true,
  blsSignalOn: false,          // 37:19941 ↔ 37:20047
  mappingsMade: false,         // 37:20155/20569 → 37:20284
  autoMapBanner: false,        // 37:20155 → 37:20569
  signalsView: 'card',         // 37:24429 ↔ 37:24498
  chartRange: '1Y',
  hiddenSeries: new Set(),
  seriesTab: 'CPI',
  alertCondition: '% Change by',
  track: { commodity: 'selected', supplier: 'selected' },
  signalToggles: SIGNAL_CATALOGUE.map((r) => r[3]),
  priceChart: true,
  selectedCommodity: 'Ferrous Metals',

  /* Agent Studio, for signal 5's Refine Agent Parameters action. The built-in
     agent cannot be edited, so refining it is two steps — copy, then run — and
     the copy has to survive navigating away to the CFO Dashboard and back. */
  agentCopied: false,
  agentRun: false,

  /* Which of signal 3's suggested alternate suppliers have been picked, by name.
     Nothing is selected to begin with: Navi suggests two, and choosing one is
     the reader's call — the form used to render them as already Selected and
     disabled, which claimed a decision nobody had made. */
  altSuppliers: new Set(),

  /* Base prices the Analytics Agent has filled in on the drafted sourcing
     event, keyed by line index. Empty to begin with, which is the state the
     Draft page is in when it opens (212:53121 leaves Base Price blank behind
     its sparkle) — pressing the sparkle is what puts a number here. */
  basePrice: {},

  /* Per-card signal state, keyed by LANDING_SIGNALS[].id. This is the R46
     state machine's memory: the card renders from here, and every transition
     (view, pin, act, complete, dismiss) is a write followed by a re-render. */
  signals: Object.fromEntries(SIGNALS.map((s) => [s.id, {
    status: s.status,
    pinned: !!s.pinned,
    actionTaken: !!s.actionTaken,
    dismissed: s.status === 'Dismissed',
    /* Which of a multi-action signal's actions have been taken, keyed by
       action id. `actionTaken` above stays the signal-level answer — any one
       action unlocks Mark As Completed and swaps the card's Navi box for the
       Last Updated line — and this says which ones, so three panels can be in
       three different states inside one drawer. */
    actions: {},
  }])),

  /* What the landing Metrics widget shows, in pin order. Keyed by
     `metricKey()` rather than by id, because the same metric appears under
     three different ids (a landing tile, a Navi recommendation and an All
     Metrics row) and all of them are one pin. Seeded with the authored
     landing tiles, which is why 'Lead Time' and 'Pre-Approved Contract Spend'
     already read as pinned in the drawer — as they do in the Figma frame. */
  metricPins: new Set(LANDING_METRICS.map(metricKey)),
};

/** Live state for a signal, falling back to its authored defaults. */
const sig = (s) => state.signals[s.id]
  || { status: s.status, pinned: false, actionTaken: false, actions: {} };

/** The actions a signal offers, as a list. A signal authoring the singular
    `action` gets one entry built from it plus its card `cta`, so everything
    downstream — the drawer, the dispatch, the card — reads one shape. */
function signalActions(s) {
  if (s.actions && s.actions.length) return s.actions;
  if (!s.action) return [];
  return [{
    id: 'primary', pick: true, cta: s.cta,
    overlay: s.ctaOverlay, doneCta: s.doneCta, ...s.action,
  }];
}

/** Whether one action of a signal has been taken. Single-action signals keep
    answering from `actionTaken`, so nothing about signals 1–4 changed. */
const actionTaken = (s, a) => (s.actions && s.actions.length
  ? !!(sig(s).actions || {})[a.id]
  : sig(s).actionTaken);

/** Look a signal up by id — used by the drawer and the action dispatch. */
const signalById = (id) => SIGNALS.find((s) => s.id === id);

/** Pinned first, then authored order — the ordering both views share. */
const byPinned = (list) => list
  .map((s, i) => ({ s, i, pinned: sig(s).pinned }))
  .sort((a, b) => (b.pinned - a.pinned) || (a.i - b.i))
  .map((r) => r.s);

/** The landing rail: dismissed signals drop out of it, pinned ones lead it. */
const visibleSignals = () => byPinned(LANDING_SIGNALS.filter((s) => !sig(s).dismissed));

/** Signals › All Signals: every signal, including dismissed ones (they have
    their own view in the rail), in the same pinned-first order as the rail. */
const allSignals = () => byPinned(SIGNALS);

/** The card and drawer's `Last Updated by:` line, assembled from by/at. */
const metaLine = (s) => (s.by
  ? `Last Updated by: ${s.by}${s.at ? ` at ${s.at}` : ''}`
  : '');

function statusChip(status) {
  const key = String(status).toLowerCase();
  return `<span class="status status--${key}">${esc(status)}</span>`;
}

/** Clarity 2.1 `Button`. `kind` maps to Kind × Variant (primary = Primary
    Contained, secondary = Secondary Contained, outline = Secondary Outlined,
    ghost = Primary Text); `sm`/`lg` pick the Small/Large size, which scale the
    radius, padding, type and icon together. */
function btn(label, opts = {}) {
  const { kind = 'primary', act = '', arg = '', icon = '', sm = false, lg = false,
    disabled = false, cls = '' } = opts;
  const size = sm ? ' btn--sm' : lg ? ' btn--lg' : '';
  return `<button class="btn btn--${kind}${size}${disabled ? ' is-disabled' : ''} ${cls}"
    ${act ? `data-act="${act}"` : ''} ${arg ? `data-arg="${esc(arg)}"` : ''}
    ${disabled ? 'disabled' : ''}>${icon ? mi(icon, sm ? 'mi--xs' : lg ? 'mi--20' : 'mi--sm') : ''}${esc(label)}</button>`;
}

function searchbox(placeholder, cls = '') {
  return `<label class="searchbox ${cls}">${mi('search', 'mi--sm')}
    <input type="search" placeholder="${esc(placeholder)}" aria-label="${esc(placeholder)}"></label>`;
}

function infoIcon(tipKey) {
  return `<span class="info-i" data-tipkey="${esc(tipKey)}" tabindex="0" role="button"
    aria-label="More information">${mi('info', 'mi--xs')}</span>`;
}

function radio(name, value, label, tipKey) {
  const on = state.track[name] === value;
  return `<span class="radio-wrap"><button class="radio${on ? ' on' : ''}" role="radio"
      aria-checked="${on}" data-act="track" data-arg="${name}:${value}"><i></i>${esc(label)}</button>
    ${tipKey ? infoIcon(tipKey) : ''}</span>`;
}

function tabs(items, current) {
  return `<div class="tabs" role="tablist">${items.map((it) => `
    <button role="tab" aria-selected="${it.route === current}"
      class="${it.route === current ? 'active' : ''}"
      data-act="go" data-arg="${it.route}">${esc(it.label)}</button>`).join('')}</div>`;
}

/* A column is either a label or `{label, cls}` — the class lands on the `th`
   and on every `td` beneath it, which is how a table states its own column
   widths and alignment instead of relying on `:last-child` guesswork. */
function table(cols, rows) {
  const cs = cols.map((c) => (typeof c === 'string' ? { label: c, cls: '' } : c));
  const klass = (...parts) => {
    const c = parts.filter(Boolean).join(' ');
    return c ? ` class="${c}"` : '';
  };
  return `<div class="table-scroll"><table class="tbl">
    <thead><tr>${cs.map((c) => `<th${klass(c.cls)}>${esc(c.label)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr${r.attrs || ''}>${r.cells.map((c, i) =>
      `<td data-label="${esc((cs[i] || {}).label || '')}"${klass(c.cls, (cs[i] || {}).cls)}>${c.html}</td>`
    ).join('')}</tr>`).join('')}</tbody></table></div>`;
}
const cell = (html, cls) => ({ html, cls });

function pager(text = 'Showing 1 -10 out of 30', pages = '1 of 24') {
  return `<div class="pager"><span>${esc(text)}</span><span class="spacer"></span>
    <button class="pager__btn" aria-label="Previous page">${mi('chevron_left', 'mi--sm')}</button>
    <span>${esc(pages)}</span>
    <button class="pager__btn" aria-label="Next page">${mi('chevron_right', 'mi--sm')}</button></div>`;
}

/** The third-party provider badge, the 28x28 mark that leads the footer in
    161:22433. Optional on every signal and set by one — the price index, which
    is the only story here sourced from outside Coupa — so a signal earns the
    badge by naming its provider rather than by being special-cased. It leads
    the card footer and the drawer's meta row identically: same mark, same box,
    same position, since it credits the same thing in both places. */
function sourceMark(s) {
  if (!s || !s.source) return '';
  return `<img class="source-mark" src="${esc(s.source.logo)}"
    alt="${esc(s.source.name)}" title="${esc(s.source.name)}" width="28" height="28">`;
}

/* --- signal card (Signal-Card-46, node 37:25109) -------------------------
   Renders one card from its authored copy plus its live state. The four Figma
   variants (New / Viewed / Completed / Hover) are a status class plus a CSS
   :hover rule; `Pinned Signal`, `Navi Recommended` and `Show Timestamp` are
   the booleans they are in the component.                                  */
function signalCard(s) {
  const st = sig(s);
  const key = String(st.status).toLowerCase();
  /* Once the action is taken the Navi recommendation is replaced by the
     `Last Updated by:` line — the "Action taken" column of the R46 flow. */
  const showNavi = !!s.navi && !st.actionTaken;
  const meta = metaLine(s);
  const showMeta = !!meta && st.actionTaken;

  /* `is-dismissing` is the collapse animation and is added by the dismiss
     action on the live node — never rendered from state, or the card would
     come back at opacity 0 in Signals › All Signals, which does list
     dismissed signals. The persistent look is the `--dismissed` variant.  */
  return `<article class="signal-card signal-card--${key}"
      data-signal="${s.id}" data-act="open-signal" data-arg="${s.id}"
      tabindex="0" role="button" aria-label="${esc(s.title)}, ${esc(st.status)}">
    <div class="signal-card__content">
      <div class="signal-card__head">
        <h4 class="signal-card__title" title="${esc(s.title)}">${esc(s.title)}</h4>
        <button class="pin${st.pinned ? ' is-pinned' : ''}" data-act="pin" data-arg="${s.id}"
          data-stop="1" aria-pressed="${st.pinned}"
          aria-label="${st.pinned ? 'Unpin' : 'Pin'} ${esc(s.title)}"
          >${mi('push_pin', 'mi--sm')}</button>
      </div>
      <p class="signal-card__body">${esc(s.body)}</p>
    </div>
    ${showNavi ? `<div class="navi-box">${mi('auto_awesome', 'mi--sm')}
      <span>${esc(s.navi)}</span></div>` : ''}
    ${showMeta ? `<div class="signal-card__meta">${esc(meta)}</div>` : ''}
    <div class="signal-card__foot">
      <div class="signal-card__foot-meta">
        ${sourceMark(s)}${statusChip(st.status)}<span class="ago">${esc(s.ago)}</span>
      </div>
      <div class="signal-card__foot-acts">
        ${st.status === 'Completed' || st.status === 'Dismissed' ? '' : `
          <button class="btn btn--primary btn--sm" data-stop="1"
            data-act="signal-action" data-arg="${s.id}"
            >${st.actionTaken ? '' : mi('auto_awesome', 'mi--sm')}${esc(s.cta)}</button>`}
        ${st.dismissed ? '' : `
          <button class="icon-btn" data-act="dismiss-signal" data-arg="${s.id}" data-stop="1"
            aria-label="Dismiss ${esc(s.title)}">${mi('remove_circle_outline', 'mi--sm')}</button>`}
      </div>
    </div>
  </article>`;
}

/* --- Trend Chart (component set 104:15896) -------------------------------
   The 80x32.5 sparkline in the corner of a metric tile. `Property 1` in Figma
   is Positive / Negative / Neutral, and the state changes only the stroke and
   fill colour plus which curve is drawn — the three layers, their offsets and
   the 4px end dot are identical across variants.

   Each variant is three stacked vectors, all inset x=1 in the 80px frame:
     peer  a 2-2 dashed #d2d8de line — the peer benchmark
     area  the closed curve under `line`, filled with a 10%-opacity fade
     line  the metric's own trend, 1px round-capped, in the state colour
   `y` is the layer's own offset inside the frame, so the paths below are the
   raw Figma path data with no transform applied.                            */
const TREND_PATHS = {
  positive: {
    peerY: 6.094, peer: 'M 0 0 C 6.12 0 7.03 3.76 13.16 3.76 C 25.83 4.71 20.62 11.1 31.68 13.92 C 37.36 15.37 41.35 13.61 47.27 14.55 C 53.8 15.59 56.74 19.3 62.87 19.3 C 68.99 19.3 70.88 18.03 77 18.03',
    areaY: 0, area: 'M 0 0 C 6.28 0 9.32 6.22 15.6 6.22 C 21.88 6.22 24.92 17.18 31.2 17.18 C 37.48 17.18 40.52 9.36 46.8 9.36 C 53.08 9.36 56.12 21.86 62.4 21.86 C 68.68 21.86 71.72 18.72 78 18.72 L 78 32.5 L 0 32.5 L 0 0 Z',
    lineY: 1.016, line: 'M 0 0 C 6.12 0 10.05 6.07 16.17 6.07 C 22.3 6.07 25.25 16.76 31.37 16.76 C 37.5 16.76 40.45 9.13 46.57 9.13 C 52.7 9.13 55.65 21.33 61.77 21.33 C 67.9 21.33 69.88 17.5 76 17.5',
  },
  negative: {
    peerY: 15, peer: 'M 0 2 C 6.12 2 7.88 0 14 0 C 26.67 0.95 20.62 2.19 31.68 5.01 C 37.36 6.46 41.35 4.7 47.27 5.65 C 53.8 6.69 54.88 7 61 7 C 67.12 7 71.38 1 77.5 1',
    areaY: 9.5, area: 'M 0 0 C 6.28 0 22 6 22 6 C 22 6 24.72 8 31 8 C 37.28 8 41.72 5.5 48 5.5 C 54.28 5.5 56.12 12.2 62.4 12.2 C 68.68 12.2 71.72 9.01 78 9.01 L 78 23 L 0 23 L 0 0 Z',
    lineY: 9.5, line: 'M 0 0 C 6.12 0 16.5 4 16.5 4 C 16.5 4 25.25 8.28 31.37 8.28 C 37.5 8.28 40.38 5 46.5 5 C 52.62 5 55.65 12.84 61.77 12.84 C 67.9 12.84 69.88 9.02 76 9.02',
  },
  neutral: {
    peerY: 6.094, peer: 'M 0 0 C 6.12 0 7.03 3.76 13.16 3.76 C 25.83 4.71 20.62 11.1 31.68 13.92 C 37.36 15.37 41.35 13.61 47.27 14.55 C 53.8 15.59 56.74 19.3 62.87 19.3 C 68.99 19.3 70.88 18.03 77 18.03',
    areaY: 1, area: 'M 0 0 C 6.28 0 10.22 10.5 16.5 10.5 C 22.78 10.5 24.92 16.18 31.2 16.18 C 37.48 16.18 46 17.5 46 17.5 C 46 17.5 56.22 17.5 62.5 17.5 C 68.78 17.5 71.22 17 77.5 17 L 78 31.5 L 0 31.5 L 0 0 Z',
    lineY: 1.016, line: 'M 0 0 C 6.12 0 9.88 10.48 16 10.48 C 22.12 10.48 25.25 16.76 31.37 16.76 C 37.5 16.76 46.5 17.48 46.5 17.48 L 58.5 17.48 C 58.5 17.48 70.38 16.76 76.5 16.76',
  },
};

/** The tile's delta direction mapped to the Trend Chart variant. `flat` (the
    `No Change` chip) is the Neutral variant, matching High-Risk Suppliers in
    the Figma frame. A metric with no delta gets no chart, as in the file. */
const trendState = (dir) => (dir === 'up' ? 'positive' : dir === 'down' ? 'negative' : 'neutral');

/** One Trend Chart instance. Rendered inline rather than as an exported asset
    because the curve is a data shape and the stroke colour is state-driven —
    the geometry is the file's, taken verbatim from the component set.

    The reveal is Figma's `Rectangle 20`: a curtain over the chart that wipes
    left to right, so the sparkline draws itself in. Here it is a clip-path on
    a wrapper instead of an opaque rectangle, so the tile's own background
    (white, or #f5f7fa on hover) shows through unchanged. */
function trendChart(dir) {
  const state = trendState(dir);
  const p = TREND_PATHS[state];
  const gid = `trend-fade-${state}`;
  return `<span class="trend" data-trend="${state}" aria-hidden="true">
    <svg class="trend__svg" viewBox="0 0 80 32.5" width="80" height="32.5"
        fill="none" xmlns="http://www.w3.org/2000/svg" focusable="false">
      <defs>
        <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="45%" class="trend__stop-a"/>
          <stop offset="100%" stop-color="#0342b0" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path class="trend__peer" transform="translate(1 ${p.peerY})" d="${p.peer}"/>
      <path class="trend__area" transform="translate(1 ${p.areaY})" d="${p.area}"
        fill="url(#${gid})"/>
      <path class="trend__line" transform="translate(1 ${p.lineY})" d="${p.line}"/>
      <circle class="trend__dot" cx="77" cy="18" r="2"/>
    </svg>
  </span>`;
}

/* --- metric tile (Leading-Indicators, node 37:25114) ---------------------
   The delta pill carries its own arrow: up and down are the trend, `flat` (No
   Change) is the neutral grey pill with no arrow. Card-NCT-KPI (104:15917)
   adds the Trend Chart, absolutely placed in the tile's top-right corner so
   it overlaps the value row exactly as it does in the file.                  */
function metricTile(m, clickable) {
  const dir = m.dir === 'up' ? ' delta--up' : m.dir === 'down' ? ' delta--down' : '';
  const arrow = m.dir === 'up' ? mi('arrow_upward', 'mi--xs')
    : m.dir === 'down' ? mi('arrow_downward', 'mi--xs') : '';
  return `<div class="metric-tile${m.delta ? ' metric-tile--trend' : ''}"${clickable
    ? ` data-act="overlay" data-arg="metric-info:${m.id}" tabindex="0" role="button"
        aria-label="${esc(m.label)}, ${esc(m.value)}. Open details"` : ''}>
    <span class="metric-tile__label">
      ${m.lead ? mi('speed', 'mi--20') : ''}<span class="clip">${esc(m.label)}</span>
      ${m.lead ? mi('info', 'mi--20 mi--info') : ''}
    </span>
    <span class="metric-tile__value">${esc(m.value)}</span>
    <span class="metric-tile__peer">Peer Average: <b>${esc(m.peer)}</b></span>
    ${m.delta ? `<span class="delta${dir}">${arrow}${esc(m.delta)}</span>` : ''}
    ${m.delta ? trendChart(m.dir) : ''}
  </div>`;
}

/* --- metric pinning (37:25275) -------------------------------------------
   Metric Card_46 / Property 1=card-pin puts a 24×24 pin where the plain card
   puts its info icon. `data-stop` keeps the click on the pin — the card itself
   still opens the info modal. `where` only changes the glyph's colour token:
   on a card it is `color/text/link`, in the table's Actions column it is
   `color/text/t3`.                                                          */
const metricPinned = (m) => state.metricPins.has(metricKey(m));

function metricPin(m, where) {
  const on = metricPinned(m);
  return `<button class="mpin mpin--${where}${on ? ' is-pinned' : ''}"
    data-act="pin-metric" data-arg="${esc(m.id)}" data-stop="1" aria-pressed="${on}"
    aria-label="${on ? 'Remove' : 'Add'} ${esc(m.label)} ${on ? 'from' : 'to'} the Metrics widget"
    >${mi('push_pin', 'mi--20')}</button>`;
}

/** Navi-Recommended card (Metric Card_46 / card-pin): the label row carries the
    pin instead of the info icon, and the tile is a fixed 202px so the row
    scrolls horizontally rather than reflowing. */
function metricTilePin(m) {
  return `<div class="metric-tile metric-tile--pin${metricPinned(m) ? ' is-pinned' : ''}"
    data-act="overlay" data-arg="metric-info:${m.id}" tabindex="0" role="button"
    aria-label="${esc(m.label)}, ${esc(m.value)}. Open details">
    <span class="metric-tile__label">
      <span class="clip">${esc(m.label)}</span>${metricPin(m, 'card')}
    </span>
    <span class="metric-tile__value">${esc(m.value)}</span>
    <span class="metric-tile__peer">Peer Average: <b>${esc(m.peer)}</b></span>
  </div>`;
}

/** What the landing Metrics widget renders: every pinned metric, in pin order,
    each as its richest entry so a metric pinned from a bare table row still
    gets the unit and trend chart the authored tile has. */
function visibleMetrics() {
  return [...state.metricPins].map(metricByLabel).filter(Boolean);
}

/* --- charts -------------------------------------------------------------- */

/** The landing legend, kept to a single line. How many chips actually fit
    depends on their labels and the viewport, so the count can't be decided
    here — every chip is rendered and `fitLegend()` measures after layout, then
    hides the overflow behind a `+N indices` chip. Rendering them all first also
    means the overflow list is complete whatever the width. */
function chartLegend() {
  return `<div class="legend" data-legend>
    ${CHART_SERIES.map((s, i) => `
      <span class="legend__chip${state.hiddenSeries.has(i) ? ' is-off' : ''}" data-ci="${i}">
        <span class="dot" style="background:${s.color}"></span>
        <span class="label" title="${esc(s.label)}">${esc(s.label)}</span>
        <button class="x" data-act="toggle-series" data-arg="${i}"
          aria-label="Remove ${esc(s.label)}">${mi('close', 'mi--xs')}</button>
      </span>`).join('')}
    <button class="legend__more" data-act="legend-more" hidden aria-expanded="false">
      <span class="legend__more-n"></span>${mi('expand_more', 'mi--xs')}
    </button>
  </div>`;
}

/** Hides whichever chips fall past the first line and labels the overflow chip.
    Runs on render and on resize. The `+N` chip is itself part of the line, so
    the fit is computed with room for it reserved. */
function fitLegend() {
  document.querySelectorAll('[data-legend]').forEach((legend) => {
    const more = legend.querySelector('.legend__more');
    const chips = [...legend.querySelectorAll('.legend__chip')];
    if (!more || !chips.length) return;
    /* Measure from a clean slate — a previous pass' hidden chips would
       otherwise make everything look like it fits, and its `--tight` class
       would let every chip shrink into the line, so all five would measure as
       fitting and the legend would then blow past the widget once the class
       came back off. */
    chips.forEach((c) => c.removeAttribute('hidden'));
    legend.classList.remove('legend--tight');
    more.hidden = false;
    more.querySelector('.legend__more-n').textContent = `+${chips.length} indices`;
    if (legend.dataset.expanded === 'true') { more.hidden = true; return; }

    const gap = parseFloat(getComputedStyle(legend).columnGap) || 0;
    const room = legend.clientWidth;
    const moreW = more.offsetWidth;
    let used = 0, shown = 0;
    for (const c of chips) {
      const w = c.offsetWidth;
      const rest = chips.length - shown - 1;
      /* The `+N` chip only needs room if something is still left over. */
      const tail = rest > 0 ? gap + moreW : 0;
      if (used + (shown ? gap : 0) + w + tail > room) break;
      used += (shown ? gap : 0) + w;
      shown += 1;
    }
    /* Never collapse to nothing: one chip stays even if it has to ellipsis.
       That chip is wider than the room left beside the `+N` chip, so it is the
       one case where a chip must be allowed to shrink — flagged for CSS rather
       than sized here, since the label should ellipsis, not the whole chip. */
    const tight = shown === 0;
    if (tight) shown = 1;
    legend.classList.toggle('legend--tight', tight);
    chips.forEach((c, i) => { c.hidden = i >= shown; });
    const hidden = chips.length - shown;
    more.hidden = hidden === 0;
    more.querySelector('.legend__more-n').textContent =
      `+${hidden} ${hidden === 1 ? 'index' : 'indices'}`;
    more.setAttribute('aria-label', `Show ${hidden} more ${hidden === 1 ? 'index' : 'indices'}`);
  });
}

/** Multi-series line chart with the Figma hover band (ON_HOVER → 37:22890).
    Loads in the way a line chart usually does: the axes come up first with a
    shimmering placeholder over the plot area, then the series draw themselves
    left to right as the placeholder clears. See `.plot--load` in the CSS. */
function trendsChart() {
  const W = 1200, H = 250, X0 = 50, STEP = 100;
  const px = (i) => X0 + i * STEP;
  const grid = [0, 62.5, 125, 187.5, 250].map((y) =>
    `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#e1e8ef" stroke-width="1" vector-effect="non-scaling-stroke"/>`).join('')
    + MONTHS.map((_, i) => `<line x1="${px(i)}" y1="0" x2="${px(i)}" y2="${H}"
        stroke="#e1e8ef" stroke-width="1" vector-effect="non-scaling-stroke"/>`).join('');

  const shown = CHART_SERIES.map((s, si) => ({ s, si })).filter(({ si }) => !state.hiddenSeries.has(si));
  const lines = shown.map(({ s }) => {
    const pts = s.y.map((y, i) => `${px(i)},${y}`).join(' ');
    return `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="2"
      vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/>`;
  }).join('');
  const dots = shown.map(({ s }) => s.y.map((y, i) =>
    `<circle cx="${px(i)}" cy="${y}" r="3.5" fill="${s.color}"/>`).join('')).join('');

  const bands = MONTHS.map((m, i) => `<rect class="hover-band is-live" data-band="${i}"
      x="${px(i) - STEP / 2}" y="0" width="${STEP}" height="${H}"/>`).join('');

  return `<div class="plot plot--load">
    <div class="plot__ytitle">Change % (MoM)</div>
    <div class="plot__ylabels" aria-hidden="true">
      ${[[0, '10'], [62.5, '5'], [125, '0'], [187.5, '-5'], [250, '-10']]
        .map(([t, l]) => `<span style="top:${t / 250 * 100}%">${l}</span>`).join('')}
    </div>
    <div class="plot__svgwrap">
      <svg class="plot__svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"
        role="img" aria-label="Price index trends, change percent month over month">
        ${grid}
        <g class="plot__lines">${lines}</g>
        <g class="plot__dots">${dots}</g>
        ${bands}
      </svg>
      ${plotSkeleton(W, H, px)}
    </div>
    <div class="plot__xlabels">${MONTHS.map((m) => `<span>${m}</span>`).join('')}</div>
  </div>`;
}

/** The loading placeholder that sits over the plot area until the series draw
    in: the real gridlines, two flat grey stand-in traces and a sheen that
    sweeps across. `aria-hidden` because the actual data is in the DOM the whole
    time — this is a visual state, so there is nothing to announce. */
function plotSkeleton(W, H, px) {
  const grid = [0, 62.5, 125, 187.5, 250].map((y) =>
    `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#e1e8ef" stroke-width="1" vector-effect="non-scaling-stroke"/>`).join('');
  /* Two gentle waves derived from the month count, so the placeholder keeps
     its shape whatever the series are — no hand-placed points to drift. */
  const wave = (phase, amp) => MONTHS
    .map((_, i) => `${px(i)},${(H / 2 + Math.sin(i / 1.7 + phase) * amp).toFixed(1)}`).join(' ');
  return `<div class="plot__skel" aria-hidden="true">
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      ${grid}
      <polyline points="${wave(0, 46)}" fill="none" stroke="#dbe3ec" stroke-width="8"
        vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/>
      <polyline points="${wave(2.2, 30)}" fill="none" stroke="#e8eef4" stroke-width="8"
        vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <span class="plot__sheen"></span>
  </div>`;
}

/** Single-series index chart used by the signal detail and add-alert preview.
    `fmt` formats the y-axis labels — index values print as they are, prices need
    their decimals kept, so `2` doesn't sit above `1.9`. */
function indexChart(values, yTicks, yTitle, fmt = (t) => String(t)) {
  const W = 1200, H = 250, X0 = 50, STEP = 100;
  const max = yTicks[0], min = yTicks[yTicks.length - 1];
  const sy = (v) => (max - v) / (max - min) * H;
  const pts = values.map((v, i) => `${X0 + i * STEP},${sy(v).toFixed(1)}`).join(' ');
  const grid = yTicks.map((t) => `<line x1="0" y1="${sy(t)}" x2="${W}" y2="${sy(t)}"
      stroke="#e1e8ef" stroke-width="1" vector-effect="non-scaling-stroke"/>`).join('');
  return `<div class="plot">
    <div class="plot__ytitle">${esc(yTitle)}</div>
    <div class="plot__ylabels" aria-hidden="true">
      ${yTicks.map((t) => `<span style="top:${sy(t) / H * 100}%">${esc(fmt(t))}</span>`).join('')}
    </div>
    <div class="plot__svgwrap">
      <svg class="plot__svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img"
        aria-label="${esc(yTitle)} over the last year">
        ${grid}
        <polyline points="${pts}" fill="none" stroke="#0059d6" stroke-width="2" vector-effect="non-scaling-stroke"
          stroke-linejoin="round" stroke-linecap="round"/>
        ${values.map((v, i) => `<circle cx="${X0 + i * STEP}" cy="${sy(v).toFixed(1)}" r="3.5" fill="#0059d6"/>`).join('')}
      </svg>
    </div>
    <div class="plot__xlabels">${MONTHS.map((m) => `<span>${m}</span>`).join('')}</div>
  </div>`;
}

/* ===========================================================================
   Analytics dashboard charts (207:26864)
   ---------------------------------------------------------------------------
   The CFO Dashboard's tiles: a big single figure, a combo of bars against a
   line on two axes, a grouped bar pair, and a Pareto (descending bars with a
   cumulative % curve). All four are the same shape underneath — a plot area in
   a fixed viewBox with `preserveAspectRatio="none"`, value labels positioned in
   percentages outside it — which is what `.plot` already does for the line
   charts, so they reuse its grid, its y-label mechanic and its load-in.

   Bars are `<rect>`s sized from the data rather than drawn paths, so the
   numbers and the picture cannot disagree.
   ======================================================================== */

/* The reference's two-colour scheme, sampled from the exported frames rather
   than guessed: the light blue is the measure being examined, the grey is
   whatever it is being compared against. The `%`-axis line is the darker
   brand blue so it separates from its own bars. */
const DASH_BLUE = '#6eb6e3';
const DASH_LINE = '#3870c7';
const DASH_GREY = '#a3a8a8';

/** A dashboard tile. `wide` spans both columns of the grid. */
function dashTile(title, body, opts = {}) {
  return `<article class="dash-tile${opts.wide ? ' dash-tile--wide' : ''}">
    <div class="dash-tile__head"><h4>${esc(title)}</h4>
      ${opts.note ? `<span class="muted">${esc(opts.note)}</span>` : ''}
    </div>
    ${mi('language', 'mi--sm dash-tile__glyph')}
    ${body}
  </article>`;
}

/** Category axis labels, shortened. A Pareto's x-axis carries account and
    commodity names in full, which at thirteen of them would each be longer than
    the space between two bars — the reference truncates them with an ellipsis
    for exactly this reason. The full name stays in the `title`. */
const dashAxisLabel = (s) => (s.length > 20 ? `${s.slice(0, 19).trimEnd()}…` : s);

/** The single-figure tiles down the left of the reference: a coloured label
    over one large number. Not `metricTile` — these have no peer average, no
    delta pill and no sparkline, and the number is the whole tile. */
function dashFigure(label, value, opts = {}) {
  return `<article class="dash-fig${opts.tone ? ` dash-fig--${opts.tone}` : ''}">
    ${mi('language', 'mi--sm dash-tile__glyph')}
    <span class="dash-fig__label">${esc(label)}</span>
    <b>${esc(value)}</b>
    ${opts.sub ? `<span class="dash-fig__sub">${esc(opts.sub)}</span>` : ''}
  </article>`;
}

/** A legend row under a chart — a swatch per series, dot for a line, block for
    bars, matching how each one is drawn. */
function dashLegend(items) {
  return `<ul class="dash-legend">${items.map(([label, color, kind]) => `<li>
    <i class="dash-legend__${kind === 'line' ? 'line' : 'dot'}"
      style="--c:${color}"></i>${esc(label)}</li>`).join('')}</ul>`;
}

/** Shared plot chrome: y ticks down the left, optional right-hand axis, x
    labels underneath, and the skeleton + `.plot--load` so a dashboard chart
    loads in exactly like the line charts elsewhere. `svg` is the plot content
    in a 0 0 W H user space. */
function dashPlot(o) {
  const H = 250;
  const yTicks = o.yTicks.map(([v, label]) =>
    `<span style="top:${(1 - v) * 100}%">${esc(label)}</span>`).join('');
  const rTicks = (o.rTicks || []).map(([v, label]) =>
    `<span style="top:${(1 - v) * 100}%">${esc(label)}</span>`).join('');
  return `<div class="plot plot--load dash-plot${o.rTitle ? ' dash-plot--dual' : ''}">
    <div class="plot__ytitle">${esc(o.yTitle)}</div>
    <div class="plot__ylabels" aria-hidden="true">${yTicks}</div>
    <div class="plot__svgwrap">
      <svg class="plot__svg" viewBox="0 0 ${o.W} ${H}" preserveAspectRatio="none"
        role="img" aria-label="${esc(o.label)}">
        ${[0, 0.25, 0.5, 0.75, 1].map((f) => `<line x1="0" y1="${f * H}" x2="${o.W}"
          y2="${f * H}" stroke="#e1e8ef" stroke-width="1"
          vector-effect="non-scaling-stroke"/>`).join('')}
        ${o.svg}
      </svg>
      ${plotSkeleton(o.W, H, (i) => (i + 0.5) / MONTHS.length * o.W)}
    </div>
    ${o.rTitle ? `<div class="plot__rlabels" aria-hidden="true">${rTicks}</div>
      <div class="plot__rtitle">${esc(o.rTitle)}</div>` : ''}
    <div class="plot__xlabels${o.tilt ? ' plot__xlabels--tilt' : ''}"
      >${o.xLabels.map((l) => `<span title="${esc(l)}">${o.tilt
        ? `<i>${esc(dashAxisLabel(l))}</i>` : esc(l)}</span>`).join('')}</div>
    ${o.xTitle ? `<div class="plot__xtitle">${esc(o.xTitle)}</div>` : ''}
  </div>`;
}

/** Bars against a line on two independent axes — the reference's Quarterly
    Spending Trends. `bars` and `line` are already normalised to 0–1 against
    their own axis, which is what having two axes means: each series is scaled
    by its own maximum, so neither flattens the other. */
function dashComboChart(o) {
  const W = 1000, H = 250, n = o.bars.length, step = W / n;
  const bw = step * 0.42;
  const bars = o.bars.map((v, i) => `<rect class="dash-bar" x="${(i * step + (step - bw) / 2).toFixed(1)}"
    y="${((1 - v) * H).toFixed(1)}" width="${bw.toFixed(1)}" height="${(v * H).toFixed(1)}"
    fill="${DASH_BLUE}" style="--bar-i:${i}"/>`).join('');
  const pts = o.line.map((v, i) => `${(i * step + step / 2).toFixed(1)},${((1 - v) * H).toFixed(1)}`);
  const svg = `<g class="dash-bars">${bars}</g>
    <g class="plot__lines"><polyline points="${pts.join(' ')}" fill="none"
      stroke="${DASH_LINE}" stroke-width="2" vector-effect="non-scaling-stroke"
      stroke-linejoin="round" stroke-linecap="round"/></g>
    <g class="plot__dots">${pts.map((p) => {
      const [x, y] = p.split(',');
      return `<circle cx="${x}" cy="${y}" r="4" fill="${DASH_LINE}"/>`;
    }).join('')}</g>`;
  return dashPlot({ ...o, W, svg });
}

/** Two bars per category — the reference's YoY comparison, where the current
    period is a thin blue bar beside a tall grey one for the year before, each
    labelled with its own value because the two axes differ by orders of
    magnitude and the eye cannot read the small one off the tall one's scale. */
function dashGroupedChart(o) {
  const W = 1000, H = 250, n = o.groups.length, step = W / n;
  const bw = step * 0.2;
  const bars = o.groups.map(([, a, b, aLabel, bLabel], i) => {
    const x0 = i * step + step / 2 - bw - 4;
    return `<rect class="dash-bar" x="${x0.toFixed(1)}" y="${((1 - a) * H).toFixed(1)}"
        width="${bw.toFixed(1)}" height="${Math.max(a * H, 1.5).toFixed(1)}" fill="${DASH_BLUE}"
        style="--bar-i:${i * 2}"/>
      <rect class="dash-bar" x="${(x0 + bw + 8).toFixed(1)}" y="${((1 - b) * H).toFixed(1)}"
        width="${bw.toFixed(1)}" height="${(b * H).toFixed(1)}" fill="${DASH_GREY}"
        style="--bar-i:${i * 2 + 1}"/>
      <text class="dash-vlabel dash-vlabel--blue" x="${(x0 + bw / 2).toFixed(1)}"
        y="${Math.min((1 - a) * H - 6, H - 6).toFixed(1)}">${esc(aLabel)}</text>
      <text class="dash-vlabel" x="${(x0 + bw * 1.5 + 8).toFixed(1)}"
        y="${((1 - b) * H - 6).toFixed(1)}">${esc(bLabel)}</text>`;
  }).join('');
  return dashPlot({ ...o, W, svg: `<g class="dash-bars">${bars}</g>` });
}

/** Pareto: descending bars with the cumulative share as a line on the right
    axis — the reference's Spend in Top Accounts and Top Commodity of Spend.
    The cumulative curve is computed from the bars rather than authored, so the
    80% crossing is wherever the data actually puts it. */
function dashParetoChart(o) {
  const W = 1000, H = 250, n = o.bars.length, step = W / n;
  const bw = Math.min(step * 0.62, 26);
  const total = o.bars.reduce((a, b) => a + b, 0);
  let run = 0;
  const cum = o.bars.map((v) => { run += v; return run / total; });
  /* Against the axis's own top tick, not against the tallest bar — scaling to
     the data would draw the largest account at 100% of the plot height and so
     label it with whatever the top tick says, which is a different number. */
  const bars = o.bars.map((v, i) => `<rect class="dash-bar" x="${(i * step + (step - bw) / 2).toFixed(1)}"
    y="${((1 - v / o.yMax) * H).toFixed(1)}" width="${bw.toFixed(1)}"
    height="${Math.max(v / o.yMax * H, 2).toFixed(1)}" fill="${DASH_BLUE}"
    style="--bar-i:${i}"/>`).join('');
  const pts = cum.map((c, i) => `${(i * step + step / 2).toFixed(1)},${((1 - c) * H).toFixed(1)}`);
  const svg = `<g class="dash-bars">${bars}</g>
    <g class="plot__lines"><polyline points="${pts.join(' ')}" fill="none" stroke="${DASH_LINE}"
      stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></g>
    <g class="plot__dots">${pts.map((p) => {
      const [x, y] = p.split(',');
      return `<circle cx="${x}" cy="${y}" r="3.5" fill="${DASH_LINE}"/>`;
    }).join('')}</g>`;
  return dashPlot({ ...o, W, svg });
}

/* ===========================================================================
   3. SCREENS  (full-page NAVIGATE destinations)
   ======================================================================== */

const SCREENS = {};

/* --- 37:25015 SP-Landing Page ------------------------------------------- */
SCREENS.landing = {
  nav: 'Spend Pulse',
  render: () => `
    <div class="page-head">
      <h1>Spend Pulse</h1><span class="spacer"></span>
      ${btn('Configure', { kind: 'secondary', lg: true, act: 'go', arg: 'configure-preferences', icon: 'settings' })}
    </div>

    <section class="section section--panel">
      <div class="section__head">
        <img class="section__icon" src="assets/icon-signals.svg" alt="" width="24" height="24">
        <h4>Signals</h4><span class="spacer"></span>
        <span class="muted">Showing top ${visibleSignals().length} Signals</span>
        <button class="pill-link" data-act="go" data-arg="all-signals"
          >${mi('format_list_bulleted', 'mi--sm')}View All</button>
      </div>
      <div class="signals-rail">${visibleSignals().map(signalCard).join('')}</div>
    </section>

    <section class="section section--panel">
      <div class="section__head">
        <img class="section__icon" src="assets/icon-metrics.svg" alt="" width="24" height="24">
        <h4>Metrics</h4><span class="muted">(Period: Last Week)</span><span class="spacer"></span>
        <button class="pill-link" data-act="overlay" data-arg="metrics-list"
          >${mi('format_list_bulleted', 'mi--sm')}View All</button>
      </div>
      <div class="grid-metrics">${visibleMetrics().map((m) => metricTile(m, true)).join('')}</div>
    </section>

    ${state.priceChart ? `
    <section class="section card chart-card">
      <div class="chart-toolbar">
        <h4>Price Index Trends</h4><span class="spacer"></span>
        <div class="range" role="group" aria-label="Time range">
          ${['3M', '6M', '1Y', '5Y'].map((r) => `<button data-act="range" data-arg="${r}"
            class="${state.chartRange === r ? 'active' : ''}">${r}</button>`).join('')}
        </div>
        ${btn('Compare', { kind: 'secondary', act: 'overlay', arg: 'compare-indices', sm: true,
          icon: 'compare_arrows' })}
      </div>
      ${chartLegend()}
      ${trendsChart()}
    </section>` : ''}

    <button class="navi-fab" data-act="noop">${mi('auto_awesome')}Navi</button>`,
};

/* --- 37:18678 Setup index ----------------------------------------------- */
SCREENS.setup = {
  nav: 'Setup',
  render: () => `
    <div class="setup-tabs">${['All Setup Items', 'Company Info', 'Accounts', 'Users', 'Approvals',
      'Budget Periods', 'Budget Lines'].map((t, i) =>
      `<span class="${i === 0 ? 'active' : ''}">${t}</span>`).join('')}</div>
    <div class="page-head"><h1>Setup</h1><span class="spacer"></span>
      <span class="setup-hint">Find it fast! Use the Instant Filter</span>
      ${searchbox('Instant Filter', 'searchbox--pill')}</div>
    <div class="setup-cols">
      ${[0, 1, 2].map((col) => `<div>${SETUP_GROUPS
        .filter((_, i) => i % 3 === col)
        .map(([title, links]) => `<div class="setup-group"><h4>${esc(title)}</h4><ul>
            ${links.map((l) => typeof l === 'string'
              ? `<li>${esc(l)}</li>`
              : `<li><a href="#/${l.route}" data-act="go" data-arg="${l.route}"><b>${esc(l.label)}</b></a></li>`
            ).join('')}</ul></div>`).join('')}</div>`).join('')}
    </div>
    <div class="setup-foot"><span>Total Spend Management - Make Margins Multiply</span>
      <span class="spacer"></span><span>English (United States)</span><span>•</span>
      <span>Accessibility</span><span>•</span><span>Privacy</span><span>•</span><span>Terms of Use</span></div>`,
};

/* --- 37:24429 / 37:24498 All Signals ------------------------------------ */
const SIGNAL_VIEWS = [
  { label: 'Create new view', kind: 'new' },
  { label: 'My Signals', kind: 'group' },
  { label: 'All Signals', kind: 'item', active: true },
  { label: 'New', kind: 'item' }, { label: 'Viewed', kind: 'item' },
  { label: 'Completed', kind: 'item' }, { label: 'Dismissed', kind: 'item' },
  { label: 'Company Signals', kind: 'group' },
  { label: 'All', kind: 'item' },
];

/* Card and List are two renderings of ONE list — `allSignals()`, which is the
   landing widget's signals plus the older ones. Every row therefore opens the
   same Signal Details drawer as its card, and a state change made in either
   view (or on the landing page) shows up in all three.                      */
function signalsBody() {
  const list = allSignals();
  if (state.signalsView === 'card') {
    return `<div class="grid-signals">${list.map(signalCard).join('')}</div>`;
  }
  return `<div class="table-wrap">${table(
    ['Signal', 'Status', 'Signal Triggered On', 'Last Updated By', 'Last Updated On', 'Actions'],
    list.map((s) => {
      const st = sig(s);
      const done = st.status === 'Completed' || st.status === 'Dismissed';
      return {
        attrs: ` data-signal="${s.id}"`,
        cells: [
          /* The title carries the drawer link; the description sits under it,
             so the row says as much as the card does. */
          cell(`<span class="row-link" data-act="open-signal" data-arg="${s.id}"
              >${esc(s.title)}</span><span class="row-sub">${esc(s.body)}</span>`, 'clip'),
          cell(statusChip(st.status)),
          cell(esc(s.triggered || '—')),
          cell(esc(s.by || '—')),
          /* Only meaningful once someone has acted — matches the card, which
             hides its `Last Updated by:` line until then. */
          cell(esc(st.actionTaken && s.at ? s.at : '—')),
          cell(done
            ? '<span class="muted">—</span>'
            : `<button class="link" data-act="dismiss-signal" data-arg="${s.id}"
                >Dismiss</button>`),
        ],
      };
    }),
  )}${pager(`Showing 1 -${list.length} out of ${list.length}`, '1 of 1')}</div>`;
}

SCREENS['all-signals'] = {
  nav: 'Spend Pulse',
  render: () => `
    <nav class="breadcrumb"><a href="#/landing" data-act="go" data-arg="landing">Spend Pulse</a>
      <span class="sep">/</span><span>Signals</span></nav>
    <div class="page-head">
      <button class="back" data-act="back" aria-label="Back">${mi('arrow_back')}</button>
      <h1>Signals</h1><span class="spacer"></span>
      ${btn('Configure', { kind: 'secondary', lg: true, act: 'go', arg: 'configure-preferences', icon: 'settings' })}
    </div>
    <div class="with-rail">
      <aside class="rail card">
        <h4>Views</h4>
        ${SIGNAL_VIEWS.map((v) => v.kind === 'group'
          ? `<div class="rail__group">${esc(v.label)}</div>`
          : v.kind === 'new'
            ? `<button class="rail__new">${esc(v.label)}</button>`
            : `<button class="rail__item rail__item--sub${v.active ? ' active' : ''}">${esc(v.label)}</button>`
        ).join('')}
      </aside>
      <div>
        <div class="viewbar">
          <h3>All Signals</h3>
          ${searchbox('Search Signals')}
          <div class="toggle-group" role="group" aria-label="View as">
            <button class="${state.signalsView === 'card' ? 'active' : ''}" data-act="signals-view"
              data-arg="card" aria-label="Card view">${mi('grid_view', 'mi--sm')}</button>
            <button class="${state.signalsView === 'table' ? 'active' : ''}" data-act="signals-view"
              data-arg="table" aria-label="Table view">${mi('view_list', 'mi--sm')}</button>
          </div>
        </div>
        ${signalsBody()}
      </div>
    </div>`,
};

/* --- Configure (user) : 37:16689 / 37:16814 / 37:21019 ------------------ */
const CONFIGURE_TABS = (variant) => variant === 'alt'
  ? [{ label: 'Preferences', route: 'configure-preferences-alt' },
     { label: 'Signals', route: 'configure-signals-alt' },
     { label: 'Metrics', route: 'configure-metrics-alt' }]
  : [{ label: 'Preferences', route: 'configure-preferences' },
     { label: 'Signals', route: 'configure-signals' },
     { label: 'Metrics', route: 'configure-metrics' }];

function configureHead(current, variant) {
  return `
    <nav class="breadcrumb">
      <a href="#/admin-signals" data-act="go" data-arg="admin-signals">Spend Pulse Setup</a>
      <span class="sep">/</span><span>Configure</span></nav>
    <div class="page-head">
      <button class="back" data-act="back" aria-label="Back">${mi('arrow_back')}</button>
      <h1>Configure</h1><span class="spacer"></span>
      ${btn('History', { kind: 'secondary', act: 'overlay', arg: 'history', icon: 'history' })}
    </div>
    ${tabs(CONFIGURE_TABS(variant), current)}`;
}

function prefScreen(variant) {
  const commodities = state.suggestionsApplied ? PREF_COMMODITIES_ADDED : PREF_COMMODITIES;
  const suppliers = state.suggestionsApplied ? PREF_SUPPLIERS_ADDED : PREF_SUPPLIERS;
  const route = variant === 'alt' ? 'configure-preferences-alt' : 'configure-preferences';
  const alertNote = variant === 'alt' ? '' :
    ' Close this alert to hide it until new suggestions appear.';
  const widget = state.suggestionsApplied
    ? ['Price Index Trends Widget', 'Track market index trends at a glance by enabling this chart on your homepage.']
    : ['Enable Price Index Trends Chart', 'View price index trends by enabling this chart on your homepage.'];

  return `
    ${configureHead(route, variant)}
    ${state.prefAlertOpen ? `
    <div class="alert">
      ${mi('auto_awesome', 'mi--sm')}
      <div class="alert__body">
        <div class="alert__title">Suggested Preferences</div>
        <div class="alert__text">Based on your recent activity, Navi has identified some suggestions
          for your preferences.${alertNote}</div>
      </div>
      <div class="alert__actions">
        <button class="link" data-act="overlay" data-arg="review-suggestions">Review</button>
        <button class="ov-close" data-act="dismiss-pref-alert" aria-label="Close">${mi('close', 'mi--sm')}</button>
      </div>
    </div>` : ''}

    <div class="card" style="padding:20px">
      <p class="subtle-note">Refine your feed by selecting key commodities and suppliers to prioritize
        the signals that matter most to your business.</p>
      <div class="panels">
        <section class="panel card">
          <h3>Commodity</h3>
          <div class="radio-row" role="radiogroup" aria-label="Commodity tracking">
            ${radio('commodity', 'selected', 'Track Selected', 'commodity-selected')}
            ${radio('commodity', 'all', 'Track All', 'commodity-all')}
            ${radio('commodity', 'none', 'Track None', 'commodity-none')}
          </div>
          <div class="notice">${mi('info', 'mi--xs')}<span>Tracking <b>${commodities.length} commodities</b>.
            You'll only see signals relevant to these.</span></div>
          ${searchbox('Search and Add Commodity')}
          <div class="list-rows">${commodities.map((c) => `<div class="list-row">${esc(c)}
            <span class="spacer"></span><button class="x" aria-label="Remove ${esc(c)}">${mi('close', 'mi--sm')}</button>
          </div>`).join('')}</div>
        </section>
        <section class="panel card">
          <h3>Supplier</h3>
          <div class="radio-row" role="radiogroup" aria-label="Supplier tracking">
            ${radio('supplier', 'selected', 'Track Selected', 'supplier-selected')}
            ${radio('supplier', 'all', 'Track All', 'supplier-all')}
            ${radio('supplier', 'none', 'Track None', 'supplier-none')}
          </div>
          <div class="notice">${mi('info', 'mi--xs')}<span>Tracking <b>${suppliers.length} suppliers</b>.
            You'll only see signals relevant to these.</span></div>
          ${searchbox('Search and Add Supplier')}
          <div class="list-rows">${suppliers.map((c) => `<div class="list-row">${esc(c)}
            <span class="spacer"></span><button class="x" aria-label="Remove ${esc(c)}">${mi('close', 'mi--sm')}</button>
          </div>`).join('')}</div>
        </section>
      </div>
      <div class="toggle-card card">
        <button class="switch${state.priceChart ? ' on' : ''}" data-act="toggle-price-chart"
          role="switch" aria-checked="${state.priceChart}" aria-label="${esc(widget[0])}"></button>
        <div class="toggle-card__body"><b>${esc(widget[0])}</b><span>${esc(widget[1])}</span></div>
      </div>
    </div>`;
}

SCREENS['configure-preferences'] = { nav: 'Spend Pulse', render: () => prefScreen('main') };
SCREENS['configure-preferences-alt'] = { nav: 'Spend Pulse', render: () => prefScreen('alt') };

function signalsTableScreen({ head, subtitle, sourceCol, variant, admin }) {
  return `
    ${head}
    <div class="table-wrap">
      <div class="table-wrap__head"><h3>Signals</h3>${searchbox('Search Signals')}</div>
      <div class="table-wrap__note">${esc(subtitle)}</div>
      ${table(['Enable', 'Signal Name', sourceCol, 'Description', 'Actions'],
        SIGNAL_CATALOGUE.map(([name, source, desc, , flag], i) => ({
          cells: [
            cell(`<button class="switch${state.signalToggles[i] ? ' on' : ''}" role="switch"
              aria-checked="${state.signalToggles[i]}" aria-label="Enable ${esc(name)}"
              data-act="toggle-signal" data-arg="${i}${admin ? '' : ':modal'}"></button>`),
            cell(`${flag === 'bls' && !state.blsSignalOn
              ? `<span class="info-i" data-tipkey="bls-warning" tabindex="0" role="button"
                   aria-label="Why is this disabled">${mi('warning', 'mi--sm')}</span> ` : ''}
              <span class="row-link" data-act="go" data-arg="${variant === 'alt' ? 'configure-preferences-alt' : 'configure-preferences-alt'}">${esc(name)}</span>`, 'name'),
            cell(esc(source)),
            cell(esc(desc), 'clip'),
            cell(`<button class="link">${admin ? 'Manage' : 'Configure'}</button>`),
          ],
        })))}
      ${pager('Showing 1 -8 out of 8', 'Page 1 of 24')}
    </div>`;
}

const userSignals = (variant) => signalsTableScreen({
  head: configureHead(variant === 'alt' ? 'configure-signals-alt' : 'configure-signals', variant),
  subtitle: 'Enable or disable signals relevant to you.',
  sourceCol: 'Product', variant, admin: false,
});
SCREENS['configure-signals'] = { nav: 'Spend Pulse', render: () => userSignals('main') };
SCREENS['configure-signals-alt'] = { nav: 'Spend Pulse', render: () => userSignals('alt') };

function metricsScreen(variant) {
  return `
    ${configureHead(variant === 'alt' ? 'configure-metrics-alt' : 'configure-metrics', variant)}
    <section class="section">
      <div class="section__head"><h4>Navi-Recommended Metrics (05)</h4></div>
      <div class="grid-metrics">${RECOMMENDED_METRICS.map((m) => metricTile(m, true)).join('')}</div>
    </section>
    <div class="table-wrap">
      <div class="table-wrap__head"><h3>All Metrics</h3>${searchbox('Search Metrics')}</div>
      ${table(['Indicator Name', 'Metric Type', 'Unit of Measure', 'Current Value', 'Formula', 'Actions'],
        ALL_METRICS.map(([name, type, unit, cur], i) => ({
          cells: [
            cell(`<span class="row-link" data-act="overlay" data-arg="metric-info:all-metric-${i}"
              >${esc(name)}</span>`, 'name'),
            cell(esc(type)), cell(esc(unit)), cell(esc(cur)),
            cell('<button class="link">View</button>'),
            cell(`<button class="switch on" role="switch" aria-checked="true"
              aria-label="Enable ${esc(name)}" data-act="noop"></button>`),
          ],
        })))}
      ${pager()}
    </div>`;
}
SCREENS['configure-metrics'] = { nav: 'Spend Pulse', render: () => metricsScreen('main') };
SCREENS['configure-metrics-alt'] = { nav: 'Spend Pulse', render: () => metricsScreen('alt') };

/* --- Admin : 37:19427 / 37:19741 / 37:19941 / 37:20047 ------------------ */
const ADMIN_TABS = [
  { label: 'Signals', route: 'admin-signals' },
  { label: 'Manage Users', route: 'admin-users' },
  { label: 'External Data', route: 'admin-external' },
];

function adminHead(current) {
  return `
    <div class="page-head">
      <button class="back" data-act="back" aria-label="Back">${mi('arrow_back')}</button>
      <h1>Spend Pulse Setup</h1><span class="spacer"></span>
      ${btn('History', { kind: 'secondary', act: 'overlay', arg: 'history', icon: 'history' })}
    </div>
    ${tabs(ADMIN_TABS, current)}`;
}

SCREENS['admin-signals'] = {
  nav: 'Setup',
  render: () => signalsTableScreen({
    head: adminHead('admin-signals'),
    subtitle: 'Enable or disable signals for all users within this instance.',
    sourceCol: 'Source', variant: 'admin', admin: true,
  }) + `<div style="margin-top:20px;display:flex;justify-content:flex-end">
    ${btn('Configure BLS', { kind: 'secondary', lg: true, act: 'go', arg: 'bls-alerts', icon: 'tune' })}</div>`,
};

SCREENS['admin-users'] = {
  nav: 'Setup',
  render: () => `
    ${adminHead('admin-users')}
    <div class="table-wrap">
      <div class="table-wrap__head"><h3>All Users</h3>${searchbox('Search Users')}</div>
      ${table(['User', 'Email', 'Role', 'Actions'], USERS.map(([n, e, r]) => ({
        cells: [
          cell(`<span class="row-link" data-act="go" data-arg="configure-preferences-alt">${esc(n)}</span>`, 'name'),
          cell(esc(e)), cell(esc(r)),
          cell('<button class="link">Edit</button>'),
        ],
      })))}
      ${pager('Showing 1 -11 out of 30', 'Page 1 of 24')}
    </div>`,
};

SCREENS['admin-external'] = {
  nav: 'Setup',
  render: () => `
    ${adminHead('admin-external')}
    <p class="subtle-note">Configure external market intelligence sources to enhance your category
      planning and spend analysis.</p>
    <section class="ext-card card">
      <div class="ext-card__head">
        <h3>Bureau of Labor Statistics
          <span class="info-i" data-tipkey="bls-about" tabindex="0" role="button"
            aria-label="About BLS">${mi('info', 'mi--sm')}</span></h3>
        <button class="link" data-act="noop">Show Preview</button>
      </div>

      <div class="ext-block" style="border-top:0;margin-top:0;padding-top:0">
        <h4>Signal Alert Setup</h4>
        <p>Configure alerts that notify you when BLS price indices meet your defined conditions.
          These will appear as Signals on your homepage.</p>
        ${state.blsSignalOn ? '' : `
        <div class="alert alert--warn">
          ${mi('warning', 'mi--sm')}
          <div class="alert__body"><div class="alert__text"><b>Signal is turned off.</b>
            Enable 'Price Index Fluctuations' to start receiving these alerts.</div></div>
          <div class="alert__actions">${btn('Enable', { kind: 'primary', sm: true, act: 'enable-bls' })}</div>
        </div>`}
        ${btn('Manage Alerts', { kind: 'secondary', act: 'go', arg: 'bls-alerts' })}
      </div>

      <div class="ext-block">
        <h4>Commodity Mapping</h4>
        <p>Select the appropriate CPI or PPI index for each of your commodities.</p>
        ${btn('Configure', { kind: 'secondary', lg: true, act: 'go', arg: 'bls-mapping' })}
      </div>
    </section>`,
};

/* --- Configure BLS : 37:20699 / 37:20155 / 37:20569 / 37:20284 ---------- */
const BLS_TABS = [
  { label: 'Manage Alerts', route: 'bls-alerts' },
  { label: 'Commodity Mapping', route: 'bls-mapping' },
];

function blsHead(current) {
  return `
    <nav class="breadcrumb">
      <a href="#/admin-signals" data-act="go" data-arg="admin-signals">Spend Pulse Setup</a>
      <span class="sep">/</span><span>Setup</span></nav>
    <div class="page-head">
      <button class="back" data-act="back" aria-label="Back">${mi('arrow_back')}</button>
      <h1>Configure BLS</h1><span class="spacer"></span>
      ${btn('History', { kind: 'secondary', act: 'overlay', arg: 'history', icon: 'history' })}
    </div>
    ${tabs(BLS_TABS, current)}`;
}

SCREENS['bls-alerts'] = {
  nav: 'Setup',
  render: () => `
    ${blsHead('bls-alerts')}
    <div class="table-wrap">
      <div class="table-wrap__head"><h3>Manage Alerts</h3>
        ${searchbox('Search Alerts')}
        ${btn('Add Alert', { kind: 'primary', act: 'overlay', arg: 'add-alert', icon: 'add' })}</div>
      <div class="table-wrap__note">Set thresholds for price index signals. When a threshold is met,
        signals will be triggered. &nbsp;Note: Users must enable the signal to view it in Spend Pulse.</div>
      ${table(['Series ID', 'Series Title', 'Alert Trigger Type', 'Trigger Value',
        'Time Range (Months)', 'Actions'], ALERTS.map((r) => ({
        cells: [
          cell(esc(r[0]), 'name'), cell(esc(r[1]), 'clip'), cell(esc(r[2])),
          cell(esc(r[3])), cell(esc(r[4])),
          cell(`<button class="link" data-act="overlay" data-arg="add-alert">Edit</button>`),
        ],
      })))}
      ${pager('Showing 1 -4 out of 4', 'Page 1 of 24')}
    </div>`,
};

SCREENS['bls-mapping'] = {
  nav: 'Setup',
  render: () => {
    const populated = state.mappingsMade;
    return `
    ${blsHead('bls-mapping')}
    ${state.autoMapBanner && !populated ? `
    <div class="alert">
      ${mi('auto_awesome', 'mi--sm')}
      <div class="alert__body"><div class="alert__title">Automated Mapping</div>
        <div class="alert__text">Navi has automatically mapped 50 commodities for you.
          Click Review to verify these mappings.</div></div>
      <div class="alert__actions">
        <button class="link" data-act="overlay" data-arg="review-mapped">Review</button>
      </div>
    </div>` : ''}
    <div class="table-wrap">
      <div class="table-wrap__head"><h3>Commodity mapping</h3>
        ${searchbox('Search Index')}
        ${btn('Add Mapping', { kind: 'primary', act: 'overlay', arg: 'add-mapping', icon: 'add' })}</div>
      <div class="table-wrap__note">Select the appropriate CPI or PPI index for each of your commodities.
        We use these mappings to compare your internal spend with market price fluctuations and
        generate insights.</div>
      ${populated
        ? table(['Commodities', 'Series ID', 'Series Title', 'Index Type', 'Region', 'Adjustment', 'Actions'],
            MAPPINGS.map((r) => ({
              cells: [cell(esc(r[0]), 'name'), cell(esc(r[1])), cell(esc(r[2]), 'clip'),
                cell(esc(r[3])), cell(esc(r[4])), cell(esc(r[5])),
                cell('<button class="link">Edit</button>')],
            })))
        : `<div class="empty-state"><h3>No mappings added</h3>
            <p>Add a mapping to begin benchmarking your spend against
              ${state.autoMapBanner ? 'price indices' : 'market trends'}.</p></div>`}
      ${populated ? pager('Showing 1 -10 out of 30', 'Page 1 of 24') : ''}
    </div>`;
  },
  /* 37:20155 → 37:20569 : the automated-mapping banner appears AFTER_TIMEOUT */
  onEnter() {
    if (state.mappingsMade || state.autoMapBanner) return;
    clearTimeout(SCREENS['bls-mapping']._t);
    SCREENS['bls-mapping']._t = setTimeout(() => {
      if (currentRoute !== 'bls-mapping' || state.autoMapBanner) return;
      state.autoMapBanner = true;
      renderScreen();
    }, 1600);
  },
};

/* ===========================================================================
   Agent Studio — demo signal 5's recommended action
   ---------------------------------------------------------------------------
   Refining the Opportunity Analysis agent is the one action on the rail that
   leaves Spend Pulse, so it gets real pages rather than a drawer: the studio's
   agent library, then the agent itself in three states.

     original   the shipped agent, read-only. Instructions and parameters as
                Coupa ships them, with Copy as the only way forward — you
                cannot edit built-in content in place
     copy       your copy, scoped to laptops and broken down by region. The
                four changed parameters are marked, and Run Agent is live
     run        the run is confirmed and says what it created. Where the
                opportunities went is the CFO Dashboard's business, not the
                studio's, so the panel points at it as well as listing them

   The page is `Agent / View / Multi Status / Active` (169:25826), everything
   below the header: the Draft/Active tab pair with Copy / Deactivate / Edit,
   then a two-column body — the agent's identity card over its metadata on the
   left, and on the right Agent Configuration followed by the four collapsible
   Knowledge / Tools / Triggers / Agents blocks.

   The copy is a demo of a real product surface, so the configuration text is
   the agent's actual prompt rather than a description of it — that is what the
   script's "I see the instructions" beat is showing.
   ======================================================================== */

const FRAG_AGENT = {
  name: 'Supplier Fragmentation Opportunity Analysis',
  owner: 'Coupa Built-in Content',
  version: 'v4.2',
  copyName: 'Supplier Fragmentation Opportunity Analysis — Laptops by Region',
  /* The identity card's one-line summary, under the title. */
  blurb: 'Measures how concentrated category spend is across its suppliers and '
    + 'creates a consolidation opportunity wherever it falls short of target.',
  copyBlurb: 'Measures laptop supplier concentration by region and creates one '
    + 'consolidation opportunity per region wherever it falls short of target.',
  /* `Agent Configuration` — the three Text Area Fields of the Figma's Info
     frame. Expertise and Guardrails are prose; Instructions is the prompt. */
  expertise: 'You are a spend analysis agent. Your expertise is in supplier '
    + 'concentration analysis, and you are designed to find categories where spend is '
    + 'spread across more suppliers than it needs to be.',
  guardrails: 'Only use approved invoice spend. Never recommend consolidating onto a '
    + 'supplier beyond its stated capacity, one under an open risk finding, or one whose '
    + 'contract expires inside the spend period.',
  /* The Figma numbers the instructions as a list, so they are authored as steps
     rather than one preformatted string — the numbering and the wrapping are
     then the browser's job at any width. */
  instructions: [
    'Aggregate approved invoice spend for the category over the spend period, excluding '
      + 'intercompany and one-time suppliers below the minimum spend threshold.',
    'Rank suppliers by spend and compute the share held by the top supplier count.',
    'Where that share is below the concentration target, size the addressable portion as '
      + 'the spend that could move to the top suppliers within their stated capacity.',
    'Group the results by the grouping dimension and create one opportunity per group, '
      + 'with the current share, the target share and the addressable amount.',
    'Publish each opportunity to the CFO Dashboard and raise a Spend Pulse signal for any '
      + 'opportunity above $100,000.',
  ],
  /* The left column's metadata card, in the Figma's order. Values that differ
     once the agent has been copied carry a second entry. */
  meta: [
    ['Version', '4.2', '1'],
    ['Last Updated By', 'Coupa', 'Cordelia Vane'],
    ['Last Updated', '06/14/2026 09:00 AM', '08/10/2026 11:24 AM'],
    ['Agent Type', 'Autonomous'],
    ['Model', 'Claude Opus 4.5'],
    ['Creator', 'Coupa Built-in Content', 'NorthStar Pharma'],
  ],
  /* The parameters the run is actually scoped by. `changed` marks the four the
     copy refines, which is the whole point of the Refine Parameters action. */
  params: [
    ['Category Scope', 'IT Hardware (all subcategories)', 'Laptops & Notebooks', true],
    ['Group Results By', 'Category', 'Region', true],
    ['Spend Period', 'Trailing 6 months', 'Trailing 6 months', false],
    ['Top Supplier Count', 'Top 5', 'Top 2', true],
    ['Concentration Target', '80%', '97%', true],
    ['Minimum Spend Threshold', '$50,000', '$50,000', false],
    ['Business Units', 'All', 'All', false],
    ['Run Frequency', 'Monthly', 'Monthly', false],
  ],
  /* The four collapsible blocks. Each is a two-column Type / Name table in the
     Figma; Triggers adds a Details column and a row action. */
  knowledge: [
    ['Report', 'Spend by Supplier — IT Hardware'],
    ['Table', 'Supplier Capacity & Tier Pricing'],
    ['PDF', 'IT Hardware Category Strategy FY26.pdf'],
  ],
  tools: [
    ['API', 'Spend Analytics — Category Aggregation'],
    ['API', 'Supplier Master — Capacity Lookup'],
    ['Action', 'Publish Opportunity to CFO Dashboard'],
    ['Action', 'Raise Spend Pulse Signal'],
  ],
  triggers: [
    ['Schedule Based', 'Monthly — first business day, 06:00 UTC'],
    ['Event Based', 'Category spend closed for period'],
  ],
  agents: [
    ['Agent', 'Knowledge Agent'],
    ['Agent', 'Opportunity Publishing Agent'],
  ],
};

/** The agent library. One row is the fragmentation agent; the rest are there so
    the studio reads as a library rather than a single-purpose page. */
const AGENTS = [
  [FRAG_AGENT.name, 'Coupa Built-in Content', 'Spend Analysis', 'Active', 'Monthly',
    'agent-fragmentation'],
  ['Off-Contract Spend Detection', 'Coupa Built-in Content', 'Compliance', 'Active', 'Weekly'],
  ['Price Index Deviation Monitor', 'Coupa Built-in Content', 'Market Intelligence', 'Active', 'Daily'],
  ['Autonomous Sourcing Event Creation', 'Coupa Built-in Content', 'Sourcing', 'Preview', 'On demand'],
  ['Supplier Risk Reassessment', 'Coupa Built-in Content', 'Supplier Risk', 'Active', 'Monthly'],
  ['Invoice Variance Triage', 'NorthStar Pharma', 'Accounts Payable', 'Active', 'Daily'],
  ['Certificate Expiry Watch', 'NorthStar Pharma', 'Supplier Management', 'Active', 'Weekly'],
];

const fragSignal = () => signalById('supplier-fragmentation-it-hardware');

/** The agent's stage, which is also how far signal 5's recommended action has
    got: no copy yet, a copy being refined, or a completed run. */
const agentStage = () => (state.agentRun ? 'run' : state.agentCopied ? 'copy' : 'original');

SCREENS['agent-studio'] = {
  nav: 'Agent Studio',
  render: () => `
    <div class="page-head"><h1>Agent Studio</h1><span class="spacer"></span>
      ${searchbox('Search Agents', 'searchbox--pill')}
      ${btn('New Agent', { kind: 'primary', lg: true, icon: 'add', act: 'noop' })}</div>
    <p class="subtle-note">Agents run continuously against your spend data, creating opportunities
      and raising signals. Built-in agents can be copied and refined for your own categories.</p>
    <div class="table-wrap">
      <div class="table-wrap__head"><h3>All Agents</h3>
        <span class="muted">Showing ${AGENTS.length + (state.agentCopied ? 1 : 0)} agents</span></div>
      ${table(['Agent', 'Owner', 'Domain', 'Status', 'Schedule', 'Actions'],
        (state.agentCopied ? [[FRAG_AGENT.copyName, 'Cordelia Vane', 'Spend Analysis',
          state.agentRun ? 'Active' : 'Draft', 'Monthly', 'agent-fragmentation']] : [])
          .concat(AGENTS).map(([name, owner, domain, status, freq, route]) => ({
            cells: [
              cell(route
                ? `<span class="row-link" data-act="go" data-arg="${route}">${esc(name)}</span>`
                : esc(name), 'name'),
              cell(esc(owner)), cell(esc(domain)),
              cell(`<span class="status status--${status === 'Active' ? 'completed'
                : status === 'Draft' ? 'new' : 'viewed'}">${esc(status)}</span>`),
              cell(esc(freq)),
              cell(route ? '<button class="link" data-act="go" data-arg="agent-fragmentation">Open</button>'
                : '<button class="link" data-act="noop">Open</button>'),
            ],
          })))}
      ${pager(`Showing 1 - ${AGENTS.length + (state.agentCopied ? 1 : 0)} out of ${
        AGENTS.length + (state.agentCopied ? 1 : 0)}`, 'Page 1 of 1')}
    </div>`,
};

/** One `Text Area Field` of the Agent Configuration card: a small label over
    read-only prose. The Figma renders the value in `text/secondary`, which is
    what makes the whole card read as a record rather than a form. */
function agentField(label, value, opts = {}) {
  const { mark = '' } = opts;
  /* An array of strings is the Figma's numbered instruction list; anything else
     is a single paragraph. */
  const body = Array.isArray(value)
    ? `<ol class="agent-field__steps">${value.map((v) => `<li>${esc(v)}</li>`).join('')}</ol>`
    : `<p class="agent-field__value">${esc(value)}</p>`;
  return `<div class="agent-field">
    <span class="agent-field__label">${esc(label)}${mark}</span>
    ${body}
  </div>`;
}

/** One of the four collapsible blocks below Agent Configuration. Each is a
    heading with a chevron over a borderless Type / Name table — the same
    `.sd-block` collapse the signal drawer uses, so the chevron behaves the way
    it does everywhere else. `action` adds the Figma's row-action column. */
function agentBlock(title, cols, rows, opts = {}) {
  const { extra = '', action = false } = opts;
  /* The Figma gives Type a fixed narrow track and lets the rest fill; the
     Actions column is a single glyph pinned right. */
  const heads = cols.map((label, i) => ({ label, cls: i === 0 ? 'col-type' : '' }))
    .concat(action ? [{ label: 'Actions', cls: 'col-act' }] : []);
  return `<section class="card agent-block sd-block">
    <div class="sd-block__head" data-act="collapse">
      <h4>${esc(title)}</h4><span class="spacer"></span>
      <span class="sd-chev">${mi('expand_less', 'mi--lg')}</span></div>
    <div class="sd-block__body">
      ${extra}
      ${table(heads, rows.map((r) => ({
        cells: r.map((v, i) => cell(esc(v), i === 0 ? 'name' : ''))
          .concat(action
            ? [cell(`<button class="icon-btn icon-btn--quiet" data-act="noop"
                aria-label="Configure">${mi('settings', 'mi--sm')}</button>`)]
            : []),
      })))}
    </div>
  </section>`;
}

SCREENS['agent-fragmentation'] = {
  nav: 'Agent Studio',
  render: () => {
    const stage = agentStage();
    const copy = stage !== 'original';
    const s = fragSignal();
    const f = (s && s.fragmentation) || {};
    const regions = f.regions || [];
    const A = FRAG_AGENT;
    /* Column 1 is the shipped value, column 2 the refined one. Before the copy
       exists there is only one column to show. */
    const params = A.params.map(([label, was, now, changed]) =>
      [label, copy ? now : was, changed && copy]);
    /* The Figma pairs a Draft tab with an Active one. Built-in content has no
       draft, a fresh copy is only a draft, and a run promotes it to active —
       so which tab is selected is the stage, and the other is disabled. */
    const tab = stage === 'copy' ? 'Draft' : 'Active';
    const statusChipKind = stage === 'run' ? 'completed' : copy ? 'new' : 'completed';
    const statusLabel = stage === 'run' ? 'Active' : copy ? 'Draft' : 'Active';
    return `
    <nav class="breadcrumb">
      <a href="#/agent-studio" data-act="go" data-arg="agent-studio">Agents</a>
      <span class="sep">/</span><span>${esc(copy ? A.copyName : A.name)}</span></nav>

    <div class="agent-bar">
      <div class="tabs tabs--inline" role="tablist">
        <button role="tab" aria-selected="${tab === 'Draft'}"
          class="${tab === 'Draft' ? 'active' : ''}${copy ? '' : ' is-off'}"
          data-act="noop">Draft</button>
        <button role="tab" aria-selected="${tab === 'Active'}"
          class="${tab === 'Active' ? 'active' : ''}${stage === 'copy' ? ' is-off' : ''}"
          data-act="noop">Active</button>
      </div>
      <span class="spacer"></span>
      ${btn('Copy', { kind: 'outline', act: 'copy-agent', icon: 'content_copy' })}
      ${copy && stage !== 'run'
        ? btn('Run Agent', { kind: 'primary', icon: 'play_arrow', act: 'run-agent' })
        : btn('Deactivate', { kind: 'outline', act: 'noop' })}
      ${stage === 'run'
        ? btn('View on CFO Dashboard', { kind: 'primary', icon: 'insights', act: 'go',
          arg: 'cfo-dashboard' })
        : btn('Edit', { kind: 'primary', icon: 'edit', act: 'noop',
          disabled: !copy })}
    </div>

    ${stage === 'original' ? `
    <div class="alert">
      ${mi('info', 'mi--sm')}
      <div class="alert__body"><div class="alert__title">Built-in agent</div>
        <div class="alert__text">This agent is Coupa Built-in Content and cannot be edited in place.
          Copy it to refine the parameters for your own categories — your copy runs alongside the
          original.</div></div>
      <div class="alert__actions">
        ${btn('Copy Agent', { kind: 'primary', sm: true, act: 'copy-agent' })}</div>
    </div>` : ''}

    ${stage === 'copy' ? `
    <div class="alert">
      ${mi('auto_awesome', 'mi--sm')}
      <div class="alert__body"><div class="alert__title">Copy created — 4 parameters refined</div>
        <div class="alert__text">This copy is scoped to Laptops &amp; Notebooks and grouped by
          region, against a top-2 concentration target of 97%. Run it to create one opportunity per
          region.</div></div>
      <div class="alert__actions">
        ${btn('Run Agent', { kind: 'primary', sm: true, icon: 'play_arrow', act: 'run-agent' })}</div>
    </div>` : ''}

    ${stage === 'run' ? `
    <div class="alert alert--ok">
      ${mi('check_circle', 'mi--sm')}
      <div class="alert__body"><div class="alert__title">Run complete — ${regions.length}
          opportunities created</div>
        <div class="alert__text">${esc(A.copyName)} ran on Aug 10, 2026 and created
          ${regions.length} laptop supplier fragmentation opportunities, one per region. They are
          published at the top of the CFO Dashboard - Summary.</div></div>
      <div class="alert__actions">
        ${btn('View on CFO Dashboard', { kind: 'primary', sm: true, act: 'go',
          arg: 'cfo-dashboard' })}</div>
    </div>` : ''}

    <div class="agent-view">
      <aside class="agent-side">
        <!-- 169:25874 Supplier Search — the agent's identity card: a gradient
             header with the patterned overlay, the avatar straddling its edge,
             then status / title / blurb. -->
        <section class="card agent-id">
          <div class="agent-id__hero">
            <span class="agent-id__pattern" aria-hidden="true"></span>
          </div>
          <!-- The glyph is inset within its 88px box in the Figma, which is
               exactly the vector's natural 66×57 — so it is sized, not scaled. -->
          <div class="agent-id__avatar">
            <img src="assets/agent-sparkle.svg" alt="" width="66" height="57">
          </div>
          <div class="agent-id__body">
            <span class="status status--${statusChipKind}">${esc(statusLabel)}</span>
            <h3>${esc(copy ? A.copyName : A.name)}</h3>
            <p>${esc(copy ? A.copyBlurb : A.blurb)}</p>
          </div>
        </section>

        <!-- 169:25900 Supplier Search Texts — the metadata stack. -->
        <section class="card agent-meta">
          ${A.meta.map(([label, was, now]) =>
            agentField(label, copy && now ? now : was)).join('')}
        </section>
      </aside>

      <div class="agent-main">
        <section class="card agent-cfg">
          <h4>Agent Configuration</h4>
          <div class="agent-cfg__body">
            ${agentField('Expertise', A.expertise)}
            ${agentField('Guardrails', A.guardrails)}
            ${agentField('Instructions', A.instructions)}
          </div>
          ${copy ? `<p class="mini-note">The instructions are unchanged in the copy — only the
            parameters below were refined, so the copy measures fragmentation exactly the way the
            built-in agent does.</p>` : ''}
        </section>

        <section class="card agent-block sd-block">
          <div class="sd-block__head" data-act="collapse">
            <h4>Parameters</h4>
            ${copy ? '<span class="param-changed">4 refined</span>' : ''}
            <span class="spacer"></span>
            ${copy ? '' : `<span class="status status--viewed">${mi('lock', 'mi--xs')}Read only</span>`}
            <span class="sd-chev">${mi('expand_less', 'mi--lg')}</span></div>
          <div class="sd-block__body">
            <div class="form-grid">
              ${params.map(([label, value, changed]) => `
                <label class="field"><span class="field__label">${esc(label)}${
                  changed ? '<span class="param-changed">Refined</span>' : ''}</span>
                  <span class="field__control is-plain${changed ? ' is-changed' : ''}"
                    >${esc(value)}</span></label>`).join('')}
            </div>
          </div>
        </section>

        ${agentBlock('Knowledge', ['Type', 'Name'], A.knowledge)}

        ${agentBlock('Tools', ['Type', 'Name'], A.tools, {
          extra: `<div class="toggle-card agent-toggle">
            <span class="switch on" role="switch" aria-checked="true" data-act="noop"></span>
            <div class="toggle-card__body"><b>Access all Coupa tools</b>
              <span>Allow the agent to use any Coupa tool required to complete the task. When
                disabled, it allows the agent to use only tools that you select.</span></div>
          </div>`,
        })}

        ${agentBlock('Triggers', ['Type', 'Details'], A.triggers, { action: true })}

        ${agentBlock('Agents', ['Type', 'Name'], A.agents)}

        ${stage === 'run' ? `
        <section class="table-wrap">
          <div class="table-wrap__head"><h3>Opportunities Created (${
            String(regions.length).padStart(2, '0')})</h3>
            ${btn('Open CFO Dashboard', { kind: 'outline', sm: true, icon: 'open_in_new',
              act: 'go', arg: 'cfo-dashboard' })}</div>
          <div class="table-wrap__note">One opportunity per region for Laptops &amp; Notebooks,
            measured against a top-2 supplier target of 97%.</div>
          ${table(['Region', 'Laptop Spend', 'Top 2 Share', 'Goal', 'Suppliers', 'Addressable'],
            regions.map(([region, spend, share, goal, sup, addr]) => ({
              cells: [cell(esc(region), 'name'), cell(esc(spend)),
                cell(`<span class="delta delta--down">${esc(share)}</span>`),
                cell(esc(goal)), cell(esc(sup)), cell(esc(addr))],
            })))}
          ${pager(`Showing 1 - ${regions.length} out of ${regions.length}`, '1 of 1')}
        </section>` : ''}
      </div>
    </div>`;
  },
};

/* ===========================================================================
   Reports → CFO Dashboard - Summary
   ---------------------------------------------------------------------------
   The full path in the script is Reports → Analytics → Coupa Built-in Content →
   Spend Management → CFO Dashboard → CFO Dashboard - Summary. Reports links
   straight to the summary rather than making the demo click through five index
   pages that have nothing else on them; the dashboard's breadcrumb still shows
   the whole path, so where it sits is not lost.
   ======================================================================== */

const REPORT_GROUPS = [
  ['Analytics', [{ label: 'CFO Dashboard - Summary', route: 'cfo-dashboard',
    hint: 'Coupa Built-in Content / Spend Management' }, 'Procurement Performance',
    'Supplier Diversity Summary', 'Savings Realisation']],
  ['Spend Management', ['Spend by Category', 'Spend by Supplier', 'Spend by Business Unit',
    'Off-Contract Spend']],
  ['Sourcing & Contracts', ['Sourcing Pipeline', 'Contract Expiry Forecast', 'Award Compliance']],
  ['Suppliers', ['Supplier Scorecards', 'Risk Register', 'Certificate Expiry']],
  ['Accounts Payable', ['Invoice Aging', 'Payment Terms Compliance', 'Early Payment Discounts']],
  ['My Reports', ['Recently Viewed', 'Scheduled Reports', 'Shared With Me']],
];

SCREENS.reports = {
  nav: 'Reports',
  render: () => `
    <div class="page-head"><h1>Reports</h1><span class="spacer"></span>
      ${searchbox('Search Reports', 'searchbox--pill')}
      ${btn('New Report', { kind: 'secondary', lg: true, icon: 'add', act: 'noop' })}</div>
    <p class="subtle-note">Analytics, dashboards and built-in content across spend, sourcing and
      suppliers.</p>
    <div class="setup-cols">
      ${[0, 1, 2].map((col) => `<div>${REPORT_GROUPS
        .filter((_, i) => i % 3 === col)
        .map(([title, links]) => `<div class="setup-group"><h4>${esc(title)}</h4><ul>
            ${links.map((l) => typeof l === 'string'
              ? `<li>${esc(l)}</li>`
              : `<li><a href="#/${l.route}" data-act="go" data-arg="${l.route}"
                  ><b>${esc(l.label)}</b></a>${l.hint
                    ? `<span class="report-hint">${esc(l.hint)}</span>` : ''}</li>`
            ).join('')}</ul></div>`).join('')}</div>`).join('')}
    </div>`,
};

/* The dashboard's own analytics tiles (207:26864). The reference is a live
   Coupa Analytics dashboard with placeholder data in it — several series read
   0.00 K and one change reads -100.0%, which is a half-loaded query rather than
   anything a CFO would look at. So the layout, the chart types and the axes are
   the reference's; the figures are this demo's, scaled off the $48.2M total
   spend the KPI strip already claims. Doing it the other way round would put a
   dashboard on screen that contradicts the rest of the prototype. */

/** Trailing 12-month spend by quarter, with the quarter-on-quarter change on
   its own axis. Values are in $M; the QoQ line is a percentage. */
const CFO_QUARTERS = [
  ['2025-Q3', 21.4, 2.8],
  ['2025-Q4', 26.9, 25.7],
  ['2026-Q1', 24.1, -10.4],
  ['2026-Q2', 24.1, 0.1],
  ['2026-Q3', 22.6, -6.2],
];

/** This trailing 12 months against the prior 12, by quarter — the pairing the
    reference draws as a blue bar beside a grey one. Values in $M. */
const CFO_YOY = [
  ['Q1', 24.1, 22.6],
  ['Q2', 24.1, 25.9],
  ['Q3', 22.6, 24.4],
  ['Q4', 26.9, 23.7],
];

/** Spend by account, descending — the Pareto. Values in $M; the cumulative
    share is computed from them. The tail is grouped as Other, as in the
    reference, so the curve still reaches 100%. */
const CFO_ACCOUNTS = [
  ['Meridian Technology Group', 8.4], ['Coastal Chem Supply', 6.9],
  ['Ardent Polymer Works', 5.8], ['Vantage IT', 4.6], ['Northwind Logistics', 4.1],
  ['Blue Ridge Systems', 3.4], ['Halcyon Digital Supply', 2.8],
  ['Pinnacle Freight Partners', 2.4], ['Stonebridge Packaging', 2.1],
  ['Ironwood Computing', 1.7], ['Crestline Facilities', 1.5],
  ['Solvay Reagents Ltd', 1.2], ['Other (74 accounts)', 3.2],
];

/** Spend by commodity, descending — the second Pareto. Values in $M. */
const CFO_COMMODITIES = [
  ['2361 - Professional Services', 6.2], ['2130 - Logistics & Freight', 5.9],
  ['1430 - Industrial Chemicals', 4.3], ['2230 - Packaging', 2.9],
  ['2340 - IT Hardware', 1.8], ['2220 - Maintenance Services', 1.6],
  ['2310 - Administrative Services', 1.4], ['2120 - Freight', 1.1],
  ['1340 - Pallets', 0.9], ['1400 - Production Materials', 0.7],
  ['2230 - MRO Supplies', 0.6], ['Other (18 commodities)', 1.8],
];

/** The CFO Dashboard's own KPI strip. Fixed figures — the dashboard is the
    payoff moment for the fragmentation story, not a live analytics surface. */
const CFO_KPIS = [
  { id: 'cfo-spend', label: 'Total Spend (H1 2026)', value: '$48.2M', peer: '$51.6M',
    delta: '3.1%', dir: 'down' },
  { id: 'cfo-savings', label: 'Realised Savings', value: '$3.4M', peer: '$2.8M',
    delta: '9.4%', dir: 'up' },
  { id: 'cfo-contract', label: 'Contract Coverage', value: '78%', peer: '81%',
    delta: '1.2%', dir: 'down' },
  { id: 'cfo-suppliers', label: 'Active Suppliers', value: '1,284', peer: '1,105',
    delta: '2.6%', dir: 'up' },
];

SCREENS['cfo-dashboard'] = {
  nav: 'Reports',
  render: () => {
    const s = fragSignal();
    const f = (s && s.fragmentation) || {};
    const regions = f.regions || [];
    /* The laptop opportunities exist only once the refined agent has been run —
       before that the dashboard is the dashboard, which is what makes running
       the agent visible here. */
    const showOpps = state.agentRun && regions.length;
    return `
    <nav class="breadcrumb">
      <a href="#/reports" data-act="go" data-arg="reports">Reports</a>
      <span class="sep">/</span><span>Analytics</span>
      <span class="sep">/</span><span>Coupa Built-in Content</span>
      <span class="sep">/</span><span>Spend Management</span>
      <span class="sep">/</span><span>CFO Dashboard</span>
      <span class="sep">/</span><span>CFO Dashboard - Summary</span></nav>
    <div class="page-head">
      <button class="back" data-act="back" aria-label="Back">${mi('arrow_back')}</button>
      <h1>CFO Dashboard - Summary</h1><span class="spacer"></span>
      <span class="muted">Period: H1 2026</span>
      ${btn('Export', { kind: 'secondary', lg: true, icon: 'download', act: 'noop' })}</div>

    ${showOpps ? `
    <!-- Top of the dashboard: what the refined agent created, one card per
         region. This is the whole reason the demo comes here — the agent run in
         Agent Studio landed its output on the CFO's own page. -->
    <section class="section section--panel opp-section">
      <div class="section__head">${mi('auto_awesome', 'mi--lg mi--ai')}
        <h4>New Opportunities — Laptop Supplier Fragmentation</h4>
        <span class="muted">Created Aug 10, 2026 by ${esc(FRAG_AGENT.copyName)}</span>
        <span class="spacer"></span>
        <button class="pill-link" data-act="go" data-arg="agent-fragmentation"
          >${mi('tune', 'mi--sm')}View Agent</button>
      </div>
      <div class="opp-grid">
        ${regions.map(([region, spend, share, goal, sup, addr]) => {
          const now = Number(String(share).replace('%', ''));
          const target = Number(String(goal).replace('%', ''));
          return `<article class="opp-card">
            <div class="opp-card__head"><h4>${esc(region)}</h4>
              <span class="spacer"></span>
              <span class="status status--new">New</span></div>
            <div class="opp-card__value">${esc(addr)}<span>addressable</span></div>
            <div class="sd-conc__bar" role="img"
              aria-label="${esc(share)} today against a goal of ${esc(goal)}">
              <span class="sd-conc__fill" style="width:${now}%"></span>
              <span class="sd-conc__mark" style="left:${target}%"></span></div>
            <div class="opp-card__rows">
              <span>Top 2 supplier share<b>${esc(share)}</b></span>
              <span>Goal<b>${esc(goal)}</b></span>
              <span>Laptop spend<b>${esc(spend)}</b></span>
              <span>Suppliers<b>${esc(sup)}</b></span>
            </div>
            <div class="opp-card__foot">
              ${btn('View Opportunity', { kind: 'outline', sm: true, act: 'noop' })}</div>
          </article>`;
        }).join('')}
      </div>
      <p class="mini-note" style="margin:12px 0 0">Across all four regions $193,000 of laptop spend
        is addressable by consolidating onto the top two suppliers in each region.</p>
    </section>` : `
    <div class="alert">
      ${mi('info', 'mi--sm')}
      <div class="alert__body"><div class="alert__title">No new opportunities this period</div>
        <div class="alert__text">Opportunities published by your spend analysis agents appear at the
          top of this dashboard.</div></div>
      <div class="alert__actions">
        ${btn('Open Agent Studio', { kind: 'primary', sm: true, act: 'go',
          arg: 'agent-studio' })}</div>
    </div>`}

    <!-- The dashboard proper (207:26864): a column of single figures beside the
         quarterly combo and the year-on-year pair, then the two Paretos across
         the full width. The reference's own grid, at the widths this prototype's
         page gives it. -->
    <section class="dash-grid">
      <div class="dash-figs">
        ${dashFigure('Trailing 12-Month Spend', '$95.7M', { sub: 'Jul 2025 – Jun 2026' })}
        ${dashFigure('YoY Change in Spend', '−1.4%', { tone: 'good',
          sub: 'vs $97.1M prior 12 months' })}
        ${dashFigure('Average Quarterly Spend', '$23.9M', { sub: 'Across 4 quarters' })}
      </div>

      ${dashTile('Quarterly Spending Trends', `
        ${dashComboChart({
          label: 'Invoice spend by quarter with quarter-on-quarter change',
          yTitle: 'Invoice Spend', xTitle: 'Invoice Date',
          bars: CFO_QUARTERS.map(([, v]) => v / 30),
          /* The QoQ axis runs −20% to +30%, so zero sits where the change
             actually crosses rather than on the floor of the chart. */
          line: CFO_QUARTERS.map(([, , q]) => (q + 20) / 50),
          yTicks: [[1, '$30.0M'], [0.75, '$22.5M'], [0.5, '$15.0M'], [0.25, '$7.5M'], [0, '$0']],
          rTitle: 'QoQ Change',
          rTicks: [[1, '30%'], [0.8, '20%'], [0.6, '10%'], [0.4, '0%'], [0.2, '−10%'], [0, '−20%']],
          xLabels: CFO_QUARTERS.map(([q]) => q),
        })}
        ${dashLegend([['Invoice Spend', DASH_BLUE, 'bar'], ['QoQ Change', DASH_LINE, 'line']])}`)}

      ${dashTile('YoY Spend Comparison', `
        ${dashGroupedChart({
          label: 'Trailing twelve month spend against the prior twelve months, by quarter',
          yTitle: 'Invoice Spend', xTitle: 'Quarter',
          groups: CFO_YOY.map(([q, a, b]) => [q, a / 30, b / 30, `$${a.toFixed(1)}M`,
            `$${b.toFixed(1)}M`]),
          yTicks: [[1, '$30.0M'], [0.75, '$22.5M'], [0.5, '$15.0M'], [0.25, '$7.5M'], [0, '$0']],
          xLabels: CFO_YOY.map(([q]) => q),
        })}
        ${dashLegend([['Trailing 12-Month Spend', DASH_BLUE, 'bar'],
          ['Prior 12 Months', DASH_GREY, 'bar']])}`)}

      ${dashTile('Spend in Top Accounts', `
        ${dashParetoChart({
          label: 'Invoice spend by account, descending, with cumulative share',
          yTitle: 'Invoice Spend', xTitle: 'Account Name', tilt: true,
          bars: CFO_ACCOUNTS.map(([, v]) => v), yMax: 10,
          yTicks: [[1, '$10.0M'], [0.75, '$7.5M'], [0.5, '$5.0M'], [0.25, '$2.5M'], [0, '$0']],
          rTitle: '% Running Total',
          rTicks: [[1, '100%'], [0.75, '75%'], [0.5, '50%'], [0.25, '25%'], [0, '0%']],
          xLabels: CFO_ACCOUNTS.map(([n]) => n),
        })}
        ${dashLegend([['Invoice Spend', DASH_BLUE, 'bar'],
          ['% Running Total', DASH_LINE, 'line']])}`, { wide: true })}

      ${dashTile('Top Commodity of Spend', `
        ${dashParetoChart({
          label: 'Invoice spend by commodity, descending, with cumulative share',
          yTitle: 'Invoice Spend', xTitle: 'Commodity', tilt: true,
          bars: CFO_COMMODITIES.map(([, v]) => v), yMax: 7,
          yTicks: [[1, '$7.0M'], [0.75, '$5.25M'], [0.5, '$3.5M'], [0.25, '$1.75M'], [0, '$0']],
          rTitle: '% Running Total',
          rTicks: [[1, '100%'], [0.75, '75%'], [0.5, '50%'], [0.25, '25%'], [0, '0%']],
          xLabels: CFO_COMMODITIES.map(([n]) => n),
        })}
        ${dashLegend([['Invoice Spend', DASH_BLUE, 'bar'],
          ['% Running Total', DASH_LINE, 'line']])}`, { wide: true })}
    </section>

    <section class="section section--panel">
      <div class="section__head"><h4>Key Indicators</h4>
        <span class="muted">(Period: H1 2026)</span></div>
      <div class="grid-metrics">${CFO_KPIS.map((m) => metricTile(m)).join('')}</div>
    </section>

    <section class="table-wrap">
      <div class="table-wrap__head"><h3>Spend by Category</h3>
        ${btn('View All', { kind: 'outline', sm: true, icon: 'format_list_bulleted',
          act: 'noop' })}</div>
      ${table(['Category', 'Spend (H1 2026)', 'vs Prior Period', 'Suppliers', 'Contract Coverage'], [
        ['IT Hardware', '$1,789,520', '+4.2%', '28', '61%'],
        ['Industrial Chemicals', '$4,318,900', '−7.8%', '19', '88%'],
        ['Packaging', '$2,946,400', '+1.1%', '24', '79%'],
        ['Professional Services', '$6,204,750', '+9.6%', '112', '54%'],
        ['Logistics & Freight', '$5,872,300', '−2.4%', '31', '83%'],
      ].map(([cat, spend, vs, sup, cov]) => ({
        cells: [cell(esc(cat), 'name'), cell(esc(spend)),
          cell(`<span class="delta delta--${vs.startsWith('+') ? 'down' : 'up'}">${esc(vs)}</span>`),
          cell(esc(sup)), cell(esc(cov))],
      })))}
      ${pager('Showing 1 - 5 out of 5', '1 of 1')}
    </section>`;
  },
};

/* --- the drafted sourcing event (212:53121) -------------------------------
   Where Generate Sourcing Event lands: the event itself, open in Draft, with
   the line items the agent filled in. The reference is a Coupa Sourcing page,
   so the shape is its shape — the event header with its journey, the Details
   tab, and the Items and Services grid inside a lot band — but it is built out
   of this prototype's own tokens rather than the reference's legacy greys, the
   way every other page here is.

   Base Price is the one field left empty, exactly as the frame leaves it. That
   is not an omission: it is the question the Analytics Agent answers, so the
   sparkle beside it hands the field to Navi (see naviPriceBeats). */

const SE_JOURNEY = ['Draft', 'Production', 'Evaluation Pending', 'Approval Pending',
  'Act on award'];

const SE_TABS = ['Settings', 'Timeline', 'Details', 'Suppliers', 'Evaluation', 'Messages'];

/** One field of the Items and Services grid. Nothing here is a real control —
    the whole page is a record of what the agent filled in — so an empty field
    renders as the empty control it is, which is what makes the filled ones
    read as filled. `spark` is the line index and turns the label into the
    hand-off to Navi; only Base Price passes one. */
function seField(label, value, opts = {}) {
  const { req = false, int = false, kind = 'input', ph = '', spark = null } = opts;
  const empty = !value;
  return `<div class="field se-field">
    <span class="field__label">${req ? '<span class="req">*</span>' : ''}${
      int ? '<span class="se-dagger">‡</span>' : ''}${esc(label)}${spark === null ? ''
      : `<button class="se-spark" data-act="navi-price" data-arg="${spark}"
        aria-label="Recommend a base price for this line with Navi"
        >${mi('auto_awesome', 'mi--xs mi--ai')}</button>`}</span>
    ${kind === 'link'
      ? `<button class="link se-field__link" data-act="noop">${esc(value)}</button>`
      : `<span class="field__control is-plain${empty ? ' is-empty' : ''}" data-act="noop">
        <span class="se-field__value">${esc(empty ? ph : value)}</span>
        <span class="spacer"></span>
        ${kind === 'select' ? mi('expand_more', 'mi--sm')
          : kind === 'date' ? mi('calendar_month', 'mi--sm') : ''}</span>`}
  </div>`;
}

/** One line item, as the Details tab shows it: the row of line-level settings,
    then the field grid. The reference splits Quantity and Unit into one column
    of the four, which is what `.se-split` is. */
function seLineHTML(ln, i) {
  const d = ln.draft || {};
  const price = state.basePrice[i];
  return `<div class="se-line">
    <div class="se-line__top">
      <div class="field se-field">
        <span class="field__label"><span class="req">*</span>Type</span>
        <span class="se-radios">
          <span class="radio on" role="radio" aria-checked="true" data-act="noop"
            ><i></i>Item</span>
          <span class="radio" role="radio" aria-checked="false" data-act="noop"
            ><i></i>Service</span></span>
      </div>
      ${seField('Field Settings', 'Add', { kind: 'link' })}
      ${seField('Bonus-malus', 'Edit', { kind: 'link' })}
    </div>
    <div class="se-grid">
      ${seField('Name', ln.name)}
      ${seField('Commodity', d.commodity, { int: true })}
      ${seField('Coupa Commodity', d.coupaCommodity, { int: true })}
      ${seField('Description', d.description)}

      <div class="se-split">
        ${seField('Quantity', d.quantity, { req: true })}
        ${seField('Unit', d.unit, { req: true, kind: 'select' })}
      </div>
      ${seField('Base Price', price ? `$${price}` : '', { int: true, spark: i })}
      ${seField('Currency', d.currency, { req: true, kind: 'select' })}
      ${seField('Total Cost Formula', 'Add Formula', { kind: 'link' })}

      ${seField('Manufacturer Name', '')}
      ${seField('Manufacturer Part Number', '')}
      ${seField('Fiscal Code', '')}
      ${seField('Classification Of Goods', '')}

      ${seField('Need By Date', d.needBy, { kind: 'date', ph: 'MM/DD/YYYY' })}
      ${seField('Form', '', { kind: 'select' })}
      ${seField('Shipping Term', d.shipping, { kind: 'select' })}
      ${seField('Custom Field 19', '', { int: true })}

      ${seField('Request Line Items', '', { int: true })}
      ${seField('MMID', '', { int: true })}
      ${seField('Start Date', '', { int: true, kind: 'date', ph: 'MM/DD/YYYY' })}
      ${seField('Custom Field 14', '', { int: true })}
    </div>
  </div>`;
}

/** A section of the Details tab. The reference draws these as a header with a
    chevron over a hairline; here they are the same collapsible block the signal
    drawer uses, so the chevron behaves the way it does everywhere else. */
function seSection(icon, title, body, opts = {}) {
  return `<section class="card sd-block se-section${opts.collapsed ? ' is-collapsed' : ''}">
    <div class="sd-block__head" data-act="collapse">${mi(icon, 'mi--lg mi--ai')}
      <h4>${esc(title)}</h4><span class="spacer"></span>
      <span class="sd-chev">${mi(opts.collapsed ? 'expand_more' : 'expand_less', 'mi--lg')}</span>
    </div>
    <div class="sd-block__body">${body}</div>
  </section>`;
}

SCREENS['sourcing-draft'] = {
  /* Reached from a Spend Pulse signal, and there is no Sourcing entry in this
     prototype's navigation, so that is the item that stays lit. */
  nav: 'Spend Pulse',
  render: () => {
    const s = signalById('price-drop-bulk-solvent') || {};
    const ev = s.sourcing || {};
    const lines = ev.lines || [];
    /* Base Total is the sum of what has actually been priced, so it opens at 0
       — the reference's own value — and answers each time Navi fills a line. */
    const total = lines.reduce((sum, ln, i) => {
      const q = Number(String((ln.draft || {}).quantity || '').replace(/[^0-9.]/g, ''));
      return sum + (Number(state.basePrice[i] || 0) * (q || 0));
    }, 0);
    return `
    <nav class="breadcrumb">
      <a href="#/landing" data-act="go" data-arg="landing">Spend Pulse</a>
      <span class="sep">/</span><span>Sourcing</span>
      <span class="sep">/</span><span>Events</span>
      <span class="sep">/</span><span>${esc(ev.eventId || '')}</span></nav>

    <div class="se-hero">
      <div class="se-hero__main">
        <div class="se-hero__title"><h1>Event — ${esc(ev.eventId || '')}</h1>
          <button class="link" data-act="noop">Edit</button></div>
        <div class="se-journey">
          ${SE_JOURNEY.map((label, i) => `<div class="se-jstep${i === 0 ? ' is-current' : ''}">
            <span class="se-jstep__dot"></span>
            <span class="se-jstep__label">${esc(label)}</span>
          </div>`).join('')}
        </div>
      </div>
      <label class="field se-rev"><span class="field__label">Revisions</span>
        <span class="field__control" data-act="noop"><span>123 - Prod (Current)</span>
          <span class="spacer"></span>${mi('expand_more', 'mi--sm')}</span></label>
    </div>

    <div class="tabs se-tabs" role="tablist">
      ${SE_TABS.map((t) => `<button role="tab" aria-selected="${t === 'Details'}"
        class="${t === 'Details' ? 'active' : ''}" data-act="noop">${esc(t)}</button>`).join('')}
    </div>

    ${seSection('attach_file', 'Attachments',
      '<p class="se-none">There are no attachments on this event</p>')}
    ${seSection('description', 'Forms',
      '<p class="se-none">There are no forms for this event</p>')}

    ${seSection('inventory_2', 'Items and Services', `
      <div class="se-toolbar"><span class="field__label">View</span>
        <span class="field__control is-plain" data-act="noop"><span>All Line Items</span>
          <span class="spacer"></span>${mi('expand_more', 'mi--sm')}</span>
        <span class="spacer"></span>
        ${btn('Add Line', { kind: 'outline', sm: true, icon: 'add', act: 'noop' })}</div>
      <div class="se-lots">
        <div class="se-lots__band">Items Not In Lots (${lines.length} items)</div>
        ${lines.map(seLineHTML).join('')}
        <div class="se-lots__foot">
          <span class="se-internal"><span class="se-dagger">‡</span>Internal field</span>
          <span class="spacer"></span>
          <span class="se-total"><span>Base Total</span>
            <b>${esc(total.toLocaleString('en-US'))} USD</b></span>
        </div>
      </div>`)}

    ${seSection('how_to_reg', 'Approvals',
      '<p class="se-none">This event has no approvals yet. Approvals are requested when the '
      + 'event moves out of Draft into Production.</p>', { collapsed: true })}

    ${seSection('comment', 'Comments', `
      <div class="se-comment">
        <div class="se-textarea" data-act="noop">Add a comment for the event team…</div>
        <p class="mini-note">User Input</p>
        <div class="se-comment__acts">
          ${btn('Mute Comments', { kind: 'ghost', sm: true, icon: 'notifications_off',
            act: 'noop' })}
          <span class="spacer"></span>
          ${btn('Add Comment', { kind: 'secondary', act: 'noop' })}
        </div>
      </div>`, { collapsed: true })}

    ${seSection('history', 'History', `
      ${table(['When', 'Who', 'What'], [
        ['Aug 10, 2026 11:42', 'Navi — Autonomous Event Creation Agent',
          `Event ${ev.eventId || ''} created in Draft with ${lines.length} line items`],
        ['Aug 10, 2026 11:42', 'Navi — Autonomous Event Creation Agent',
          `Invite list assembled from ${(ev.suppliers || []).length} bulk solvent suppliers`],
        ['Aug 10, 2026 11:41', 'Sarah Johnson',
          'Sourcing event requested from signal “Price Index decreased: Bulk Solvent”'],
      ].map(([when, who, what]) => ({
        cells: [cell(esc(when)), cell(esc(who), 'name'), cell(esc(what))],
      })))}`, { collapsed: true })}`;
  },
};

/* ===========================================================================
   4. OVERLAYS  (OVERLAY destinations — drawers, modals, tooltips, toast)
   ======================================================================== */

const OVERLAYS = {};

/* `sdShell`, `SD_TITLE`, `SD_BODY` and `impactsBlock` used to build the drawer
   as hand-written frames; `genericSignalDrawer` renders all of its states from
   live card state now, so they are gone. They were holding a second, stale copy
   of the ASN signal's title and description — the kind that gets edited by
   mistake instead of the real one in LANDING_SIGNALS. */

/* `Supplier COmmunication` (37:25948) is gone from every flow. It was toggled
   off in every frame of that Figma section already, and the action forms are the
   last place it appeared — Email Supplier lives in the Transfer Summary and
   Renewal Request headers, which is the whole of what it offered. */

/* --- Signal Details drawer parts (node 37:25948) -------------------------
   The four frames in that section are one drawer in four states, so they are
   built here from shared parts and differ only by the live card state:

     New / no action   Impacts, Actions with the gradient Navi panel and its
                       CTA, `Last Updated : --`; Mark As Completed disabled
     Action taken      the Navi panel becomes the completed action — check
                       icon, `<Action> was initiated on <date>`, Last Updated
                       by line — and Mark As Completed unlocks
     Completed         the Completed chip, and both Mark As Completed and
                       Dismiss Signal are disabled
   ---------------------------------------------------------------------- */

const sdHead = () => `<h4>Signal Details</h4>
  <button class="ov-close" data-act="close" aria-label="Close">${mi('close')}</button>`;

/** 37:25948 header block — title + pin, description, then the chip row. */
function sdHeadBlock(s, st, title) {
  return `<div class="sd-head-block">
    <div class="sd-stack">
      <div class="sd-title-row">
        <div class="sd-title">${esc(title || s.title)}</div>
        <button class="pin${st.pinned ? ' is-pinned' : ''}" data-act="pin" data-arg="${s.id}"
          aria-pressed="${st.pinned}" aria-label="${st.pinned ? 'Unpin' : 'Pin'} this signal"
          >${mi('push_pin', 'mi--sm')}</button>
      </div>
      <p class="sd-body">${esc(s.body)}</p>
    </div>
    <!-- The provider badge leads this row exactly as it leads the card footer.
         The drawer has the width the card does not, so nothing here has to give
         way for it — see sourceMark. -->
    <div class="sd-meta">${sourceMark(s)}${statusChip(st.status)}
      <span class="ago">${esc(s.ago)}</span></div>
  </div>`;
}

/** Impacts (n) — the Pumpkin-bordered block, `Card-Impact` rows inside.
    `extra` is appended inside the block's body, so anything that quantifies the
    impact collapses away with it instead of being stranded outside when the
    block is closed. The count still reflects the impact rows only. */
function impactsSection(rows, extra = '') {
  if (!rows || !rows.length) return '';
  return `<div class="sd-block sd-block--warn">
    <div class="sd-block__head" data-act="collapse">${mi('warning', 'mi--lg mi--warn')}
      Impacts (${rows.length}) :<span class="spacer"></span>
      <span class="sd-chev">${mi('expand_less', 'mi--lg')}</span></div>
    <div class="sd-block__body">
      ${rows.map(([head, detail]) => `<div class="sd-impact"><b>${esc(head)}</b>
        <span>${esc(detail)}</span></div>`).join('')}
      ${extra}
    </div>
  </div>`;
}

/** The numbers behind the impacts, rendered inside the Impacts block: a
    heading, a paragraph and a row of stat cards. Data-driven so a signal only
    has to author `exposure` to get it — see the field list at the top. */
function exposureBlock(ex) {
  if (!ex) return '';
  return `<div class="sd-exposure">
    <div class="sd-h">${esc(ex.title)}</div>
    <p class="sd-body">${esc(ex.text)}</p>
    ${ex.stats && ex.stats.length ? `<div class="sd-stats">${ex.stats.map(([l, v]) =>
      `<div class="sd-stat"><span>${esc(l)}</span><b>${esc(v)}</b></div>`).join('')}</div>` : ''}
  </div>`;
}

/* `Donut chart` (206:26585) — the palette the Figma segments carry, in the
   order the legend lists them. The last entry is the catch-all "Other", which
   is why it is the light blue that dominates the reference: the point of the
   chart is how much sits outside the named suppliers. */
const DONUT_COLORS = ['#283593', '#26A69A', '#26C6DA', '#FB8C00', '#0059d6', '#039BE5'];

/** Where a category's spend actually sits, as a donut with its legend
    (206:26585). A stacked bar could carry the same numbers, but fragmentation
    is a question of how a whole divides — which is the shape a donut has and a
    bar does not.

    Drawn as one circle per slice with a `stroke-dasharray` arc and a rotation,
    so there are no hand-authored paths: the geometry follows from the
    percentages. `.donut--load` sweeps the arcs on from 12 o'clock as the drawer
    opens, the same load-in the line charts use. */
function donutBlock(d) {
  if (!d) return '';
  const R = 74, C = 2 * Math.PI * R, BOX = 208;
  let at = 0;
  const arcs = d.slices.map(([, pct], i) => {
    const dash = (pct / 100) * C;
    /* -90deg puts the first slice at 12 o'clock; each one starts where the
       previous ended. The 1.5px gap is the Figma's segment separation, taken
       off the arc rather than added between them so the ring still closes. */
    const rot = -90 + (at / 100) * 360;
    at += pct;
    return `<circle class="donut__arc" cx="${BOX / 2}" cy="${BOX / 2}" r="${R}"
      fill="none" stroke="${DONUT_COLORS[i % DONUT_COLORS.length]}" stroke-width="32"
      stroke-dasharray="${Math.max(dash - 1.5, 0).toFixed(2)} ${C.toFixed(2)}"
      transform="rotate(${rot.toFixed(2)} ${BOX / 2} ${BOX / 2})"
      style="--arc-i:${i};--arc-gap:${C.toFixed(2)}px"/>`;
  }).join('');

  const label = d.slices.map(([name, pct]) => `${name} ${pct}%`).join(', ');
  return `<div class="sd-mix">
    <div class="sd-h">${esc(d.label)}</div>
    <div class="donut donut--load">
      <div class="donut__ring">
        <svg viewBox="0 0 ${BOX} ${BOX}" role="img"
          aria-label="${esc(d.label)}: ${esc(label)}">
          <!-- The track the arcs sweep onto, in the hairline colour rather than
               s3: the tray behind it is already s3, so an s3 track would leave
               the arcs floating with no ring under them during the load. -->
          <circle cx="${BOX / 2}" cy="${BOX / 2}" r="${R}" fill="none"
            stroke="var(--b2)" stroke-width="32"/>
          ${arcs}
        </svg>
        ${d.centre ? `<div class="donut__centre" aria-hidden="true">
          <span>${esc(d.centre[0])}</span><b>${esc(d.centre[1])}</b></div>` : ''}
      </div>
      <ul class="donut__legend">
        ${d.slices.map(([name, pct, spend], i) => `<li>
          <i style="background:${DONUT_COLORS[i % DONUT_COLORS.length]}"></i>
          <span class="donut__name">${esc(name)}</span>
          <b>${esc(spend || `${pct}%`)}</b>
          <span class="donut__pct">${pct}%</span>
        </li>`).join('')}
      </ul>
    </div>
    ${d.note ? `<p class="sd-body">${esc(d.note)}</p>` : ''}
  </div>`;
}

/** The index behind an index-driven signal, drawn on its own drawer: the same
    card-with-a-chart the Price Index detail hand-builds, but read off the
    signal's `series` field so a signal only has to author the numbers. It sits
    above Impacts because it is the evidence for the headline — the reader wants
    to see the drop before being told what it costs. */
function seriesBlock(sr) {
  if (!sr) return '';
  /* The note reads the chart for you, which is exactly what the informational
     `.alert` is for — as a plain paragraph under the plot it was easy to skip. */
  return `<div class="card" style="padding:16px">
    <div class="section__head"><h4>${esc(sr.name)}</h4>
      <span class="muted">Period: ${esc(sr.period || 'Last 1 Year')}</span></div>
    ${indexChart(sr.values, sr.ticks, sr.yTitle || 'Index Value', sr.fmt)}
    ${sr.note ? `<div class="alert alert--flush">
      ${mi('info', 'mi--sm')}
      <div class="alert__body"><div class="alert__text">${esc(sr.note)}</div></div>
    </div>` : ''}
  </div>`;
}

/** One action, as the Navi-Recommended panel or as the taken action.
    A signal with a `doneCta` keeps a way back into what it produced (the
    request that was sent, the reassessment that was started) — otherwise the
    only record of it is a sentence.

    `multi` is set when the signal offers several: the panels then need to say
    which one Navi picked and which are alternatives, so the recommended one
    keeps the AI glyph and a Primary button while the others get an outline
    button. An alternative's `icon` is optional: without one it carries no glyph
    at all, in the head or on the button, which is how the two IT Hardware
    alternatives read — the AI glyph then belongs to Navi's pick alone and
    nothing competes with it. With a single action there is nothing to
    distinguish, so it renders exactly as it always has.

    `lead` marks the first action in the block — the panel 210:26882 describes.
    A signal with one action always leads, and a signal with several leads with
    Navi's pick, so the AI surface belongs to the recommendation in both cases
    and the alternatives below it stay plain. */
function actionPanel(s, a, multi, lead = true) {
  const taken = !a.readOnly && actionTaken(s, a);
  const arg = multi ? `${s.id}:${a.id}` : s.id;
  const done = a.doneCta || (!multi && s.doneCta);
  const cls = `navi-panel${lead ? ' navi-panel--lead' : ''}`;
  if (taken) {
    return `<div class="${cls} navi-panel--done">
      <div class="navi-panel__head">${mi('check_circle', 'mi--lg mi--ai')}
        <b>${esc(a.doneTitle || `${a.title} was initiated`)}</b></div>
      <p class="navi-panel__text">${esc(a.doneText || a.text)}</p>
      <div class="navi-panel__meta">${esc(metaLine(s) || 'Last Updated : --')}</div>
      ${done ? `<div class="navi-panel__foot">
        ${btn(done.label, { kind: 'outline', sm: true, icon: done.icon || 'open_in_new',
          act: 'view-action', arg })}</div>` : ''}
    </div>`;
  }
  /* The New variant hides the `Last Updated : --` placeholder — nothing has
     happened yet, so the row carries only the CTA. */
  const alt = multi && !a.pick;
  const glyph = alt
    ? (a.icon ? mi(a.icon, 'mi--lg mi--lightblue') : '')
    : mi('auto_awesome', 'mi--lg mi--ai');
  return `<div class="${cls}">
    <div class="navi-panel__head">${glyph}<b>${esc(a.title)}</b>
      ${multi && a.pick ? '<span class="navi-pick">Navi’s recommendation</span>' : ''}</div>
    <p class="navi-panel__text">${esc(a.text)}</p>
    <div class="navi-panel__foot">
      ${btn(a.cta || s.cta, { kind: alt ? 'outline' : 'primary', sm: true,
        icon: alt ? (a.icon || '') : '', act: 'signal-action', arg })}</div>
  </div>`;
}

/** Actions (n) — one panel per action, Navi's pick leading. The count is the
    number of actions the signal offers, so a three-action signal reads
    `Actions (3) :` and the reader can see all three before choosing. */
function actionsSection(s, st) {
  const acts = signalActions(s);
  if (!acts.length) return '';
  const multi = acts.length > 1;
  const ordered = multi
    ? acts.slice().sort((a, b) => (!!b.pick) - (!!a.pick))
    : acts;

  return `<div class="sd-block sd-block--ai">
    <div class="sd-block__head" data-act="collapse">${mi('assignment_turned_in', 'mi--lg mi--lightblue')}
      Actions (${acts.length}) :<span class="spacer"></span>
      <span class="sd-chev">${mi('expand_less', 'mi--lg')}</span></div>
    <div class="sd-block__body">
      ${ordered.map((a, i) => actionPanel(s, a, multi, i === 0)).join('')}
    </div>
  </div>`;
}

/** <DialogActions> — all three are Medium Outline buttons; only the label
    colour differs (Close is Secondary, the other two Primary). Mark As
    Completed unlocks once the action is taken; both gate off once completed. */
function sdFoot(s, st) {
  const done = st.status === 'Completed';
  return `<span class="spacer"></span>
    ${btn('Close', { kind: 'outline-secondary', act: 'close' })}
    ${btn('Mark As Completed', st.actionTaken && !done
      ? { kind: 'outline', act: 'complete-signal', arg: s.id }
      : { kind: 'outline', disabled: true })}
    ${btn('Dismiss Signal', done
      ? { kind: 'outline', icon: 'remove_circle_outline', disabled: true }
      : { kind: 'outline', icon: 'remove_circle_outline',
          act: 'dismiss-signal', arg: s.id })}`;
}

/* --- generic Signal Details drawer -------------------------------------
   Built from a card's own data, so any signal in LANDING_SIGNALS opens a real
   drawer without a bespoke overlay. Registered lazily under `sd:<id>` the
   first time it is opened, which keeps the OVERLAYS map addressable by the
   router (deep links like #/landing~sd:tariff-aluminium keep working).      */
function genericSignalDrawer(id) {
  const s = signalById(id);
  if (!s) return null;
  const st = sig(s);

  return {
    kind: 'drawer', width: 720,
    head: sdHead(),
    body: `
      ${sdHeadBlock(s, st)}
      ${seriesBlock(s.series)}
      ${impactsSection(s.impacts, donutBlock(s.mix) + exposureBlock(s.exposure))}
      ${actionsSection(s, st)}`,
    foot: sdFoot(s, st),
  };
}

/* Register a generic drawer for every signal without a bespoke one, so the
   router can resolve deep links like #/landing~sd:tariff-aluminium. */
SIGNALS.forEach((s) => {
  if (!s.detail) OVERLAYS[`sd:${s.id}`] = () => genericSignalDrawer(s.id);
});

/** Overlay id for a signal: its bespoke drawer if it has one, else generic. */
const signalOverlayId = (s) => s.detail || `sd:${s.id}`;

/* `sd-new` used to be three hand-built frames — New, action-taken and
   Completed — with no shared state, so Mark As Completed there could not
   update the card behind it. The generic drawer now renders all three from
   the live card state, so this is just an alias for the ASN signal.        */
OVERLAYS['sd-new'] = () => genericSignalDrawer('asn-delayed');

/* --- 37:26126 Internal Warehouse Transfer form --------------------------
   Every ASN signal shares this form, so it is built against whichever signal
   launched it (`actionSignalId`) rather than a hard-coded one — otherwise Save
   would commit the landing card no matter which row you came from.          */
OVERLAYS['sd-transfer'] = () => {
  const s = signalById(actionSignalId) || signalById('asn-delayed');
  const back = signalOverlayId(s);
  /* Both ASN signals move stock between different warehouses, so the summary is
     read off the signal. The fallback keeps a deep link to this form standing
     even for a signal that has no transfer of its own. */
  const tr = s.transfer || { from: '--', fromLoc: '--', to: '--', toLoc: '--' };
  /* No Supplier Communication block in any state of this form — Email Supplier
     in the Transfer Summary header is the whole of what it offered. */
  return {
    kind: 'drawer', width: 720,
    head: sdHead(),
    body: `
      <div class="sd-block sd-block--ai">
        <div class="sd-block__head">${mi('auto_awesome', 'mi--lg mi--ai')}
          Internal Warehouse Transfer selected<span class="spacer"></span>
          ${btn('View Signal', { kind: 'outline-secondary', sm: true, act: 'swap', arg: back })}</div>
      </div>
      <div class="sd-block sd-block--tray">
        <div class="sd-block__head">${mi('local_shipping', 'mi--lg')}Transfer Summary
          <span class="spacer"></span>
          ${btn('View Transfer Document', { kind: 'outline', sm: true, icon: 'open_in_new' })}
          ${btn('Email Supplier', { kind: 'outline', sm: true, icon: 'mail' })}</div>
        <div class="sd-block__body">
          <div class="form-grid">
            ${[['Item', 'Isopropyl Alcohol'], ['Description', 'Silicon wafers for photovoltaic cells'],
               ['From Warehouse', tr.from], ['From Location', tr.fromLoc],
               ['Transfer Quantity', 'All'], ['To Warehouse', tr.to],
               ['To Location', tr.toLoc]].map(([l, v]) => `
              <label class="field"><span class="field__label">${esc(l)}<span class="req">*</span></span>
                <span class="field__control is-plain">${esc(v)}</span></label>`).join('')}
          </div>
        </div>
      </div>`,
    /* Save commits the action, which is what flips the signal to `actionTaken`
       and unlocks Mark As Completed on the drawer it returns to. */
    foot: `<span class="spacer"></span>
      ${btn('Cancel', { kind: 'secondary', act: 'swap', arg: back })}
      ${btn('Save', { kind: 'primary', act: 'commit-action', arg: s.id })}`,
  };
};

/* --- Expiring Supplier Certificate detail (demo signal 2) ----------------
   The generic drawer's parts — header block, Impacts with the script's supplier
   exposure folded in, the Navi Actions panel — and nothing else. The certificate
   itself is never a section on this drawer: before the action it is paperwork the
   reader has not asked for, and after it the renewal form holds the same fields,
   reached from `View Renewal Request` in the Actions panel. Reads from
   `openSignalId` so Mark As Completed here repaints the landing card.        */
OVERLAYS['sd-cert-expiry'] = () => genericSignalDrawer(openSignalId || 'cert-expiry-meridian');

/* --- Certificate renewal request (demo signal 2's action form) -----------
   The `couple of clicks` the script describes: the expiring certificate, who
   the request goes to, and Send Renewal Request. Save commits the action, so
   the drawer it returns to shows the request as sent and unlocks Mark As
   Completed — the same contract the transfer form has.                      */
OVERLAYS['sd-cert-renewal'] = () => {
  const s = signalById(actionSignalId) || signalById('cert-expiry-meridian');
  const back = signalOverlayId(s);
  const c = s.certificate || {};
  /* Two states, one form. Before the request is sent it is a form to submit;
     after, it is the record `View Renewal Request` on the drawer opens — same
     fields, no required marks, and Close instead of a second Send. */
  const sent = sig(s).actionTaken;
  return {
    kind: 'drawer', width: 720,
    head: sdHead(),
    body: `
      <div class="sd-block sd-block--ai">
        <div class="sd-block__head">${mi(sent ? 'check_circle' : 'auto_awesome', 'mi--lg mi--ai')}
          ${sent ? 'Certificate Renewal request sent' : 'Certificate Renewal selected'}
          <span class="spacer"></span>
          ${btn('View Signal', { kind: 'outline-secondary', sm: true, act: 'swap', arg: back })}</div>
      </div>
      <div class="sd-block sd-block--tray">
        <div class="sd-block__head">${mi('workspace_premium', 'mi--lg')}Renewal Request
          <span class="spacer"></span>
          ${btn('View Certificate', { kind: 'outline', sm: true, icon: 'open_in_new' })}</div>
        <div class="sd-block__body">
          <div class="form-grid">
            ${[['Certificate', c.name], ['Certificate Number', c.number],
               ['Supplier', s.supplierName], ['Certifying Body', c.body],
               ['Issued On', c.issued], ['Expires On', c.expires],
               ['Time Remaining', c.remaining],
               ['Request Type', 'Certificate Renewal'],
               ['Send To', 'Supplier Primary Contact'],
               ['Response Due By', 'Aug 24, 2026']].map(([l, v]) => `
              <label class="field"><span class="field__label">${esc(l)}${
                sent ? '' : '<span class="req">*</span>'}</span>
                <span class="field__control is-plain">${esc(v)}</span></label>`).join('')}
          </div>
        </div>
      </div>`,
    foot: sent
      ? `<span class="spacer"></span>
        ${btn('Back to Signal', { kind: 'secondary', act: 'swap', arg: back })}`
      : `<span class="spacer"></span>
        ${btn('Cancel', { kind: 'secondary', act: 'swap', arg: back })}
        ${btn('Send Renewal Request', { kind: 'primary', act: 'commit-action', arg: s.id })}`,
  };
};

/* --- Supplier risk reassessment (demo signal 3's action form) -------------
   The script's closing beat: starting the reassessment is where Navi surfaces
   two qualified alternates in the same category. They sit in the same Navi-owned
   panel as the Recommended Metrics and Indices, so the suggestion is the one
   prominent thing on the form. Two states like the renewal form — a form to
   submit, then the record `View Risk Reassessment` reopens.                  */
OVERLAYS['sd-risk-reassess'] = () => {
  const s = signalById(actionSignalId) || signalById('supplier-risk-coastal');
  const back = signalOverlayId(s);
  const r = s.risk || {};
  const started = sig(s).actionTaken;
  const alts = r.alternates || [];
  return {
    kind: 'drawer', width: 720,
    head: sdHead(),
    body: `
      <div class="sd-block sd-block--ai">
        <div class="sd-block__head">${mi(started ? 'check_circle' : 'auto_awesome', 'mi--lg mi--ai')}
          ${started ? 'Supplier Risk Reassessment started' : 'Supplier Risk Reassessment selected'}
          <span class="spacer"></span>
          ${btn('View Signal', { kind: 'outline-secondary', sm: true, act: 'swap', arg: back })}</div>
      </div>
      <div class="sd-block sd-block--tray">
        <div class="sd-block__head">${mi('assured_workload', 'mi--lg')}Reassessment
          <span class="spacer"></span>
          ${btn('View Supplier', { kind: 'outline', sm: true, icon: 'open_in_new' })}</div>
        <div class="sd-block__body">
          <div class="form-grid">
            ${[['Supplier', s.supplierName], ['Risk Score', `${r.from} → ${r.to}`],
               ['Open Purchase Orders', '2'], ['Contract Renewal', 'In 45 days'],
               ['Flag Contract For Review', 'Yes'],
               ['Assessment Type', 'Financial and Delivery Risk'],
               ['Owner', 'Category Manager'],
               ['Complete By', 'Aug 24, 2026']].map(([l, v]) => `
              <label class="field"><span class="field__label">${esc(l)}${
                started ? '' : '<span class="req">*</span>'}</span>
                <span class="field__control is-plain">${esc(v)}</span></label>`).join('')}
          </div>
        </div>
      </div>
      ${alts.length ? `
      <section class="navi-section rec-indices">
        <div class="navi-section__head">${mi('auto_awesome', 'mi--lg mi--ai')}
          <h4>Suggested Alternate Suppliers (${String(alts.length).padStart(2, '0')})</h4></div>
        <p class="mini-note" style="margin:0">Qualified suppliers in the same category, based on
          past performance and available capacity.</p>
        <div class="select-list">${alts.map(([name, hint]) => {
          const on = state.altSuppliers.has(name);
          return `<div class="select-list__row${on ? ' is-selected' : ''}">
            <span class="stitle">${esc(name)}<span class="shint">${esc(hint)}</span></span>
            <span class="spacer"></span>
            ${btn(on ? 'Selected' : 'Select', {
              kind: on ? 'outline' : 'primary', sm: true, icon: on ? 'check' : 'add',
              act: 'select-alt', arg: name,
            })}
          </div>`;
        }).join('')}</div>
      </section>` : ''}`,
    foot: started
      ? `<span class="spacer"></span>
        ${btn('Back to Signal', { kind: 'secondary', act: 'swap', arg: back })}`
      : `<span class="spacer"></span>
        ${btn('Cancel', { kind: 'secondary', act: 'swap', arg: back })}
        ${btn('Start Reassessment', { kind: 'primary', act: 'commit-action', arg: s.id })}`,
  };
};

/* --- Sourcing event draft (demo signal 4's action form) -------------------
   Two states like the renewal and reassessment forms, but the second state is
   the substance here rather than a receipt: once the event is drafted it is in
   `Draft` status with methanol in the item description, which is exactly where
   the script wants the embedded analytics — the pricing intelligence that says
   what the market did against what we last paid, and the bids as they roll in.
   Before the action those blocks would have nothing to show, so the draft state
   carries them and the pre-draft state carries the invite list instead.       */
OVERLAYS['sd-sourcing-event'] = () => {
  const s = signalById(actionSignalId) || signalById('price-drop-bulk-solvent');
  const back = signalOverlayId(s);
  const ev = s.sourcing || {};
  const drafted = sig(s).actionTaken;
  const sup = ev.suppliers || [];
  const bids = ev.bids || [];
  return {
    kind: 'drawer', width: 860,
    head: sdHead(),
    body: `
      <div class="sd-block sd-block--ai">
        <div class="sd-block__head">${mi(drafted ? 'check_circle' : 'auto_awesome', 'mi--lg mi--ai')}
          ${drafted ? `Sourcing Event ${esc(ev.eventId || '')} drafted by Navi`
            : 'Sourcing Event selected'}
          <span class="spacer"></span>
          ${btn('View Signal', { kind: 'outline-secondary', sm: true, act: 'swap', arg: back })}</div>
      </div>

      <div class="sd-block sd-block--tray">
        <div class="sd-block__head">${mi('gavel', 'mi--lg')}Event Details
          <span class="spacer"></span>
          ${drafted ? `<span class="status status--new">Draft</span>` : ''}
          ${btn('View Category', { kind: 'outline', sm: true, icon: 'open_in_new' })}</div>
        <div class="sd-block__body">
          <div class="form-grid">
            ${[['Event Name', `${ev.item} — Market Reset`],
               ['Event ID', drafted ? ev.eventId : 'Assigned on draft'],
               ['Event Type', 'RFQ (Sealed Bid)'],
               ['Item', ev.item],
               ['Item Description', ev.description],
               ['Annual Volume', ev.volume],
               /* What the agent drafted, line by line — the same list the review
                  form reads, counted here so the two agree. */
               ['Line Items', String((ev.lines || []).length)],
               ['Invited Suppliers', String(sup.length)],
               ['Bids Due By', 'Aug 25, 2026']].map(([l, v]) => `
              <label class="field"><span class="field__label">${esc(l)}${
                drafted ? '' : '<span class="req">*</span>'}</span>
                <span class="field__control is-plain">${esc(v)}</span></label>`).join('')}
          </div>
        </div>
      </div>

      ${!drafted ? `
      <section class="navi-section rec-indices">
        <div class="navi-section__head">${mi('auto_awesome', 'mi--lg mi--ai')}
          <h4>Preferred Suppliers to Invite (${String(sup.length).padStart(2, '0')})</h4></div>
        <p class="mini-note" style="margin:0">Navi’s autonomous event creation agent assembled this
          invite list from your bulk solvent contracts and past award history.</p>
        <div class="select-list">${sup.map(([name, hint]) => `
          <div class="select-list__row">
            <span class="stitle">${esc(name)}<span class="shint">${esc(hint)}</span></span>
            <span class="spacer"></span>
            ${btn('Included', { kind: 'outline', sm: true, icon: 'check', disabled: true })}
          </div>`).join('')}</div>
        <p class="mini-note" style="margin:0">${mi('schedule', 'mi--xs')} In a near-future release
          you will be able to kick off the Autonomous Sourcing Event agent from here and let it run
          the event end to end.</p>
      </section>` : `

      <!-- Embedded analytics, in Draft status. Pricing intelligence first —
           the last purchase price against the 12-month range and the trend is
           what tells you whether a bid is tracking the market drop or keeping
           most of the saving. -->
      <div class="sd-block sd-block--tray">
        <div class="sd-block__head">${mi('insights', 'mi--lg')}Pricing Intelligence — ${esc(ev.description || '')}
          <span class="spacer"></span>
          <span class="delta delta--down">${mi('arrow_downward', 'mi--xs')}12.0% (6 Mo)</span></div>
        <div class="sd-block__body">
          <div class="sd-stats">${(ev.benchmark || []).map(([l, v]) =>
            `<div class="sd-stat"><span>${esc(l)}</span><b>${esc(v)}</b></div>`).join('')}</div>
          <div style="margin-top:16px">
            ${indexChart(METHANOL_PRICE, [2, 1.9, 1.8, 1.7, 1.6, 1.5], 'Price $ / gal',
              (t) => `$${Number(t).toFixed(2)}`)}
          </div>
          <p class="sd-body" style="margin-top:16px">Methanol last purchased at
            $1.83 / gal against a 12-month range of $1.62 – $1.88. The market benchmark now sits at
            $1.62, so a bid above roughly $1.70 is returning only a fraction of the 12% the index
            says is available.</p>
        </div>
      </div>

      <!-- …then the bids themselves, side by side against that benchmark. -->
      <section class="table-wrap">
        <div class="table-wrap__head"><h3>Supplier Bids (${String(bids.length).padStart(2, '0')} of ${
          String(sup.length).padStart(2, '0')})</h3>
          ${btn('Compare Bids', { kind: 'outline', sm: true, icon: 'compare_arrows' })}</div>
        <div class="table-wrap__note">Each bid is measured against the $1.62 / gal market benchmark,
          so a competitive number is one that tracked the index down rather than held the old rate.</div>
        ${table(['Supplier', 'Unit Price', 'Extended Total', 'Lead Time', 'vs Benchmark', 'Assessment'],
          bids.map(([name, unit, total, lead, gap, verdict]) => ({
            cells: [
              cell(esc(name), 'name'), cell(esc(unit)), cell(esc(total)), cell(esc(lead)),
              cell(esc(gap)),
              cell(`<span class="delta delta--${verdict === 'competitive' ? 'up' : 'down'}">${
                mi(verdict === 'competitive' ? 'check_circle' : 'trending_up', 'mi--xs')}${
                verdict === 'competitive' ? 'Competitive' : 'Above Market'}</span>`),
            ],
          })))}
        ${pager(`Showing 1 - ${bids.length} out of ${sup.length}`, '1 of 1')}
      </section>`}`,
    foot: drafted
      ? `<span class="spacer"></span>
        ${btn('Back to Signal', { kind: 'secondary', act: 'swap', arg: back })}`
      : `<span class="spacer"></span>
        ${btn('Cancel', { kind: 'secondary', act: 'swap', arg: back })}
        ${btn('Draft Event with Navi', { kind: 'primary', icon: 'auto_awesome',
          act: 'commit-action', arg: s.id })}`,
  };
};

/* --- Supplier fragmentation: View Opportunity ----------------------------
   The first of demo signal 5's three actions, and the only one that commits
   nothing — it is where the $1,789,520 the Opportunity Analysis agent generated
   is broken open, so the reader can decide whether the number is worth acting
   on before choosing between a sourcing event and re-scoping the agent. One
   state only, for that reason: `readOnly` on the action keeps its panel out of
   the taken state, so there is nothing here to record.                       */
OVERLAYS['sd-fragmentation-opportunity'] = () => {
  const s = signalById(actionSignalId) || signalById('supplier-fragmentation-it-hardware');
  const back = signalOverlayId(s);
  const f = s.fragmentation || {};
  const rows = f.subcats || [];
  return {
    kind: 'drawer', width: 860,
    head: sdHead(),
    body: `
      <div class="sd-block sd-block--ai">
        <div class="sd-block__head">${mi('auto_awesome', 'mi--lg mi--ai')}
          Opportunity generated by the Supplier Fragmentation Opportunity Analysis agent
          <span class="spacer"></span>
          ${btn('View Signal', { kind: 'outline-secondary', sm: true, act: 'swap', arg: back })}</div>
      </div>

      <div class="sd-block sd-block--tray">
        <div class="sd-block__head">${mi('donut_small', 'mi--lg')}Opportunity Summary
          <span class="spacer"></span>
          <span class="ago">${esc(f.period || '')}</span></div>
        <div class="sd-block__body">
          <div class="sd-stats">
            ${[['Category Spend', f.total], ['Suppliers', String(f.suppliers || '')],
               ['Top 5 Supplier Share', f.top5], ['Consolidation Target', f.target],
               ['Addressable Opportunity', f.addressable]].map(([l, v]) =>
              `<div class="sd-stat"><span>${esc(l)}</span><b>${esc(v || '')}</b></div>`).join('')}
          </div>
          <p class="sd-body" style="margin-top:16px">The agent measures fragmentation as the share
            of category spend carried by the top suppliers in each subcategory, then sizes the
            addressable portion as the spend that could move onto them without exceeding their
            stated capacity. ${esc(f.addressable || '')} of the ${esc(f.total || '')} is addressable
            on that basis — the rest is either already concentrated or committed under contract.</p>
        </div>
      </div>

      <!-- The breakdown itself. Laptops carry the largest share and the widest
           spread, which is what makes re-scoping the agent to laptops the
           recommended action rather than sourcing the whole category. -->
      <section class="table-wrap">
        <div class="table-wrap__head"><h3>Opportunity by Subcategory (${
          String(rows.length).padStart(2, '0')})</h3>
          ${btn('Export', { kind: 'outline', sm: true, icon: 'download' })}</div>
        <div class="table-wrap__note">Spend for ${esc(f.period || '')}. A low top-2 share means the
          subcategory is spread thin — that is where consolidation returns the most.</div>
        ${table(['Subcategory', 'Spend (H1 2026)', 'Suppliers', 'Top 2 Share', 'Addressable'],
          rows.map(([name, spend, sup, share, addr]) => ({
            cells: [cell(esc(name), 'name'), cell(esc(spend)), cell(esc(sup)),
              cell(`<span class="delta delta--${Number(String(share).replace('%', '')) >= 70
                ? 'up' : 'down'}">${esc(share)}</span>`),
              cell(esc(addr))],
          })))}
        ${pager(`Showing 1 - ${rows.length} out of ${rows.length}`, '1 of 1')}
      </section>`,
    foot: `<span class="spacer"></span>
      ${btn('Back to Signal', { kind: 'secondary', act: 'swap', arg: back })}`,
  };
};

/* --- Supplier fragmentation: Initiate a Sourcing Event -------------------
   Signal 5's third action — take IT Hardware to market as it stands. Two states
   like the bulk solvent event, but this one consolidates rather than re-prices,
   so the draft state carries the award scenarios (what each level of
   consolidation gets to) instead of pricing intelligence.                    */
OVERLAYS['sd-it-sourcing-event'] = () => {
  const s = signalById(actionSignalId) || signalById('supplier-fragmentation-it-hardware');
  const back = signalOverlayId(s);
  const f = s.fragmentation || {};
  const ev = f.event || {};
  const a = signalActions(s).find((x) => x.id === 'sourcing-event') || {};
  const drafted = actionTaken(s, a);
  const sup = ev.suppliers || [];
  return {
    kind: 'drawer', width: 860,
    head: sdHead(),
    body: `
      <div class="sd-block sd-block--ai">
        <div class="sd-block__head">${mi(drafted ? 'check_circle' : 'auto_awesome', 'mi--lg mi--ai')}
          ${drafted ? `Sourcing Event ${esc(ev.eventId || '')} drafted by Navi`
            : 'Sourcing Event selected'}
          <span class="spacer"></span>
          ${btn('View Signal', { kind: 'outline-secondary', sm: true, act: 'swap', arg: back })}</div>
      </div>

      <div class="sd-block sd-block--tray">
        <div class="sd-block__head">${mi('gavel', 'mi--lg')}Event Details
          <span class="spacer"></span>
          ${drafted ? `<span class="status status--new">Draft</span>` : ''}
          ${btn('View Category', { kind: 'outline', sm: true, icon: 'open_in_new' })}</div>
        <div class="sd-block__body">
          <div class="form-grid">
            ${[['Event Name', `${ev.item} — Supplier Consolidation`],
               ['Event ID', drafted ? ev.eventId : 'Assigned on draft'],
               ['Event Type', 'RFQ (Multi-Lot)'],
               ['Category', ev.item],
               ['Scope', ev.description],
               ['Annualised Volume', ev.volume],
               ['Invited Suppliers', String(sup.length)],
               ['Bids Due By', 'Sep 8, 2026']].map(([l, v]) => `
              <label class="field"><span class="field__label">${esc(l)}${
                drafted ? '' : '<span class="req">*</span>'}</span>
                <span class="field__control is-plain">${esc(v || '')}</span></label>`).join('')}
          </div>
        </div>
      </div>

      ${!drafted ? `
      <section class="navi-section rec-indices">
        <div class="navi-section__head">${mi('auto_awesome', 'mi--lg mi--ai')}
          <h4>Suppliers to Invite (${String(sup.length).padStart(2, '0')})</h4></div>
        <p class="mini-note" style="margin:0">The five incumbents that carry 56% of category spend
          today, plus three qualified suppliers with capacity to absorb the consolidated volume.</p>
        <div class="select-list">${sup.map(([name, hint]) => `
          <div class="select-list__row">
            <span class="stitle">${esc(name)}<span class="shint">${esc(hint)}</span></span>
            <span class="spacer"></span>
            ${btn('Included', { kind: 'outline', sm: true, icon: 'check', disabled: true })}</div>`).join('')}</div>
        <p class="mini-note" style="margin:0">${mi('info', 'mi--xs')} Sourcing the whole category
          consolidates every subcategory at once. To consolidate the subcategories with the widest
          spread first, refine the Opportunity Analysis agent instead.</p>
      </section>` : `

      <!-- Award scenarios: what each level of consolidation actually gets to.
           This is the draft state's substance — the event exists to move the
           56% up, so the panel is the target expressed as awards. -->
      <div class="sd-block sd-block--tray">
        <div class="sd-block__head">${mi('insights', 'mi--lg')}Award Scenarios
          <span class="spacer"></span>
          <span class="delta delta--up">${mi('arrow_upward', 'mi--xs')}Target ${esc(f.target || '')}</span></div>
        <div class="sd-block__body">
          ${table(['Scenario', 'Suppliers Awarded', 'Top 5 Share After', 'Suppliers Retired',
            'Estimated Saving'], [
            ['As-is (no award)', '28', '56%', '0', '—'],
            ['Consolidate to 12', '12', '74%', '16', '$291K'],
            ['Consolidate to 8 (target)', '8', '81%', '20', '$429K'],
            ['Consolidate to 5', '5', '92%', '23', '$468K'],
          ].map((r, i) => ({
            cells: r.map((v, j) => cell(j === 0
              ? `${esc(v)}${i === 2 ? ' <span class="navi-pick">Meets target</span>' : ''}`
              : esc(v), j === 0 ? 'name' : '')),
          })))}
          <p class="sd-body" style="margin-top:16px">Consolidating to eight suppliers clears the 80%
            target and returns ${esc(f.addressable || '')} of the addressable opportunity. Going
            further to five adds little and concentrates supply risk in the category.</p>
        </div>
      </div>`}`,
    foot: drafted
      ? `<span class="spacer"></span>
        ${btn('Back to Signal', { kind: 'secondary', act: 'swap', arg: back })}`
      : `<span class="spacer"></span>
        ${btn('Cancel', { kind: 'secondary', act: 'swap', arg: back })}
        ${btn('Draft Event with Navi', { kind: 'primary', icon: 'auto_awesome',
          act: 'commit-action', arg: `${s.id}:sourcing-event` })}`,
  };
};

/* --- 37:26337 Price Index signal detail ---------------------------------
   Shared by every Price Index signal, so its chip and footer are built from
   whichever card is open — that is what lets Mark As Completed here repaint
   the landing card. Falls back to the landing signal for direct deep links. */
OVERLAYS['sd-price-index'] = () => {
  const s = signalById(openSignalId) || signalById('price-index-steel');
  const st = sig(s);
  return {
  kind: 'drawer', width: 720,
  head: sdHead(),
  body: `
    ${sdHeadBlock(s, st, 'Price Index increased: Steel Mill Products')}

    <div class="sd-block sd-block--warn">
      <div class="sd-block__head" data-act="collapse">${mi('warning', 'mi--lg mi--warn')}
        Impacts (1) :<span class="spacer"></span>
        <span class="sd-chev">${mi('expand_less', 'mi--lg')}</span></div>
      <div class="sd-block__body"><div class="sd-impact">
        <b>Series Steel Mill Products is mapped to Commodity Steel</b></div></div>
    </div>

    <div class="card" style="padding:16px">
      <div class="section__head"><h4>Steel Mill Products</h4>
        <span class="muted">Period: Last 1 Year</span></div>
      ${indexChart(STEEL_INDEX, [100, 75, 50, 25, 0], 'Index Value')}
      <p class="sd-body" style="margin-top:16px">The index value for Steel Mill Products displays an
        overall upward trend over the 1-year period, climbing from a low around 20 in July to a peak
        near 85 in June. Despite mid-period fluctuations notably a decline between December and March,
        the second half of the year shows stronger growth compared to the first.</p>
    </div>

    <div>
      <div class="sd-h" style="margin-bottom:8px">Overview</div>
      <p class="sd-body">This series affects 4 Active Suppliers, 3 Active Contracts,
        8 Purchase Orders and 7 Invoices.</p>
    </div>
    <div class="sd-stats">
      <div class="sd-stat"><span>Estimated Spend Impact</span><b>$124K</b></div>
      <div class="sd-stat"><span>PO Spend</span><b>$82K</b></div>
      <div class="sd-stat"><span>Invoices</span><b>$42.5K</b></div>
    </div>

    <div class="sd-block sd-block--ai">
      <div class="sd-block__head" data-act="collapse">${mi('assignment_turned_in', 'mi--lg mi--lightblue')}
        Actions (3) :<span class="spacer"></span>
        <span class="sd-chev">${mi('expand_less', 'mi--lg')}</span></div>
      <div class="sd-block__body">
        ${[['Initiate a Sourcing Event',
            'Market prices are fluctuating. Review your current contracts and category strategy to mitigate the impact on your forecasted spend.',
            'Create Sourcing Event', 'signal-action'],
           ['Review Contracts',
            'Review contracts to audit price adjustment clauses, check for fixed-price expiration dates, or renegotiate index-linked pricing terms to mitigate further price increases.',
            'Review', ''],
           ['Review PO',
            'Check if these orders can be consolidated, fast-tracked before further market increases, or held for renegotiation based on the 8.2% shift.',
            'Review', '']].map(([title, text, cta, act], i) => `
          <div class="navi-panel${i === 0 ? ' navi-panel--lead' : ''}">
            <div class="navi-panel__head">${mi(st.actionTaken && act ? 'check_circle' : 'auto_awesome', 'mi--lg mi--ai')}
              <b>${esc(title)}</b></div>
            <p class="navi-panel__text">${esc(text)}</p>
            ${st.actionTaken && act
              ? `<div class="navi-panel__meta">${esc(metaLine(s))}</div>`
              : `<div class="navi-panel__foot">${btn(cta, act
                  ? { kind: 'primary', sm: true, act, arg: s.id }
                  : { kind: 'outline-secondary', sm: true })}</div>`}
          </div>`).join('')}
      </div>
    </div>`,
  foot: sdFoot(s, st),
  };
};

/* --- 37:25275 Metrics-List drawer + 37:25274 info modal -----------------
   37:25281 Navi-Recommended Metrics: an AI-bordered panel (2px gradient
   stroke `Ai Colors/C1/Default`) over a horizontally-scrolling rail of
   fixed-width card-pin tiles, then the All Metrics table whose Actions column
   is the same pin. Pinning from either place adds the metric to the landing
   page Metrics widget, which is why both read from `state.metricPins`.      */
OVERLAYS['metrics-list'] = () => ({
  kind: 'drawer', width: 860,
  head: `<h4>Metrics</h4>
    <button class="ov-close" data-act="close" aria-label="Close">${mi('close')}</button>`,
  body: `
    <section class="navi-section">
      <div class="navi-section__head">
        ${mi('auto_awesome', 'mi--lg mi--ai')}
        <h4>Navi-Recommended Metrics (${String(RECOMMENDED_METRICS.length).padStart(2, '0')})</h4>
      </div>
      <div class="metrics-rail">${RECOMMENDED_METRICS.map(metricTilePin).join('')}</div>
    </section>
    <section class="table-wrap">
      <div class="table-wrap__head"><h3>All Metrics</h3>${searchbox('Search Metrics')}</div>
      ${table(['Indicator Name', 'Metric Type', 'Unit of Measure', 'Current Value', 'Peer Value', 'Actions'],
        ALL_METRICS.map(([name, type, unit, cur, peer], i) => ({
          cells: [
            cell(`<span class="row-link" data-act="overlay" data-arg="metric-info:all-metric-${i}"
              >${esc(name)}</span>`, 'name'),
            cell(esc(type)), cell(esc(unit)), cell(esc(cur)), cell(esc(peer)),
            cell(metricPin(METRICS_BY_ID[`all-metric-${i}`], 'cell'), 'actions'),
          ],
        })))}
      ${pager()}
    </section>`,
  foot: `<span class="spacer"></span>${btn('Cancel', { kind: 'secondary', act: 'close' })}`,
});

/* --- 37:25274 metric info modal ----------------------------------------
   Built from the metric that opened it, so the title, current value and peer
   average always match the tile or row behind the modal. `metric-info:<id>`
   is registered for every metric up-front, which also keeps deep links like
   #/landing~metric-info:lead-time working.                                 */
function metricInfo(m) {
  const rows = [
    ['Objective:', m.objective],
    ['Unit of Measure:', m.unit || '—'],
    ['Current Value:', m.value],
    ['Peer Average:', m.peer],
  ];
  /* The tile's trend pill is repeated here — it is part of what the card
     shows, so leaving it out would make the modal say less than the tile. */
  if (m.delta) rows.push(['Trend:', m.delta]);
  if (m.type) rows.push(['Metric Type:', m.type]);

  return {
    kind: 'modal', width: 476,
    head: `<h3>${esc(m.label)}</h3>
      <button class="ov-close" data-act="close" aria-label="Close">${mi('close')}</button>`,
    body: `
      <p class="metric-info__desc">${esc(m.desc)}</p>
      <div class="list-rows">
        ${rows.map(([l, v]) =>
          `<div class="list-row">${esc(l)}<span class="spacer"></span><b>${esc(v)}</b></div>`).join('')}
      </div>`,
    foot: `<span class="spacer"></span>${btn('Close', { kind: 'primary', act: 'close' })}`,
  };
}

Object.keys(METRICS_BY_ID).forEach((id) => {
  OVERLAYS[`metric-info:${id}`] = () => metricInfo(METRICS_BY_ID[id]);
});
/* Bare `metric-info` still resolves, for any link that predates the ids. */
OVERLAYS['metric-info'] = () => metricInfo(METRICS_BY_ID['high-risk-suppliers']);

/* --- 37:18587 History drawer -------------------------------------------- */
OVERLAYS.history = () => ({
  kind: 'drawer', width: 540,
  head: `<h4>History</h4>
    <button class="ov-close" data-act="close" aria-label="Close">${mi('close')}</button>`,
  body: HISTORY.map((h) => `
    <div class="history-item"><div class="history-item__head"><b>${esc(h.name)}</b>
      <span>${esc(h.when)}</span></div><p>${esc(h.body)}</p></div>`).join('')
    + `<div class="sd-actions-row" style="justify-content:center;gap:24px">
        <button class="link" data-act="noop">Show More</button>
        <button class="link" data-act="noop">Show All</button></div>`,
  foot: `<span class="spacer"></span>${btn('Cancel', { kind: 'secondary', act: 'close' })}`,
});

/* --- 37:18496 Modal-Preference Suggestion ------------------------------- */
OVERLAYS['review-suggestions'] = () => ({
  kind: 'modal', width: 809,
  head: `<h3>Review Suggestions</h3>
    <button class="ov-close" data-act="close" aria-label="Close">${mi('close')}</button>`,
  body: `
    <p style="margin:0;font-size:14px;color:var(--t2)">Following Commodities and Suppliers are
      recommended based on your recent usage.</p>
    <div class="panels">
      <section><h4 style="margin-bottom:12px">Commodities (6)</h4>
        <div class="list-rows">${SUGGESTED_COMMODITIES.map((c) => `<div class="list-row">
          <span class="checkbox on">${mi('check', 'mi--xs')}</span>${esc(c)}</div>`).join('')}</div>
      </section>
      <section><h4 style="margin-bottom:12px">Suppliers (3)</h4>
        <div class="list-rows">${SUGGESTED_SUPPLIERS.map((c) => `<div class="list-row">
          <span class="checkbox on">${mi('check', 'mi--xs')}</span>${esc(c)}</div>`).join('')}</div>
      </section>
    </div>`,
  foot: `<span class="spacer"></span>
    ${btn('Cancel', { kind: 'secondary', act: 'close' })}
    ${btn('Add to Preferences', { kind: 'primary', act: 'apply-suggestions' })}`,
});

/* --- 37:22793 / 22840 / 22866 Modal-Select Series (Compare indices) ----- */

/** The colour a series carries on the landing chart, so a chip means the same
    thing in the drawer as it does in the legend. An index that isn't plotted
    has no colour of its own and falls back to the neutral dot. */
function seriesColor(label) {
  const s = CHART_SERIES.find((x) => x.label === label);
  return s ? s.color : 'var(--t3)';
}

function compareIndices(variant) {
  const chips = variant === 'trimmed' ? SELECTED_INDICES.slice(0, 4) : SELECTED_INDICES;
  return {
    kind: 'modal', width: 808,
    head: `<h3>Compare Indices</h3>
      <button class="ov-close" data-act="close" aria-label="Close">${mi('close')}</button>`,
    body: `
      <p style="margin:0;font-size:14px;color:var(--t2)">Select indices to display on your chart
        (maximum: 5 indices).</p>
      ${chips.length >= 5 ? `
      <div class="alert alert--warn" style="margin:0">${mi('warning', 'mi--sm')}
        <div class="alert__body"><div class="alert__text"><b>Maximum of 5 indices reached.</b>
          &nbsp;Please remove an index from your selected list.</div></div></div>` : ''}
      <div>
        <div class="field__label" style="margin-bottom:8px">Selected Indices (${chips.length}/5):</div>
        <div class="chips">${chips.map((c) => `<span class="chip legend__chip">
          <span class="dot" style="background:${seriesColor(c)}"></span>
          <span class="label" title="${esc(c)}">${esc(c)}</span>
          <button class="x" data-act="swap" data-arg="compare-indices-trimmed"
            aria-label="Remove ${esc(c)}">${mi('close', 'mi--xs')}</button></span>`).join('')}</div>
      </div>
      <section class="navi-section rec-indices">
        <div class="navi-section__head">
          ${mi('auto_awesome', 'mi--lg mi--ai')}
          <h4>Recommended Indices (${String(RECOMMENDED_INDICES.length).padStart(2, '0')})</h4>
        </div>
        <p class="mini-note" style="margin:0">Recommendations based on your preferences and
          mapped Indices.</p>
        <div class="select-list">${RECOMMENDED_INDICES.map(([id, name]) => `
          <div class="select-list__row"><span class="sid">${esc(id)}</span>
            <span class="stitle">${esc(name)}</span><span class="spacer"></span>
            ${btn('Select', { kind: 'primary', sm: true, icon: 'add',
              act: 'swap', arg: 'compare-indices-trimmed' })}
          </div>`).join('')}</div>
      </section>
      ${seriesPicker()}`,
    foot: `<span class="spacer"></span>${btn('Save', { kind: 'primary', act: 'close' })}`,
  };
}
OVERLAYS['compare-indices'] = () => compareIndices('full');
OVERLAYS['compare-indices-trimmed'] = () => compareIndices('trimmed');

/** Shared "Select Series" CPI/PPI radio + search block. */
function seriesPicker(label = 'Select Series') {
  return `<div>
    <h4>${esc(label)}</h4>
    <div class="radio-row" role="radiogroup" aria-label="Index type" style="margin:12px 0">
      ${['CPI', 'PPI'].map((k) => {
        const on = state.seriesTab === k;
        return `<button class="radio${on ? ' on' : ''}" role="radio" aria-checked="${on}"
          data-act="series-tab" data-arg="${k}"><i></i>${k === 'CPI'
            ? 'Consumer Price Index (CPI)' : 'Producer Price Index (PPI)'}</button>`;
      }).join('')}
    </div>
    ${searchbox('Search Series')}
    <div class="select-list" style="margin-top:12px">${SERIES_LIB.map(([id, name]) => `
      <div class="select-list__row"><span class="sid">${esc(id)}</span>
        <span class="stitle">${esc(name)}</span><span class="spacer"></span>
        ${btn('Select', { kind: 'secondary', sm: true })}</div>`).join('')}</div>
  </div>`;
}

/* --- 37:18548 Modal-Add PI (Select Price Index Alerts) ------------------ */
OVERLAYS['add-pi-alerts'] = () => ({
  kind: 'modal', width: 808,
  head: `<h3>Select Price Index Alerts</h3>
    <button class="ov-close" data-act="close" aria-label="Close">${mi('close')}</button>`,
  body: `
    <p style="margin:0;font-size:14px;font-weight:700;color:var(--t1)">Select the alerts you want to
      activate to start receiving signals.</p>
    <div style="display:flex;justify-content:flex-end">${searchbox('Search Series ID or Name')}</div>
    <div class="select-list">${SERIES_LIB.map(([id, name], i) => `
      <div class="select-list__row"><span class="checkbox on">${mi('check', 'mi--xs')}</span>
        <span class="sid">${esc(id)}</span>
        <span class="stitle">${esc(name)}<span class="shint">${esc(ALERT_HINTS[i])}</span></span>
      </div>`).join('')}</div>`,
  foot: `<span class="spacer"></span>
    ${btn('Cancel', { kind: 'secondary', act: 'close' })}
    ${btn('Save', { kind: 'primary', act: 'close' })}`,
});

/* --- 37:20899 / 37:20928 Add Alert (2-step SWAP) ------------------------ */
function stepper(steps, current, actPrefix) {
  return `<div class="stepper">${steps.map(([n, label], i) => `
    ${i ? '<span class="step__bar"></span>' : ''}
    <button class="step${current === i ? ' active' : ''}" data-act="swap"
      data-arg="${actPrefix}${i + 1}"><i>${n}</i>${esc(label)}</button>`).join('')}</div>`;
}

OVERLAYS['add-alert'] = () => ({
  kind: 'modal', width: 808,
  head: `<h3>Add Alert</h3>
    <button class="ov-close" data-act="close" aria-label="Close">${mi('close')}</button>`,
  body: stepper([['1', 'Select Series'], ['2', 'Define Treshold']], 0, 'add-alert-step')
    + seriesPicker(),
  foot: `<span class="spacer"></span>
    ${btn('Cancel', { kind: 'secondary', act: 'close' })}
    ${btn('Next', { kind: 'primary', act: 'swap', arg: 'add-alert-step2' })}`,
});
OVERLAYS['add-alert-step1'] = OVERLAYS['add-alert'];

OVERLAYS['add-alert-step2'] = () => ({
  kind: 'modal', width: 808,
  head: `<h3>Add Alert</h3>
    <button class="ov-close" data-act="close" aria-label="Close">${mi('close')}</button>`,
  body: stepper([['1', 'Select Series'], ['2', 'Define Treshold']], 1, 'add-alert-step') + `
    <div>
      <div class="sd-h">All items in U.S. city average, all urban consumers, seasonally adjusted</div>
      <div class="chart-toolbar" style="margin:12px 0 0">
        <span class="mini-note">Period: Last 1 Year</span><span class="spacer"></span>
        <div class="range" role="group" aria-label="Value mode">
          <button class="active">Percentage</button><button>Value</button></div>
      </div>
      <div class="mini-note" style="margin:8px 0 12px">High: 42 &nbsp;|&nbsp; Low: 18.2
        &nbsp;|&nbsp; Average: 22.4</div>
      ${indexChart(ALERT_PREVIEW, [50, 25, 0, -25, -50], 'Index Value')}
    </div>
    <div class="form-grid">
      <label class="field">
        <span class="field__label">Trigger Condition<span class="req">*</span>
          ${infoIcon('trigger-condition')}</span>
        <span class="field__control" data-act="listbox" data-arg="condition">
          ${esc(state.alertCondition)}<span class="spacer"></span>${mi('expand_more', 'mi--sm')}</span>
      </label>
      <label class="field"><span class="field__label">Enter Value</span>
        <span class="field__control is-plain"><input style="border:0;outline:none;flex:1;min-width:0"
          value="5" aria-label="Trigger value"><span>%</span></span></label>
      <label class="field">
        <span class="field__label">Period (Months)<span class="req">*</span>
          ${infoIcon('period-months')}</span>
        <span class="field__control is-plain"><input style="border:0;outline:none;flex:1;min-width:0"
          value="3" aria-label="Period in months"></span></label>
    </div>`,
  foot: `<span class="spacer"></span>
    ${btn('Cancel', { kind: 'secondary', act: 'close' })}
    ${btn('Previous', { kind: 'secondary', act: 'swap', arg: 'add-alert-step1' })}
    ${btn('Save', { kind: 'primary', act: 'close' })}`,
});

/* --- 37:21992 / 37:22046 Add Mapping (2-step SWAP) --------------------- */
OVERLAYS['add-mapping'] = () => ({
  kind: 'modal', width: 808,
  head: `<h3>Add Mapping</h3>
    <button class="ov-close" data-act="close" aria-label="Close">${mi('close')}</button>`,
  body: stepper([['1', 'Select Commodity'], ['2', 'Select Mapped Index']], 0, 'add-mapping-step') + `
    <div>
      <h4>Select</h4>
      <div style="margin:12px 0">${searchbox('Search')}</div>
      <div class="select-list">${COMMODITY_TREE.map(([name, depth], i) => `
        <div class="select-list__row tree-row" style="--depth:${depth}">
          ${depth ? '' : `<span class="mini-note">Commodities</span>`}
          ${depth ? `<span class="stitle">${esc(name)}</span><span class="spacer"></span>
            ${btn('Select', { kind: 'secondary', sm: true, act: 'select-commodity', arg: name })}`
            : '<span class="spacer"></span>'}
        </div>`).join('')}</div>
    </div>`,
  foot: `<span class="spacer"></span>
    ${btn('Cancel', { kind: 'secondary', act: 'close' })}
    ${btn('Next', { kind: 'primary', act: 'swap', arg: 'add-mapping-step2' })}`,
});
OVERLAYS['add-mapping-step1'] = OVERLAYS['add-mapping'];

OVERLAYS['add-mapping-step2'] = () => ({
  kind: 'modal', width: 808,
  head: `<h3>Add Mapping</h3>
    <button class="ov-close" data-act="close" aria-label="Close">${mi('close')}</button>`,
  body: stepper([['1', 'Select Commodity'], ['2', 'Select Mapped Index']], 1, 'add-mapping-step') + `
    <div class="chips"><span class="chip chip--index">
      <span class="label">Commodity: ${esc(state.selectedCommodity)}</span>
      <button class="x" data-act="swap" data-arg="add-mapping-step1"
        aria-label="Change commodity">${mi('close', 'mi--xs')}</button></span></div>
    ${seriesPicker()}`,
  foot: `<span class="spacer"></span>
    ${btn('Cancel', { kind: 'secondary', act: 'close' })}
    ${btn('Previous', { kind: 'secondary', act: 'swap', arg: 'add-mapping-step1' })}
    ${btn('Save', { kind: 'primary', act: 'save-mapping' })}`,
});

/* --- 37:22145 Review Auto-Mapped Commodities --------------------------- */
OVERLAYS['review-mapped'] = () => ({
  kind: 'drawer', width: 720,
  head: `<h4>Review Auto-Mapped Commodities</h4>
    <button class="ov-close" data-act="close" aria-label="Close">${mi('close')}</button>`,
  body: `<div class="table-wrap">${table(['Commodities', 'Series', 'Actions'],
    AUTO_MAPPED.map(([c, s]) => ({
      cells: [cell(esc(c), 'name'), cell(esc(s)),
        cell('<button class="link">Edit</button>')],
    })))}${pager('Showing 1 -16 out of 50', 'Page 1 of 24')}</div>`,
  foot: `<span class="spacer"></span>
    ${btn('Cancel', { kind: 'secondary', act: 'close' })}
    ${btn('Confirm', { kind: 'primary', act: 'confirm-mapped' })}`,
});

/* --- tooltips (ON_HOVER overlays) -------------------------------------- */
const TOOLTIPS = Object.assign({}, TRACK_TIPS, {
  'bls-warning': 'Enable BLS from External Data to enable this signal.',
  'bls-about': 'Imports economic data, including the Consumer Price Index (CPI) and Producer Price Index (PPI), to help track inflation and benchmark category costs.',
  'trigger-condition': 'The specific threshold that must be met to trigger a signal',
  'period-months': 'The historical look-back period used to evaluate price trends.',
});

/* ===========================================================================
   5. NAVI CHAT  (212:47337 — the reveal; 212:60257 — the sourcing flow)
   ======================================================================== */

/* Not a conversation: a flow. An action hands the chat a script and it plays it
   out — the ask, the agent working, and what the agent produced. Everything
   after that the reader drives: the draft opens in a full-page review
   workspace, Generate drafts the event and lands on it, and on the event page
   the chat is still there to answer the one field the agent left empty.

   The script is a list of beats. A beat is a message or two and how long it
   holds before the next one arrives, and `naviChat.step` is the last beat
   revealed — so the panel is rebuilt from data on every step rather than by
   appending to the DOM, and a second agent can join a conversation already in
   progress by appending its own beats to it (`naviPlay`). That is what the base
   price recommendation is: the same panel, two more exchanges in it.

   Three views share that one message list — the floating panel, the review
   workspace (fixed1) and the artifact page (212:57685). Only the reader
   changes view; the reveal never does. */

const NAVI_FLOWS = {
  'sourcing-event': {
    signal: 'price-drop-bulk-solvent',
    /* The reveal, floating1 → floating3. The script's beat is that the event is
       launched *from the signal*, so the opening message is the signal's own
       ask, with the index that raised it attached the way floating1 attaches a
       document to the request. It stops at the draft coming back: the workspace
       opens when the reader opens the card, not on a timer. */
    beats: [
      { hold: 1600,
        msgs: [{ k: 'me',
          text: 'Create a sourcing event for bulk solvent with my preferred suppliers — the BLS '
            + 'Industrial Chemicals Index is down 12% and our contracts are still above market.',
          file: 'BLS Industrial Chemicals Index — Jun 2026.pdf' }] },
      { hold: 3400,
        msgs: [{ k: 'work', agent: 'Autonomous Event Creation Agent' }] },
      { msgs: [
        { k: 'say', text: 'Your sourcing event request is ready for review:' },
        { k: 'card', title: 'Review Request Form', sub: 'Sourcing Event — Bulk Solvent',
          act: 'navi-review' },
      ] },
    ],
    /* fixed1. Three steps behind us because the agent answered them; Review
       Request is where it hands back. */
    steps: ['Request Type', 'Request Details', 'Sourcing Details', 'Review Request'],
    title: 'Review Request',
    lead: 'You’re almost done! Take a minute to review the details of your request.',
    cta: 'Generate Sourcing Event',
    /* Where Generate lands — the event itself, in Draft (212:53121) — and what
       Navi says once it is there. The chat stays docked on that page, so the
       sentence has to hand over to the page rather than close the subject. */
    route: 'sourcing-draft',
    done: [{ msgs: [{ k: 'say',
      text: 'Sourcing event SE-2026-0417 is open in Draft with your line items filled in. Base '
        + 'Price is the one field I left for you — press the ✦ beside it on any line and the '
        + 'Analytics Agent will recommend one.' }] }],
  },
};

const naviChat = {
  flow: null,    // the flow being played
  beats: [],     // its beats, plus any a sub-flow has appended
  step: 0,       // index of the last beat revealed
  view: 'chat',  // chat (floating) | review (fixed1) | artifact
  art: null,     // the line whose price trend the artifact view is showing
  acc: 0,        // which of the review workspace's accordions is open
  route: null,   // the route the chat belongs to; leaving it closes the chat
  timer: null,
};

/** The chat opens below the top navigation, so its top edge is wherever the
    navigation ends. Measured rather than assumed: both bars size to their own
    content, which the logo lockup and the nav row change at two breakpoints. */
function naviTop() {
  const bar = $('.topbar');
  const nav = $('.nav');
  return (bar ? bar.offsetHeight : 0) + (nav ? nav.offsetHeight : 0);
}

function openNaviChat(id) {
  const flow = NAVI_FLOWS[id];
  if (!flow) return;
  naviChat.flow = flow;
  naviChat.beats = (flow.beats || []).slice();
  naviChat.acc = 0;
  naviChat.view = 'chat';
  naviChat.art = null;
  naviChat.route = currentRoute;
  naviGo(0, true);
}

function closeNaviChat() {
  clearTimeout(naviChat.timer);
  naviChat.timer = null;
  naviChat.flow = null;
  naviChat.beats = [];
  naviChat.step = 0;
  naviChat.view = 'chat';
  naviChat.art = null;
  naviChat.route = null;
  naviLayer.innerHTML = '';
  document.body.classList.remove('navi-open');
}

/** Reveal up to beat `n`. `auto` keeps the reveal going, and only while there is
    a beat left that holds — the last beat of a script sits there until the
    reader does something, which is why the workspace no longer opens on its
    own. Any control the reader touches steps without `auto`, so nothing carries
    on playing behind them. */
function naviGo(n, auto) {
  clearTimeout(naviChat.timer);
  naviChat.timer = null;
  naviChat.step = Math.max(0, Math.min(n, naviChat.beats.length - 1));
  renderNaviChat();
  const hold = (naviChat.beats[naviChat.step] || {}).hold;
  if (auto && hold && naviChat.step + 1 < naviChat.beats.length) {
    naviChat.timer = setTimeout(() => naviGo(naviChat.step + 1, true), hold);
  }
}

/** Append beats to the conversation and play them out from here. */
function naviPlay(beats) {
  if (!naviChat.flow || !beats || !beats.length) return;
  naviChat.beats = naviChat.beats.concat(beats);
  naviGo(naviChat.step + 1, true);
}

function naviView(view) {
  if (!naviChat.flow) return;
  clearTimeout(naviChat.timer);
  naviChat.timer = null;
  naviChat.view = view;
  renderNaviChat();
}

const NAVI_VIEWS = { chat: 'navi-float', review: 'navi-ws', artifact: 'navi-art' };

function renderNaviChat() {
  const f = naviChat.flow;
  if (!f) { closeNaviChat(); return; }
  const view = naviChat.view;
  naviLayer.style.setProperty('--navi-top', `${naviTop()}px`);
  /* The container survives a step change so the panel does not fly in again on
     every message; only a change of view is a new panel, and that one animates
     because it genuinely is one. Same reasoning as refreshOverlayEl. */
  let el = naviLayer.firstElementChild;
  if (!el || el.dataset.view !== view) {
    naviLayer.innerHTML = '';
    el = document.createElement('div');
    el.className = NAVI_VIEWS[view] || NAVI_VIEWS.chat;
    el.dataset.view = view;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Navi');
    naviLayer.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    /* The navigation is only where it was measured while the page is at the
       top, and a full-page view does not scroll with the page behind it. */
    if (view !== 'chat') window.scrollTo({ top: 0, behavior: 'auto' });
  }
  el.innerHTML = view === 'review' ? naviWorkspaceHTML(f)
    : view === 'artifact' ? naviArtifactHTML()
      : naviPanelHTML();
  document.body.classList.add('navi-open');
  const msgs = el.querySelector('.navi-msgs');
  if (msgs) msgs.scrollTop = msgs.scrollHeight;
}

/** The panel header. `kind` is 'float' for the panel standing on its own — two
    rows, and a minimise that closes it — and 'dock' for the copy docked inside
    a full-page view, which has that view's chrome around it and neither repeats
    the agent picker nor closes: it collapses back to the floating panel. */
function naviHeadHTML(kind) {
  const float = kind !== 'dock';
  return `<div class="navi-head">
    <div class="navi-head__row">
      <span class="navi-word">Navi</span>
      <img class="navi-mark" src="assets/navi-mark.svg" alt="" width="20" height="20">
      <span class="spacer"></span>
      <button class="navi-icon" data-act="${float ? 'navi-close' : 'navi-back'}"
        aria-label="${float ? 'Minimize Navi' : 'Collapse Navi'}"
        >${mi(float ? 'remove' : 'close_fullscreen', 'mi--sm')}</button>
    </div>
    ${float ? `<div class="navi-head__row">
      <button class="navi-icon" aria-label="Menu">${mi('menu', 'mi--sm')}</button>
      <span class="navi-agent"><span class="navi-agent__dot"></span>
        <span class="navi-agent__label">Explore agents</span>
        ${mi('arrow_drop_down', 'mi--sm')}</span>
      <button class="navi-icon" aria-label="New chat">${mi('edit_square', 'mi--sm')}</button>
    </div>` : ''}
  </div>`;
}

/** The conversation so far: the greeting, then every message the revealed beats
    have added. */
function naviMsgsHTML() {
  const msgs = naviChat.beats.slice(0, naviChat.step + 1)
    .reduce((all, b) => all.concat(b.msgs || []), []);
  return `<div class="navi-msgs">
    <div class="navi-bubble navi-bubble--plain">Hello Sarah! How can I assist you?</div>
    ${msgs.map((m, i) => naviMsgHTML(m, i === msgs.length - 1)).join('')}
  </div>`;
}

/** One message. `last` is only consulted by the progress row: an agent working
    is a thing that is happening, not a thing that was said, so it stands while
    it is the last message and goes when the answer it was working on lands. */
function naviMsgHTML(m, last) {
  switch (m.k) {
    case 'me':
      return `<div class="navi-row navi-row--me">
        <div class="navi-bubble navi-bubble--me">${esc(m.text)}
          ${m.file ? `<span class="navi-file">
            <span class="navi-file__icon">${mi('description', 'mi--20')}</span>
            <span class="navi-file__text"><b>${esc(m.file)}</b>
              <span>${mi('check', 'mi--xs')}File loaded</span></span></span>` : ''}
        </div>
      </div>`;
    case 'work':
      return last ? `<div class="navi-progress">
        <!-- The Clarity progress dots, the animated asset the frame carries
             (212:36895) rather than three divs pretending to be it. -->
        <span class="navi-progress__dots"><img src="assets/navi-progress.gif" alt=""></span>
        <span>The <b>${esc(m.agent)}</b> is working on your request…</span>
      </div>` : '';
    case 'card':
      return `<button class="navi-card" data-act="${m.act}">
        <b>${esc(m.title)}</b>
        <span class="navi-card__row">
          <span class="navi-card__icon">${mi('description', 'mi--lg')}</span>
          <span class="navi-card__name">${esc(m.sub)}</span>
          <span class="navi-icon">${mi('open_in_full', 'mi--sm')}</span>
        </span>
      </button>`;
    case 'insights':
      return naviInsightsHTML(m);
    case 'artifact':
      return naviArtCardHTML(m);
    default:
      return `<div class="navi-bubble navi-bubble--plain">${esc(m.text)}</div>`;
  }
}

/** The chat input. Decorative, like the prototype's other search fields — the
    flow is scripted, so there is nothing for a message to do. */
const naviInputHTML = () => `<div class="navi-bar">
  <div class="navi-bar__field"><span>How can Navi help you today?</span>
    <button class="navi-icon" aria-label="Send">${mi('send', 'mi--sm')}</button></div>
</div>`;

const naviPanelHTML = () => naviHeadHTML('float') + naviMsgsHTML() + naviInputHTML();

/** fixed1: the stepper, the review form and the same chat docked to the right.
    The form is read off the event's line items, so a fourth line item would
    render a fourth accordion without touching this. */
function naviWorkspaceHTML(f) {
  const s = signalById(f.signal) || {};
  const lines = (s.sourcing || {}).lines || [];
  const last = f.steps.length - 1;
  return `
    <aside class="navi-steps">
      ${f.steps.map((label, i) => `<div class="navi-step${i === last ? ' is-current' : ''}">
        <span class="navi-step__dot">${i === last
          ? String(i + 1) : mi('check', 'mi--sm')}</span>
        <span class="navi-step__label">${esc(label)}</span>
      </div>`).join('')}
    </aside>
    <div class="navi-form">
      <div class="navi-form__scroll">
        <div class="navi-form__head">
          <h2>${esc(f.title)}</h2>
          <p>${esc(f.lead)}</p>
        </div>
        ${lines.map(naviAccordionHTML).join('')}
      </div>
      <div class="navi-form__acts">
        ${btn('Back', { kind: 'outline', icon: 'arrow_back', act: 'navi-back' })}
        ${btn(f.cta, { kind: 'primary', icon: 'auto_awesome', act: 'navi-commit' })}
      </div>
    </div>
    <div class="navi-dock">${naviHeadHTML('dock')}${naviMsgsHTML()}${naviInputHTML()}</div>`;
}

/** One line item. Open, it is the two cards of 212:47089 — what was asked for
    and how it goes to market; closed, it is the title, the chip that says who
    filled it in, and a chevron. One is open at a time, which is the state the
    frame is in. */
function naviAccordionHTML(ln, i) {
  const open = naviChat.acc === i;
  return `<div class="navi-acc${open ? ' is-open' : ''}">
    <button class="navi-acc__head" data-act="navi-acc" data-arg="${i}"
      aria-expanded="${open}">
      <span class="navi-acc__title">${esc(ln.name)}</span>
      <span class="ai-chip">${mi('auto_awesome', 'mi--xs mi--ai')}Filled by Navi</span>
      <span class="navi-acc__chev">${mi(open ? 'expand_less' : 'expand_more', 'mi--lg')}</span>
    </button>
    ${open ? `<div class="navi-acc__body">
      ${naviFieldsHTML('Request Details', ln.request)}
      ${naviFieldsHTML('Sourcing Details', ln.sourcing)}
    </div>` : ''}
  </div>`;
}

function naviFieldsHTML(title, rows) {
  return `<div class="navi-fields">
    <div class="navi-fields__head"><b>${esc(title)}</b>
      <button class="navi-icon navi-icon--bare"
        aria-label="Edit ${esc(title)}">${mi('edit', 'mi--sm')}</button></div>
    ${(rows || []).map(([l, v]) => `<div class="navi-field">
      <span class="navi-field__label">${esc(l)}</span>
      <p class="navi-field__value">${esc(v)}</p></div>`).join('')}
  </div>`;
}

/* --- the base price recommendation (212:54615 → 212:56139) ----------------
   The one field the event creation agent leaves empty, answered by a second
   agent in the same chat. Pressing the sparkle beside Base Price asks the
   question the frame asks, so the beats are built from the line rather than
   authored per line: the ask, the Analytics Agent working, the insights card,
   the price trend as an artifact, and the offer to explain itself. */

/** The line the price flow is about, or null if the flow does not know one. */
function naviPriceLine(i) {
  const f = naviChat.flow;
  const s = f && signalById(f.signal);
  const lines = (s && s.sourcing && s.sourcing.lines) || [];
  return lines[i] || null;
}

function naviPriceBeats(i) {
  const ln = naviPriceLine(i);
  const p = ln && ln.price;
  if (!p) return [];
  return [
    { hold: 1400, msgs: [{ k: 'me', text: `Recommend a base price for ${ln.name}` }] },
    { hold: 2800, msgs: [{ k: 'work', agent: 'Analytics Agent' }] },
    { hold: 1200, msgs: [
      { k: 'say', text: 'I analyzed this line item based on the item details, quantity, '
        + 'category, historical sourcing activity, and recent purchasing trends. Here is the '
        + 'pricing insights:' },
      Object.assign({ k: 'insights', line: i }, p),
    ] },
    { hold: 1200, msgs: [
      { k: 'say', text: 'Here is the historical price trend for last 12 months:' },
      { k: 'artifact', line: i, title: 'Price Trend (Last 12 Months)', sub: 'Line Chart' },
    ] },
    { msgs: [{ k: 'say',
      text: 'Would you like to understand how this recommendation was derived?' }] },
  ];
}

/** The Pricing Insights card. `Apply to Base Price` is ours rather than the
    frame's: the frame stops at the recommendation, and on a page whose Base
    Price is visibly empty a recommendation you cannot take is a dead end. */
function naviInsightsHTML(m) {
  const conf = /low/i.test(m.confidence || '') ? ' conf-pill--low' : '';
  return `<div class="navi-insights">
    <b class="navi-insights__title">Pricing Insights</b>
    <div class="navi-insights__row"><span>Last Purchase</span><b>${esc(m.last)}</b></div>
    <div class="navi-insights__row"><span>Historical Range</span><b>${esc(m.range)}</b></div>
    <div class="navi-insights__basis">
      <span>Data basis: ${esc(m.basis)}</span>
      <span class="conf-pill${conf}">${esc(m.confidence)}</span>
    </div>
    <ul class="navi-insights__list">
      ${(m.events || []).map((e) => `<li>${esc(e)}</li>`).join('')}</ul>
    ${state.basePrice[m.line]
      ? `<p class="navi-insights__done">${mi('check_circle', 'mi--xs')}Applied to Base Price</p>`
      : btn('Apply to Base Price', { kind: 'outline', sm: true, icon: 'auto_awesome',
        act: 'navi-apply-price', arg: m.line })}
  </div>`;
}

/** The artifact as the chat carries it: a title, what kind of thing it is, and
    the control that opens it full page. */
function naviArtCardHTML(m) {
  return `<button class="navi-art-card" data-act="navi-artifact" data-arg="${m.line}">
    <b>${esc(m.title)}</b>
    <span class="navi-art-card__row">${mi('trending_up', 'mi--sm mi--ai')}
      <span>${esc(m.sub)}</span><span class="spacer"></span>
      <span class="navi-icon">${mi('open_in_full', 'mi--sm')}</span></span>
  </button>`;
}

/** 212:57685: the artifact opened full page — the artifact list on the left,
    the chart in the middle, and the conversation it came out of still on the
    right, so the chart is read next to the recommendation it supports. */
function naviArtifactHTML() {
  const ln = naviPriceLine(naviChat.art);
  const p = (ln && ln.price) || {};
  const title = 'Price Trend (Last 12 Months)';
  return `
    <div class="navi-art__head">
      <span class="navi-art__word">${mi('auto_awesome', 'mi--lg mi--ai')}Navi</span>
      <button class="navi-icon" data-act="navi-back"
        aria-label="Minimize Navi">${mi('remove', 'mi--sm')}</button>
    </div>
    <div class="navi-art__body">
      <aside class="navi-art__rail">
        <button class="navi-art__item is-current" data-act="noop">
          <b>${esc(title)}</b><span>Line Chart</span></button>
      </aside>
      <div class="navi-art__main">
        <section class="card navi-art__chart">
          <div class="navi-art__chart-head">
            <h3>${esc(title)}</h3><span class="spacer"></span>
            <button class="icon-btn icon-btn--quiet" data-act="noop"
              aria-label="Download">${mi('download', 'mi--sm')}</button>
            <button class="icon-btn icon-btn--quiet" data-act="navi-back"
              aria-label="Collapse">${mi('close_fullscreen', 'mi--sm')}</button>
          </div>
          <p class="navi-art__sub">${esc(ln ? ln.name : '')} — awarded price per gallon,
            July 2025 to June 2026</p>
          ${indexChart(p.values || [], p.ticks || [], 'Price ($ / gal)',
            (t) => `$${Number(t).toFixed(2)}`)}
          ${dashLegend([['Historical Awarded Price', 'var(--primary)', 'line']])}
          <p class="navi-art__note">Artifacts hold a maximum of 25, if more are created the
            oldest made will be removed</p>
        </section>
      </div>
      <div class="navi-dock">${naviHeadHTML('dock')}${naviMsgsHTML()}${naviInputHTML()}</div>
    </div>`;
}

/* ===========================================================================
   6. ROUTER + WIRING
   ======================================================================== */

const screenEl = $('#screen');
const overlayLayer = $('#overlay-layer');
const naviLayer = $('#navi-layer');
const tipLayer = $('#tip-layer');
const toastLayer = $('#toast-layer');

let currentRoute = 'landing';
const overlayStack = [];

/* The signal whose details are open. Set when a card is clicked and consumed
   when the drawer closes, which is where New → Viewed happens (R46: opening
   marks it read, but the card only updates once you come back to it). */
let openSignalId = null;

/* The signal whose bespoke action form (e.g. sd-transfer) is open. Unlike
   `openSignalId` this is not consumed on close — the form is shared by every
   ASN signal, so it needs to know which one to commit against. */
let actionSignalId = null;

/* Which of that signal's actions, for a signal offering several. A full-page
   action (Agent Studio) has no overlay to carry the pair in its own closure, so
   the page reads it from here to know what it is committing. */
let actionId = null;

/** New → Viewed for the signal whose drawer just closed. Pass `silent` when the
    caller is about to re-render anyway, to save a paint. */
function markOpenSignalViewed(silent) {
  if (!openSignalId) return;
  const st = state.signals[openSignalId];
  openSignalId = null;
  if (!st || st.status !== 'New') return;
  st.status = 'Viewed';
  if (!silent) renderScreen();
}

function renderNav() {
  $('#nav-row').innerHTML =
    `<a class="home-link" href="#/landing" data-act="go" data-arg="landing"
      aria-label="Home">${mi('home', 'mi--sm')}</a>`
    + NAV.map((n) => {
      const active = SCREENS[currentRoute] && SCREENS[currentRoute].nav === n.label;
      return `<a href="${n.route ? `#/${n.route}` : '#/landing'}"
        class="${active ? 'active' : ''}" ${n.route ? `data-act="go" data-arg="${n.route}"` : ''}
        >${esc(n.label)}</a>`;
    }).join('');
}

/* The route whose Trend Charts have already drawn themselves in. `innerHTML`
   below replaces the tiles outright, so their CSS animation would restart on
   every render — including ones triggered by pinning a signal or closing a
   drawer. Marking them `--drawn` when the route has not changed keeps the
   reveal to what it is in the file: a load-in, once per screen. */
let trendsDrawnFor = null;

/* Same idea for the Price Index Trends chart, with one addition: switching the
   time range is a fresh query, so that one render *should* replay the load.
   `replayPlot` is the flag those actions set. */
let plotDrawnFor = null;
let replayPlot = false;

function renderScreen() {
  const screen = SCREENS[currentRoute] || SCREENS.landing;
  const replay = trendsDrawnFor !== currentRoute;
  const plotReplay = replayPlot || plotDrawnFor !== currentRoute;
  screenEl.innerHTML = screen.render();
  if (!replay) {
    screenEl.querySelectorAll('.trend').forEach((t) => t.classList.add('trend--drawn'));
  }
  if (!plotReplay) {
    screenEl.querySelectorAll('.plot--load').forEach((p) => p.classList.add('plot--drawn'));
  }
  trendsDrawnFor = currentRoute;
  plotDrawnFor = currentRoute;
  replayPlot = false;
  renderNav();
  fitLegend();
  if (screen.onEnter) screen.onEnter();
}

function routeFromHash() {
  const raw = (location.hash || '').replace(/^#\/?/, '');
  const [route, ov] = raw.split('~');
  currentRoute = SCREENS[route] ? route : 'landing';
  /* The chat is transient — it is not in the hash, so a Back out of the route
     it was opened from would otherwise leave it floating over a page it has
     nothing to do with. It belongs to one route at a time (`naviChat.route`),
     which is how it survives the one navigation that is part of its own flow:
     Generate moves the chat to the event page and then goes there. Nothing else
     in the flow writes the hash (overlayHash uses replaceState), so this only
     ever fires on a real navigation. */
  if (naviChat.flow && naviChat.route !== currentRoute) closeNaviChat();
  /* The signal drawer has dropped out of the hash, so it has been closed —
     usually by the browser Back button. Advance New → Viewed before painting,
     since the render below is the one that shows the new state. */
  const open = openSignalId && signalById(openSignalId);
  if (open && ov !== signalOverlayId(open)) markOpenSignalViewed(true);
  /* Back/Forward between two overlays on the same route is a content change,
     not a new panel — refresh in place and leave the container alone. Only a
     real teardown (no overlay in the hash, or a different kind) rebuilds. */
  const top = overlayStack[overlayStack.length - 1];
  const spec = ov && OVERLAYS[ov] && OVERLAYS[ov]();
  if (spec && top && overlayStack.length === 1
      && top.el.classList.contains(`ov--${spec.kind}`)) {
    renderScreen();
    refreshOverlayEl(top.el, spec);
    top.id = ov;
    /* No screenEl.focus() or scrollTo here — the dialog is still open, so
       pulling focus out of it and jumping the page behind it would both be
       wrong. refreshOverlayEl has already placed focus inside the panel. */
    return;
  }
  renderScreen();
  closeAllOverlays(true);
  if (ov && OVERLAYS[ov]) openOverlay(ov, true);
  screenEl.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function go(route) {
  if (!SCREENS[route]) return;
  location.hash = `#/${route}`;
  if (currentRoute === route) routeFromHash();
}

/* --- overlay stack ----------------------------------------------------- */
function overlayHash() {
  const top = overlayStack[overlayStack.length - 1];
  const base = `#/${currentRoute}`;
  const next = top ? `${base}~${top.id}` : base;
  if (location.hash !== next) history.replaceState(null, '', next);
}

function overlayWidth(spec) {
  if (!spec.width) return '';
  return spec.kind === 'drawer'
    ? `min(${spec.width}px, 100%)`
    : `min(${spec.width}px, calc(100% - 32px))`;
}

function overlayHTML(spec) {
  return `
    ${spec.head ? `<div class="ov__head">${spec.head}</div>` : ''}
    <div class="ov__body">${spec.body}</div>
    ${spec.foot ? `<div class="ov__foot">${spec.foot}</div>` : ''}`;
}

function buildOverlay(id, spec) {
  spec = spec || OVERLAYS[id]();
  const el = document.createElement('div');
  el.className = `ov ov--${spec.kind}`;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.style.width = overlayWidth(spec);
  el.innerHTML = overlayHTML(spec);
  return el;
}

/* Scroll offsets and focus survive an in-place refresh — without this, pinning
   the fifth recommended metric would snap the rail back to the first, and a
   keyboard user would be dropped to the top of the drawer on every state write.
   Nodes are matched back up by tag, class and document order, which holds
   because a refresh re-renders the same template.
   `getAttribute` rather than `.className`: on an SVG element the latter is an
   SVGAnimatedString, so it would never compare equal across a re-render. */
const nodeSig = (el) => `${el.tagName}.${el.getAttribute('class') || ''}`;

function captureScroll(root) {
  return [...root.querySelectorAll('*')]
    .filter((el) => el.scrollTop || el.scrollLeft)
    .map((el) => [nodeSig(el), el.scrollTop, el.scrollLeft]);
}

function restoreScroll(root, saved) {
  if (!saved.length) return;
  const all = [...root.querySelectorAll('*')];
  const used = new Set();
  saved.forEach(([sig, top, left]) => {
    const el = all.find((n) => !used.has(n) && nodeSig(n) === sig);
    if (!el) return;
    used.add(el);
    el.scrollTop = top;
    el.scrollLeft = left;
  });
}

/** The action pair is the only stable identity a re-rendered control has, so
    that is what focus is restored by. Matched against `dataset` directly rather
    than through a selector, because an arg can be a commodity name and would
    need escaping. Controls with no action — plain inputs — are left alone
    rather than guessed at. */
function focusKeyOf(el) {
  if (!el || !el.dataset || !el.dataset.act) return null;
  return { act: el.dataset.act, arg: el.dataset.arg || '' };
}

function findByFocusKey(root, key) {
  return [...root.querySelectorAll('[data-act]')]
    .find((n) => n.dataset.act === key.act && (n.dataset.arg || '') === key.arg);
}

/** Replaces an overlay's contents without touching the container, so no entry
    transition replays. This is the path every state write and every step change
    takes; only `openOverlay` animates. */
function refreshOverlayEl(el, spec) {
  const scroll = captureScroll(el);
  const key = el.contains(document.activeElement) ? focusKeyOf(document.activeElement) : null;
  /* `.show` is normally already on by now — openOverlay adds it on the next
     frame. If a refresh beats that frame the panel would be left mid-entry, so
     settle it here rather than leaving it invisible. */
  el.classList.add('show');
  el.style.width = overlayWidth(spec);
  el.innerHTML = overlayHTML(spec);
  /* A refresh is a state write inside a panel that is already open — pinning the
     signal, taking an action, stepping to another drawer and back. The donut
     load-in belongs to the panel opening, so mark it played rather than sweeping
     the ring again on every keystroke. Same mechanic as `.plot--drawn`. */
  el.querySelectorAll('.donut--load').forEach((n) => n.classList.add('donut--drawn'));
  restoreScroll(el, scroll);
  const back = key && findByFocusKey(el, key);
  if (back) back.focus({ preventScroll: true });
}

function ensureBackdrop() {
  let bd = overlayLayer.querySelector('.backdrop');
  if (!bd) {
    bd = document.createElement('div');
    bd.className = 'backdrop';
    bd.addEventListener('click', () => closeOverlay());
    overlayLayer.appendChild(bd);
    requestAnimationFrame(() => bd.classList.add('show'));
  }
  return bd;
}

function openOverlay(id, silent) {
  if (!OVERLAYS[id]) return;
  ensureBackdrop();
  const el = buildOverlay(id);
  overlayLayer.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  overlayStack.push({ id, el });
  if (!silent) overlayHash();
  const focusable = el.querySelector('button, input, [tabindex]');
  if (focusable) focusable.focus({ preventScroll: true });
}

/** SWAP navigation — replaces the top overlay's contents in place, keeping the
    stack depth. The panel itself stays put: stepping through the Signal Details
    chain, or repainting after Mark As Completed, reads as the content changing
    rather than as the drawer closing and a new one flying in. A swap between
    kinds has no shared container to refresh, so that one still animates. */
function swapOverlay(id) {
  if (!OVERLAYS[id]) return;
  const spec = OVERLAYS[id]();
  const top = overlayStack[overlayStack.length - 1];
  if (top && top.el.classList.contains(`ov--${spec.kind}`)) {
    refreshOverlayEl(top.el, spec);
    top.id = id;
    overlayHash();
    return;
  }
  overlayStack.pop();
  if (top) top.el.remove();
  ensureBackdrop();
  const el = buildOverlay(id, spec);
  overlayLayer.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  overlayStack.push({ id, el });
  overlayHash();
}

function closeOverlay() {
  const top = overlayStack.pop();
  if (!top) return;
  top.el.classList.remove('show');
  setTimeout(() => top.el.remove(), 200);
  if (!overlayStack.length) {
    const bd = overlayLayer.querySelector('.backdrop');
    if (bd) { bd.classList.remove('show'); setTimeout(() => bd.remove(), 200); }
  }
  overlayHash();
  if (!overlayStack.length) markOpenSignalViewed();
}

function closeAllOverlays(immediate) {
  while (overlayStack.length) {
    const top = overlayStack.pop();
    if (immediate) top.el.remove();
    else { top.el.classList.remove('show'); setTimeout(() => top.el.remove(), 200); }
  }
  const bd = overlayLayer.querySelector('.backdrop');
  if (bd) { if (immediate) bd.remove(); else { bd.classList.remove('show'); setTimeout(() => bd.remove(), 200); } }
  /* `immediate` is the router tearing overlays down before rebuilding them from
     the hash, not the user closing a drawer — routeFromHash owns the New →
     Viewed transition on that path, so leave the state machine alone. */
  if (!immediate) markOpenSignalViewed();
}

function refreshTopOverlay() {
  const top = overlayStack[overlayStack.length - 1];
  if (top) swapOverlay(top.id);
}

/* --- tooltips ---------------------------------------------------------- */
let tipEl = null;
function showTip(anchor, html, variant) {
  hideTip();
  tipEl = document.createElement('div');
  tipEl.className = `tip${variant ? ` tip--${variant}` : ''}`;
  tipEl.innerHTML = html;
  tipLayer.appendChild(tipEl);
  const r = anchor.getBoundingClientRect();
  const tw = tipEl.offsetWidth, th = tipEl.offsetHeight;
  let left = r.left + r.width / 2 - tw / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));
  let top = r.top - th - 8;
  if (top < 8) top = r.bottom + 8;
  tipEl.style.left = `${left}px`;
  tipEl.style.top = `${top}px`;
  requestAnimationFrame(() => tipEl && tipEl.classList.add('show'));
}
function hideTip() {
  if (tipEl) { tipEl.remove(); tipEl = null; }
}

/* 37:22890 OnHover-Legends */
function legendTipHTML(monthIndex) {
  const rows = LEGEND_HOVER.rows.map((r) => `<div class="row">
    <span class="dot" style="background:${r.color}"></span>
    <span class="lbl">${esc(r.label)}</span><b>${esc(r.value)}</b></div>`).join('');
  return `<h4>${esc(MONTHS[monthIndex] ? MONTHS[monthIndex].replace(' 2', ' 202') : LEGEND_HOVER.month)}</h4>${rows}`;
}

/* --- listbox (37:22223) ------------------------------------------------ */
let listboxEl = null;
function showListbox(anchor, options, onPick) {
  hideListbox();
  listboxEl = document.createElement('div');
  listboxEl.className = 'listbox';
  listboxEl.setAttribute('role', 'listbox');
  listboxEl.innerHTML = options.map((o) =>
    `<button role="option" data-val="${esc(o)}">${esc(o)}</button>`).join('');
  tipLayer.appendChild(listboxEl);
  const r = anchor.getBoundingClientRect();
  listboxEl.style.left = `${Math.min(r.left, window.innerWidth - 192)}px`;
  listboxEl.style.top = `${Math.min(r.bottom + 4, window.innerHeight - listboxEl.offsetHeight - 8)}px`;
  listboxEl.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-val]');
    if (!b) return;
    onPick(b.dataset.val);
    hideListbox();
  });
}
function hideListbox() {
  if (listboxEl) { listboxEl.remove(); listboxEl = null; }
}

/* --- toast (37:22225 Alert) --------------------------------------------
   `undo` is either a callback to run when Undo is pressed, or false for a
   toast with no Undo. Omitting it keeps the original BLS behaviour.        */
function toast(title, text, opts = {}) {
  const undo = 'undo' in opts ? opts.undo : 'bls';
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.innerHTML = `${mi('check_circle', 'mi--sm')}
    <div class="toast__body"><b>${esc(title)}</b><span>${esc(text)}</span></div>
    ${undo === 'bls' ? '<button class="link" data-act="undo-bls">Undo</button>'
      : typeof undo === 'function' ? '<button class="link" data-undo="1">Undo</button>' : ''}
    <button class="ov-close" data-act="dismiss-toast" aria-label="Dismiss">${mi('close', 'mi--sm')}</button>`;

  const close = () => { el.classList.remove('show'); setTimeout(() => el.remove(), 200); };
  if (typeof undo === 'function') {
    el.querySelector('[data-undo]').addEventListener('click', () => { undo(); close(); });
  }
  toastLayer.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(close, 6000);
}

/* --- action dispatch --------------------------------------------------- */
const ACTIONS = {
  go: (arg) => { closeAllOverlays(); go(arg); },
  back: () => { if (history.length > 1) history.back(); else go('landing'); },
  overlay: (arg) => openOverlay(arg),
  swap: (arg) => swapOverlay(arg),
  close: () => closeOverlay(),
  noop: () => {},

  /* --- signal card state machine (R46) -------------------------------- */

  /** Card body click → open Signal Details. New → Viewed happens on close. */
  'open-signal': (arg) => {
    const s = signalById(arg);
    if (!s) return;
    openSignalId = arg;
    openOverlay(signalOverlayId(s));
  },

  /** Pin toggle — never opens the drawer (the button carries data-stop). */
  pin: (arg) => {
    const st = state.signals[arg];
    if (!st) return;
    st.pinned = !st.pinned;
    renderScreen();
    refreshTopOverlay();
  },

  /** Metric pin — adds/removes the metric from the landing Metrics widget.
      Also carries data-stop, so it never opens the metric info modal. The
      landing page repaints behind the drawer, and the drawer re-renders in
      place so both pin glyphs for the same metric stay in step. */
  'pin-metric': (arg) => {
    const m = METRICS_BY_ID[arg];
    if (!m) return;
    const key = metricKey(m);
    const on = state.metricPins.has(key);
    if (on) state.metricPins.delete(key); else state.metricPins.add(key);
    renderScreen();
    refreshTopOverlay();
    toast(on ? 'Metric Removed' : 'Metric Added',
      `'${m.label}' ${on ? 'removed from' : 'added to'} your Metrics widget.`, { undo: false });
  },

  /** Primary action taken: the Navi box gives way to `Last Updated by:` and
      Mark As Completed unlocks. Cards with a bespoke flow open that form
      first — nothing is committed until it is saved.

      A multi-action signal passes `<signalId>:<actionId>`, so the same handler
      serves a card CTA (which always means Navi's pick) and one of three
      panels inside the drawer. */
  'signal-action': (arg) => {
    const [id, aid] = String(arg).split(':');
    const s = signalById(id);
    if (!s) return;
    const acts = signalActions(s);
    const a = (aid && acts.find((x) => x.id === aid))
      || acts.find((x) => x.pick) || acts[0];
    if (!a) return;
    openSignalId = id;
    actionSignalId = id;
    actionId = a.id;
    /* A full-page action leaves the drawer behind — Agent Studio is a screen,
       not a form in a panel. Nothing is committed until the agent is run. */
    if (a.route && SCREENS[a.route]) { closeAllOverlays(); go(a.route); return; }
    /* An action can hand off to an agent instead of to a form. The drawer goes
       — the reader asked for the event, not for more of the signal — and the
       chat picks it up from there (212:47337). Nothing is committed until the
       flow's own Generate button, which is what `navi-commit` does. */
    if (a.naviFlow && NAVI_FLOWS[a.naviFlow]) {
      closeAllOverlays();
      openNaviChat(a.naviFlow);
      return;
    }
    const ov = a.overlay || s.ctaOverlay;
    if (ov) {
      if (overlayStack.length) swapOverlay(ov);
      else openOverlay(ov);
      return;
    }
    ACTIONS['commit-action'](arg);
  },

  /** Re-open what a taken action produced, read-only. Goes to the action's own
      `doneCta.overlay` if it names one, else back to the form (or page) it was
      taken on, which renders its own already-taken state. */
  'view-action': (arg) => {
    const [id, aid] = String(arg).split(':');
    const s = signalById(id);
    if (!s) return;
    const acts = signalActions(s);
    const a = (aid && acts.find((x) => x.id === aid)) || acts[0];
    if (!a) return;
    openSignalId = id;
    actionSignalId = id;
    actionId = a.id;
    const done = a.doneCta || s.doneCta || {};
    const to = done.overlay || a.overlay || s.ctaOverlay;
    if (!to) {
      const route = done.route || a.route;
      if (route && SCREENS[route]) { closeAllOverlays(); go(route); }
      return;
    }
    if (overlayStack.length) swapOverlay(to);
    else openOverlay(to);
  },

  /** Commit the action — from the card CTA directly, or from Save on a
      bespoke form. Advances New → Viewed, since acting on a signal has
      necessarily viewed it. */
  'commit-action': (arg) => {
    const [id, aid] = String(arg).split(':');
    const s = signalById(id);
    const st = state.signals[id];
    if (!s || !st) return;
    const acts = signalActions(s);
    const a = (aid && acts.find((x) => x.id === aid))
      || (actionId && acts.find((x) => x.id === actionId))
      || acts.find((x) => x.pick) || acts[0] || {};
    st.actionTaken = true;
    if (a.id) { st.actions = st.actions || {}; st.actions[a.id] = true; }
    if (st.status === 'New') st.status = 'Viewed';
    /* Coming back from a bespoke form, return to the signal's own drawer so
       the newly-unlocked Mark As Completed is right there. A page-based action
       has no drawer to return to — it reports on the page itself. */
    if (overlayStack.length && (a.overlay || s.ctaOverlay)) swapOverlay(signalOverlayId(s));
    else refreshTopOverlay();
    renderScreen();
    toast('Action Taken', `${a.cta || s.cta} started for '${s.title}'.`, { undo: false });
  },

  /* --- Navi chat (signal 4's hand-off to the event creation agent) ------ */

  /** Leave the flow. There is nothing to keep: the draft only becomes an event
      at Generate, so closing before then is a cancel, silently. */
  'navi-close': () => closeNaviChat(),

  /** The card the agent hands back (floating3) opens the review workspace. That
      is a step the reader takes, not one the reveal takes for them — the script
      stops at the card and waits. */
  'navi-review': () => naviView('review'),

  /** Out of a full-page view, back to the chat that produced it. */
  'navi-back': () => naviView('chat'),

  /** One line item open at a time, and clicking the open one closes it. */
  'navi-acc': (arg) => {
    const i = Number(arg);
    naviChat.acc = naviChat.acc === i ? -1 : i;
    renderNaviChat();
  },

  /** Generate: the draft becomes the event, and the page opens on it in Draft
      (212:53121). The chat is not done — Base Price is still unanswered — so it
      comes along, back down to the floating panel with one more thing to say.
      `naviChat.route` moves first: routeFromHash closes a chat whose route it
      has left behind, and this one is following the navigation, not being left
      by it. Committing through `commit-action` rather than setting the flags
      here keeps one definition of what a taken action means. */
  'navi-commit': () => {
    const f = naviChat.flow;
    if (!f) return;
    ACTIONS['commit-action'](f.signal);
    naviChat.route = f.route;
    naviChat.view = 'chat';
    go(f.route);
    naviPlay(f.done);
  },

  /** The sparkle beside Base Price: the one field the event creation agent left
      empty, handed to the Analytics Agent (212:54615 → 212:56139). It works
      whether or not the chat is still open — reopening it for the question
      starts at the question rather than replaying an event creation the reader
      has already watched. */
  'navi-price': (arg) => {
    const i = Number(arg);
    if (!naviChat.flow) {
      naviChat.flow = NAVI_FLOWS['sourcing-event'];
      naviChat.beats = [];
      naviChat.step = -1;
      naviChat.acc = 0;
      naviChat.art = null;
      naviChat.route = currentRoute;
    }
    naviChat.view = 'chat';
    naviPlay(naviPriceBeats(i));
  },

  /** Open the price trend artifact full page (212:57685). */
  'navi-artifact': (arg) => {
    naviChat.art = Number(arg);
    naviView('artifact');
  },

  /** Take the recommendation. Ours rather than the frame's — see
      naviInsightsHTML — so it writes the base price and says so on the page and
      in the card that recommended it. */
  'navi-apply-price': (arg) => {
    const i = Number(arg);
    const ln = naviPriceLine(i);
    if (!ln || !ln.price) return;
    state.basePrice[i] = ln.price.rec;
    renderScreen();
    renderNaviChat();
    toast('Base Price Filled', `${ln.name} priced at $${ln.price.rec} / gal by the Analytics `
      + 'Agent.', { undo: false });
  },

  /** Pick or unpick one of signal 3's suggested alternate suppliers. Identifying
      a backup is half of what the signal asks for, so the choice is the reader's
      to make and to change — the row toggles rather than latching. */
  'select-alt': (arg) => {
    const on = state.altSuppliers.has(arg);
    if (on) state.altSuppliers.delete(arg); else state.altSuppliers.add(arg);
    refreshTopOverlay();
    toast(on ? 'Alternate Removed' : 'Alternate Selected',
      `'${arg}' ${on ? 'removed from' : 'added to'} the reassessment as a backup supplier.`,
      { undo: false });
  },

  /* --- Agent Studio (signal 5's Refine Agent Parameters action) -------- */

  /** Copy the built-in agent. Built-in content is read-only, so this is the
      only way into refining it — the copy arrives with the laptops-by-region
      parameters already applied, which is the refinement the script describes. */
  'copy-agent': () => {
    if (state.agentCopied) return;
    state.agentCopied = true;
    renderScreen();
    toast('Agent Copied', `'${FRAG_AGENT.copyName}' created as a draft with 4 refined parameters.`,
      { undo: false });
  },

  /** Run the refined copy. This is the moment the action is taken on the signal
      too — the opportunities it creates are what the signal asked for — so it
      commits `refine-agent` and unlocks Mark As Completed back on the drawer. */
  'run-agent': () => {
    if (state.agentRun) return;
    state.agentRun = true;
    const s = fragSignal();
    if (s) {
      const st = state.signals[s.id];
      if (st) {
        st.actionTaken = true;
        st.actions = st.actions || {};
        st.actions['refine-agent'] = true;
        if (st.status === 'New') st.status = 'Viewed';
      }
    }
    renderScreen();
    const n = ((s && s.fragmentation && s.fragmentation.regions) || []).length;
    toast('Agent Run Complete',
      `${n} laptop fragmentation opportunities were created and published to the CFO Dashboard.`,
      { undo: false });
  },

  /** Mark As Completed → the card behind the drawer takes the Completed
      variant. The drawer stays open showing the Completed chip, so the
      change is visible in both places (R46). */
  'complete-signal': (arg) => {
    const s = signalById(arg);
    const st = state.signals[arg];
    if (!s || !st) return;
    st.status = 'Completed';
    openSignalId = null;          // already past Viewed; nothing to advance
    renderScreen();
    refreshTopOverlay();
    toast('Signal Completed', `'${s.title}' is marked as completed.`, { undo: false });
  },

  /** Dismiss → collapse the card out of the rail, offering an Undo. The note
      on the R46 flow puts dismissed signals under Signals → Views → Dismissed. */
  'dismiss-signal': (arg) => {
    const s = signalById(arg);
    const st = state.signals[arg];
    if (!s || !st) return;
    const prev = { status: st.status, dismissed: st.dismissed };
    st.status = 'Dismissed';
    st.dismissed = true;
    if (overlayStack.length) closeAllOverlays();

    const card = document.querySelector(`[data-signal="${arg}"]`);
    const finish = () => renderScreen();
    if (card) {
      card.classList.add('is-dismissing');
      card.addEventListener('transitionend', finish, { once: true });
      setTimeout(finish, 400);           // fallback if the transition is skipped
    } else finish();

    toast('Signal Dismissed', `'${s.title}' moved to Dismissed.`, {
      undo: () => { Object.assign(st, prev); renderScreen(); },
    });
  },

  /* A new time range is a new query, so the chart loads again. Removing a
     series is not — the remaining lines stay put rather than redrawing. */
  range: (arg) => {
    if (state.chartRange === arg) return;
    state.chartRange = arg;
    replayPlot = true;
    renderScreen();
  },
  'toggle-series': (arg) => {
    const i = Number(arg);
    if (state.hiddenSeries.has(i)) state.hiddenSeries.delete(i);
    else state.hiddenSeries.add(i);
    renderScreen();
  },

  /* The overflow chip opens the full list in place: the legend wraps to as many
     lines as it needs and the chip flips to a collapse. Local to the element
     rather than app state, so it resets on navigation like a disclosure should. */
  'legend-more': (arg, el) => {
    const legend = el.closest('[data-legend]');
    if (!legend) return;
    const open = legend.dataset.expanded === 'true';
    legend.dataset.expanded = open ? 'false' : 'true';
    legend.classList.toggle('is-expanded', !open);
    el.setAttribute('aria-expanded', String(!open));
    if (open) { fitLegend(); return; }
    legend.querySelectorAll('.legend__chip').forEach((c) => c.removeAttribute('hidden'));
    el.hidden = false;
    el.querySelector('.legend__more-n').textContent = 'Show less';
    el.setAttribute('aria-label', 'Show fewer indices');
  },
  'signals-view': (arg) => { state.signalsView = arg; renderScreen(); },
  track: (arg) => {
    const [name, value] = arg.split(':');
    state.track[name] = value;
    renderScreen();
  },
  /* Switching the widget back on mounts the chart fresh, so it loads in. */
  'toggle-price-chart': () => {
    state.priceChart = !state.priceChart;
    replayPlot = state.priceChart;
    renderScreen();
  },
  'dismiss-pref-alert': () => { state.prefAlertOpen = false; renderScreen(); },
  'apply-suggestions': () => {
    state.suggestionsApplied = true;
    closeAllOverlays();
    go('configure-preferences');
  },
  'toggle-signal': (arg) => {
    const [i, modal] = arg.split(':');
    state.signalToggles[i] = !state.signalToggles[i];
    if (SIGNAL_CATALOGUE[i][4] === 'bls') state.blsSignalOn = state.signalToggles[i];
    renderScreen();
    if (modal) openOverlay('add-pi-alerts');
  },
  'enable-bls': () => {
    state.blsSignalOn = true;
    const i = SIGNAL_CATALOGUE.findIndex((r) => r[4] === 'bls');
    if (i > -1) state.signalToggles[i] = true;
    renderScreen();
    toast('Signal Enabled', "'Price Index Fluctuations' Signal enabled.");
  },
  'undo-bls': (arg, el) => {
    state.blsSignalOn = false;
    const i = SIGNAL_CATALOGUE.findIndex((r) => r[4] === 'bls');
    if (i > -1) state.signalToggles[i] = false;
    const t = el.closest('.toast');
    if (t) { t.classList.remove('show'); setTimeout(() => t.remove(), 200); }
    renderScreen();
  },
  'dismiss-toast': (arg, el) => {
    const t = el.closest('.toast');
    if (t) { t.classList.remove('show'); setTimeout(() => t.remove(), 200); }
  },
  'series-tab': (arg) => { state.seriesTab = arg; refreshTopOverlay(); },
  'select-commodity': (arg) => { state.selectedCommodity = arg; swapOverlay('add-mapping-step2'); },
  'save-mapping': () => { state.mappingsMade = true; closeAllOverlays(); go('bls-mapping'); },
  'confirm-mapped': () => { state.mappingsMade = true; closeAllOverlays(); go('bls-mapping'); },
  collapse: (arg, el) => {
    const block = el.closest('.sd-block');
    if (!block) return;
    block.classList.toggle('is-collapsed');
    const chev = block.querySelector('.sd-block__head .mi:last-child');
    if (chev) chev.textContent = block.classList.contains('is-collapsed') ? 'expand_more' : 'expand_less';
  },
  listbox: (arg, el) => {
    showListbox(el, ['% Change by', '% Increased by', '% Decreased by', 'Target Value'], (v) => {
      state.alertCondition = v;
      refreshTopOverlay();
    });
  },
};

document.addEventListener('click', (e) => {
  hideTip();
  const holder = e.target.closest('[data-act]');
  if (!holder) { hideListbox(); return; }
  if (!listboxEl || !listboxEl.contains(e.target)) hideListbox();

  const act = holder.dataset.act;
  if (!ACTIONS[act]) return;
  if (holder.tagName === 'A') e.preventDefault();
  /* Buttons inside a clickable card must not also trigger the card. */
  if (holder.dataset.stop) e.stopPropagation();
  ACTIONS[act](holder.dataset.arg || '', holder);
});

/* keyboard: cards and rows respond to Enter/Space like their Figma hotspots */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    hideListbox();
    hideTip();
    /* Innermost first: the Navi chat sits over the overlays, so Escape has to
       take it before it takes anything behind it — and one layer at a time, so
       a full-page Navi view collapses to the floating panel rather than
       dismissing the whole conversation in one keystroke. */
    if (naviChat.flow && naviChat.view !== 'chat') naviView('chat');
    else if (naviChat.flow) closeNaviChat();
    else if (overlayStack.length) closeOverlay();
    return;
  }
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const holder = e.target.closest('[data-act]');
  if (!holder || holder.tagName === 'BUTTON' || holder.tagName === 'A') return;
  e.preventDefault();
  const act = holder.dataset.act;
  if (ACTIONS[act]) ACTIONS[act](holder.dataset.arg || '', holder);
});

/* ON_HOVER → OVERLAY: tooltips and the chart hover band */
document.addEventListener('mouseover', (e) => {
  const tipAnchor = e.target.closest('[data-tipkey]');
  if (tipAnchor) {
    const key = tipAnchor.dataset.tipkey;
    if (TOOLTIPS[key]) showTip(tipAnchor, esc(TOOLTIPS[key]));
    return;
  }
  const band = e.target.closest('[data-band]');
  if (band) {
    document.querySelectorAll('.hover-band.on').forEach((b) => b.classList.remove('on'));
    band.classList.add('on');
    showTip(band, legendTipHTML(Number(band.dataset.band)), 'legend');
    return;
  }
  if (tipEl) hideTip();
});
document.addEventListener('focusin', (e) => {
  const a = e.target.closest('[data-tipkey]');
  if (a && TOOLTIPS[a.dataset.tipkey]) showTip(a, esc(TOOLTIPS[a.dataset.tipkey]));
});
document.addEventListener('mouseout', (e) => {
  if (e.target.closest('[data-band]')) {
    document.querySelectorAll('.hover-band.on').forEach((b) => b.classList.remove('on'));
  }
});
window.addEventListener('scroll', hideTip, { passive: true });
window.addEventListener('resize', () => {
  hideTip(); hideListbox(); fitLegend();
  /* The workspace starts below the top navigation, and where that ends changes
     with the width — both bars reflow. Re-measure rather than cache. */
  if (naviChat.flow) naviLayer.style.setProperty('--navi-top', `${naviTop()}px`);
});
window.addEventListener('hashchange', routeFromHash);

/* boot — the prototype's starting-point-node-id is 37:25015 (landing) */
if (!location.hash) location.hash = '#/landing';
routeFromHash();
