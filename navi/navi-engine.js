/**
 * Navi prototype engine — vanilla JS, no dependencies.
 * Reads the script embedded in #navi-script-data and drives a simple state
 * machine: render current chips -> on click, echo the chip, render the node
 * it points to, render that node's chips, repeat. A node with no chips ends
 * the branch (a "Start over" chip is offered instead).
 *
 * #navi-panel also carries a data-state attribute ("welcome" | "active") that
 * switches which chrome block is visible (navi-styles.css does the hiding) —
 * "welcome" matches Figma node 15577:67206, "active" matches 15577:67143.
 * It starts "welcome" and flips to "active" the moment the user sends
 * anything (a chip, a typed prompt, or an attached file); "Start over" flips
 * it back.
 *
 * Node types: message | card | attachment | error | artifact | form |
 * promptLibrary | supplier | timeline | questionnaire | eventStatus — see
 * schema.md for the YAML shape of each. "error" renders exactly like
 * "message" (same bubble); it's a label for intent, not a different visual.
 *
 * Free-text intent matching: a script can define a top-level `intents` list
 * (see schema.md) mapping sample phrasings to a `next` node, so a typed
 * prompt — not just a chip click — can drive the flow. Matching is fuzzy
 * (word-level, typo-tolerant) specifically so a paraphrase or a misspelling
 * of a sample phrase still resolves to the right intent; it is NOT real NLU,
 * just enough keyword/edit-distance scoring for a demo. See matchIntent().
 *
 * `auto_next` on any node chains straight into another node with no chip
 * click in between (e.g. a "created" confirmation flowing directly into the
 * artifact it just created) — see schema.md.
 *
 * Attaching a file: the always-on "Attach" chip (appended to every chip
 * list — see ATTACH_CHIP) opens the native file picker, and dropping a file
 * anywhere on the panel does the same thing without it — both just call
 * handleAttachedFile() per file, which sends it immediately (no separate
 * "pending, click Send" staging step — that extra click wasn't intuitive).
 * The attachment bubble shows "Uploading..." briefly, flips to "Uploaded
 * just now", and then resolves follow-up the same way typed text does — see
 * below. See the drag-and-drop listeners near the bottom of this file. A
 * file over 25MB is rejected immediately (rejectOversizedFile()) with a
 * built-in error + retry guidance, before it ever becomes an attachment
 * bubble; there's no type restriction.
 *
 * Once a file finishes "uploading," a script can optionally define a
 * top-level `document_types` list (see schema.md) mapping filename keywords
 * to a `next` node, so attaching a file gets contextual follow-up chips
 * instead of the generic fallback — same idea as `intents`, but matched
 * against the filename and triggered by the attach itself rather than a
 * Send click. See matchDocumentType() and handleAttachedFile().
 */
(function () {
  "use strict";

  var script = JSON.parse(document.getElementById("navi-script-data").textContent);

  var launcher = document.getElementById("navi-launcher");
  var panel = document.getElementById("navi-panel");
  var closeBtn = document.getElementById("navi-close");
  var minimizeBtn = document.getElementById("navi-minimize");
  var transcript = document.getElementById("navi-transcript");
  var chipsContainer = document.getElementById("navi-chips");
  var panelBody = document.querySelector(".navi-panel-body");
  var inputField = document.getElementById("navi-input-field");
  var inputSendBtn = document.getElementById("navi-input-send");
  var fileInput = document.getElementById("navi-file-input");
  var artifactViewerEl = document.getElementById("navi-artifact-viewer");
  var artifactRailEl = document.getElementById("navi-artifact-rail");
  var artifactMainEl = document.getElementById("navi-artifact-main");

  function syncHeaderOffset() {
    // The panel docks below the shared host-app header, not the full
    // viewport (Figma node 15577:67470's "Navi Container" starts at the
    // bottom of "Header", not y:0 of the screen) — see navi-styles.css's
    // .navi-panel comment. Measured instead of hardcoded so it stays
    // correct if the header's own height ever changes (e.g. the search
    // pill wrapping at a narrower width), and simply no-ops on a page
    // with no .navi-app-header, where the panel should still run full height.
    var header = document.querySelector(".navi-app-header");
    if (!header) return;
    document.documentElement.style.setProperty("--navi-header-offset", header.offsetHeight + "px");
  }

  function setPanelState(state) {
    panel.setAttribute("data-state", state);
  }

  function openPanel() {
    panel.classList.add("navi-panel--open");
    panel.setAttribute("aria-hidden", "false");
    launcher.setAttribute("aria-expanded", "true");
    if (transcript.childElementCount === 0) {
      renderChips(script.entry_chips || []);
    }
  }

  function closePanel() {
    panel.classList.remove("navi-panel--open");
    panel.setAttribute("aria-hidden", "true");
    launcher.setAttribute("aria-expanded", "false");
    closeArtifactViewer();
  }

  function scrollToBottom() {
    // The scrollable element is `.navi-panel-body` (navi-styles.css gives it
    // `overflow-y: auto`) — `#navi-transcript` is just one child of it, sized
    // to its content with no scroll of its own, so scrolling it directly was
    // a no-op once the transcript + chips together overflowed the panel.
    if (!panelBody) return;
    panelBody.scrollTop = panelBody.scrollHeight;
  }

  // ---------- Markdown (opt-in via node.markdown: true) ----------
  // Deliberately minimal: bold, links, and one level of nested lists only —
  // the only elements the real "Markdown" Figma page documents with real
  // tokens. See schema.md's markdown rule for why italic/code/headings/
  // tables aren't implemented.
  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function renderInline(line) {
    return escapeHtml(line)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  }

  function renderMarkdown(text) {
    var lines = text.split("\n");
    var html = "";
    var listTag = null; // "ul" | "ol" | null
    var paragraph = [];

    function flushParagraph() {
      if (paragraph.length) {
        html += "<p>" + paragraph.join(" ") + "</p>";
        paragraph = [];
      }
    }

    function closeList() {
      if (listTag) {
        html += "</" + listTag + ">";
        listTag = null;
      }
    }

    lines.forEach(function (rawLine) {
      var line = rawLine.trim();
      if (!line) {
        flushParagraph();
        closeList();
        return;
      }
      var ulMatch = line.match(/^[-*]\s+(.*)/);
      var olMatch = line.match(/^\d+\.\s+(.*)/);
      if (ulMatch) {
        flushParagraph();
        if (listTag !== "ul") {
          closeList();
          html += "<ul>";
          listTag = "ul";
        }
        html += "<li>" + renderInline(ulMatch[1]) + "</li>";
      } else if (olMatch) {
        flushParagraph();
        if (listTag !== "ol") {
          closeList();
          html += "<ol>";
          listTag = "ol";
        }
        html += "<li>" + renderInline(olMatch[1]) + "</li>";
      } else {
        closeList();
        paragraph.push(renderInline(line));
      }
    });
    flushParagraph();
    closeList();
    return html;
  }

  // ---------- Feedback thumbs (always-on chrome under navi content) ----------

  function appendFeedback(container, feedbackCfg, nodeId) {
    var bar = document.createElement("div");
    bar.className = "navi-feedback";

    function makeBtn(kind, iconFile) {
      var btn = document.createElement("button");
      btn.className = "navi-feedback-btn";
      btn.setAttribute("aria-label", kind === "up" ? "Helpful" : "Not helpful");
      btn.setAttribute("aria-pressed", "false");
      var img = document.createElement("img");
      img.src = "assets/navi/" + iconFile;
      img.alt = "";
      btn.appendChild(img);
      btn.addEventListener("click", function () {
        var already = btn.classList.contains("is-active");
        bar.querySelectorAll(".navi-feedback-btn").forEach(function (b) {
          b.classList.remove("is-active");
          b.setAttribute("aria-pressed", "false");
        });
        if (already) {
          return;
        }
        btn.classList.add("is-active");
        btn.setAttribute("aria-pressed", "true");

        var branch = feedbackCfg && (kind === "up" ? feedbackCfg.thumbs_up : feedbackCfg.thumbs_down);
        if (branch && branch.next) {
          if (branch.echo) {
            appendMessage("user", branch.echo);
          }
          setPanelState("active");
          renderNode(branch.next);
        }
      });
      return btn;
    }

    bar.appendChild(makeBtn("up", "navi-thumb-up-icon.svg"));
    bar.appendChild(makeBtn("down", "navi-thumb-down-icon.svg"));
    container.appendChild(bar);
  }

  function appendFeedbackForm(formCfg) {
    var el = document.createElement("div");
    el.className = "navi-card navi-feedback-form";

    var title = document.createElement("div");
    title.className = "navi-feedback-form-title";
    title.textContent = formCfg.title || "Could you share what led to your response?";
    el.appendChild(title);

    if (formCfg.subtitle) {
      var subtitle = document.createElement("div");
      subtitle.className = "navi-feedback-form-subtitle";
      subtitle.textContent = formCfg.subtitle;
      el.appendChild(subtitle);
    }

    var textarea = document.createElement("textarea");
    textarea.className = "navi-feedback-textarea";
    textarea.placeholder = formCfg.placeholder || "Any additional thoughts?";
    el.appendChild(textarea);

    var submit = document.createElement("button");
    submit.className = "navi-feedback-submit";
    submit.textContent = formCfg.submit_label || "Submit";
    submit.addEventListener("click", function () {
      var value = textarea.value.trim();
      appendMessage("user", value || "(submitted without additional comments)");
      renderNode(formCfg.next);
    });
    el.appendChild(submit);

    transcript.appendChild(el);
    scrollToBottom();
  }

  // ---------- Core content renderers ----------

  function appendMessage(speaker, text, options) {
    var el = document.createElement("div");
    el.className = "navi-message navi-message--" + speaker;
    if (options && options.markdown) {
      el.innerHTML = renderMarkdown(text);
    } else {
      el.textContent = text;
    }
    transcript.appendChild(el);
    if (speaker === "navi" && options && options.feedback !== false) {
      appendFeedback(transcript, options && options.feedbackCfg);
    }
    scrollToBottom();
    return el;
  }

  function appendCard(card, speaker) {
    var el = document.createElement("div");
    el.className = "navi-card";

    var title = document.createElement("div");
    title.className = "navi-card-title";
    title.textContent = card.title;
    el.appendChild(title);

    (card.fields || []).forEach(function (field) {
      var row = document.createElement("div");
      row.className = "navi-card-field";

      var label = document.createElement("span");
      label.className = "navi-card-field-label";
      label.textContent = field.label;

      var value = document.createElement("span");
      value.className = "navi-card-field-value";
      value.textContent = field.value;

      row.appendChild(label);
      row.appendChild(value);
      el.appendChild(row);
    });

    transcript.appendChild(el);
    if (speaker === "navi") {
      appendFeedback(transcript);
    }
    scrollToBottom();
  }

  function appendAttachment(attachment, speaker) {
    var el = document.createElement("div");
    el.className = "navi-card navi-attachment" + (speaker === "user" ? " navi-attachment--user" : "");

    var row1 = document.createElement("div");
    row1.className = "navi-attachment-row1";

    if (attachment.tag) {
      var tag = document.createElement("span");
      tag.className = "navi-attachment-tag";
      var tagLabel = document.createElement("span");
      tagLabel.className = "navi-attachment-tag-label";
      tagLabel.textContent = attachment.tag;
      tag.appendChild(tagLabel);
      row1.appendChild(tag);
    }

    var filename = document.createElement("span");
    filename.className = "navi-attachment-filename";
    filename.textContent = attachment.filename;
    row1.appendChild(filename);
    el.appendChild(row1);

    var row2 = document.createElement("div");
    row2.className = "navi-attachment-row2";

    var icon = document.createElement("img");
    icon.className = "navi-attachment-icon";
    icon.src = "assets/navi/navi-file-icon.svg";
    icon.alt = "";
    row2.appendChild(icon);

    var info = document.createElement("div");
    info.className = "navi-attachment-info";
    (attachment.meta || []).forEach(function (line, i) {
      var p = document.createElement("div");
      p.className = "navi-attachment-info-line--" + (i === 0 ? "primary" : "secondary");
      p.textContent = line;
      info.appendChild(p);
    });
    row2.appendChild(info);

    var actions = document.createElement("div");
    actions.className = "navi-attachment-actions";

    var download = document.createElement("button");
    download.className = "navi-attachment-download";
    var downloadIcon = document.createElement("img");
    downloadIcon.className = "navi-attachment-download-icon";
    downloadIcon.src = "assets/navi/navi-download-icon.svg";
    downloadIcon.alt = "";
    download.appendChild(downloadIcon);
    download.appendChild(document.createTextNode(attachment.downloadLabel || "Download"));
    actions.appendChild(download);

    var chevron = document.createElement("button");
    chevron.className = "navi-attachment-chevron";
    var chevronIcon = document.createElement("img");
    chevronIcon.width = 16;
    chevronIcon.height = 16;
    chevronIcon.src = "assets/navi/navi-chevron-right-icon.svg";
    chevronIcon.alt = "";
    chevron.appendChild(chevronIcon);
    actions.appendChild(chevron);

    row2.appendChild(actions);
    el.appendChild(row2);

    transcript.appendChild(el);
    if (speaker !== "user") {
      appendFeedback(transcript);
    }
    scrollToBottom();
    return el;
  }

  // All artifacts generated so far this session, oldest first — backs the
  // full-page viewer's rail. Capped at 25 to match the real component's own
  // stated limit (see schema.md); the oldest is dropped once a 26th arrives.
  var naviArtifacts = [];
  var naviArtifactViewerOpen = false;

  function buildBarChart(data, className) {
    var max = Math.max.apply(
      null,
      data.map(function (d) {
        return d.value;
      })
    );
    var chart = document.createElement("div");
    chart.className = className;
    data.forEach(function (point) {
      var col = document.createElement("div");
      col.className = "navi-artifact-bar-col";
      var fill = document.createElement("div");
      fill.className = "navi-artifact-bar-fill";
      fill.style.height = Math.max(4, (point.value / max) * 100) + "%";
      var label = document.createElement("div");
      label.className = "navi-artifact-bar-label";
      label.textContent = point.label;
      col.appendChild(fill);
      col.appendChild(label);
      chart.appendChild(col);
    });
    return chart;
  }

  function artifactKindInfo(kind) {
    if (kind === "table") return { icon: "navi-table-icon.svg", label: "Table" };
    if (kind === "chart") return { icon: "navi-artifact-chart-icon.svg", label: "Bar Chart" };
    return { icon: "navi-artifact-file-icon.svg", label: "Document" };
  }

  function appendArtifact(artifact) {
    naviArtifacts.push(artifact);
    if (naviArtifacts.length > 25) {
      naviArtifacts.shift();
    }
    var artifactIndex = naviArtifacts.length - 1;

    var el = document.createElement("div");
    el.className = "navi-card navi-artifact-card" + (artifact.kind === "chart" ? " navi-artifact-card--chart" : "");
    el.tabIndex = 0;
    el.setAttribute("role", "button");
    el.setAttribute("aria-label", "Open " + artifact.title + " full page");
    el.addEventListener("click", function () {
      openArtifactViewer(artifactIndex);
    });

    var title = document.createElement("div");
    title.className = "navi-artifact-title";
    title.textContent = artifact.title;
    el.appendChild(title);

    var typeRow = document.createElement("div");
    typeRow.className = "navi-artifact-type-row";

    var kindInfo = artifactKindInfo(artifact.kind);
    var icon = document.createElement("img");
    icon.className = "navi-artifact-type-icon";
    icon.src = "assets/navi/" + kindInfo.icon;
    icon.alt = "";
    typeRow.appendChild(icon);

    var typeLabel = document.createElement("span");
    typeLabel.className = "navi-artifact-type-label";
    typeLabel.textContent = kindInfo.label;
    typeRow.appendChild(typeLabel);

    var actions = document.createElement("div");
    actions.className = "navi-artifact-actions";
    if (artifact.kind === "file") {
      var download = document.createElement("button");
      download.className = "navi-attachment-download";
      download.addEventListener("click", function (event) {
        event.stopPropagation();
      });
      var downloadIcon = document.createElement("img");
      downloadIcon.className = "navi-attachment-download-icon";
      downloadIcon.src = "assets/navi/navi-download-icon.svg";
      downloadIcon.alt = "";
      download.appendChild(downloadIcon);
      download.appendChild(document.createTextNode("Download"));
      actions.appendChild(download);
    }
    var expand = document.createElement("button");
    expand.className = "navi-artifact-expand";
    expand.setAttribute("aria-label", "Open " + artifact.title + " full page");
    expand.addEventListener("click", function (event) {
      event.stopPropagation();
      openArtifactViewer(artifactIndex);
    });
    var expandIcon = document.createElement("img");
    expandIcon.width = 16;
    expandIcon.height = 16;
    expandIcon.src = "assets/navi/navi-expand-icon.svg";
    expandIcon.alt = "";
    expand.appendChild(expandIcon);
    actions.appendChild(expand);
    typeRow.appendChild(actions);
    el.appendChild(typeRow);

    transcript.appendChild(el);
    appendFeedback(transcript);
    scrollToBottom();
  }

  // ---------- Full-page artifact viewer (left side, Navi panel stays open) ----------

  function renderArtifactRail(activeIndex) {
    artifactRailEl.innerHTML = "";
    naviArtifacts.forEach(function (artifact, index) {
      var kindInfo = artifactKindInfo(artifact.kind);
      var item = document.createElement("button");
      item.className = "navi-artifact-rail-item" + (index === activeIndex ? " is-active" : "");
      var itemTitle = document.createElement("span");
      itemTitle.className = "navi-artifact-rail-item-title";
      itemTitle.textContent = artifact.title;
      var itemKind = document.createElement("span");
      itemKind.className = "navi-artifact-rail-item-kind";
      itemKind.textContent = kindInfo.label;
      item.appendChild(itemTitle);
      item.appendChild(itemKind);
      item.addEventListener("click", function () {
        openArtifactViewer(index);
      });
      artifactRailEl.appendChild(item);
    });
  }

  function renderArtifactMain(artifact) {
    artifactMainEl.innerHTML = "";

    var head = document.createElement("div");
    head.className = "navi-artifact-main-head";
    var titleEl = document.createElement("h2");
    titleEl.className = "navi-artifact-main-title";
    titleEl.textContent = artifact.title;
    head.appendChild(titleEl);

    var actions = document.createElement("div");
    actions.className = "navi-artifact-main-actions";
    if (artifact.kind === "file") {
      var download = document.createElement("button");
      download.className = "navi-artifact-main-action";
      download.setAttribute("aria-label", "Download");
      var downloadIcon = document.createElement("img");
      downloadIcon.src = "assets/navi/navi-download-icon.svg";
      downloadIcon.alt = "";
      downloadIcon.width = 16;
      downloadIcon.height = 16;
      download.appendChild(downloadIcon);
      actions.appendChild(download);
    }
    var closeBtn = document.createElement("button");
    closeBtn.className = "navi-artifact-main-action";
    closeBtn.setAttribute("aria-label", "Close full-page view");
    closeBtn.addEventListener("click", closeArtifactViewer);
    var closeIcon = document.createElement("img");
    closeIcon.src = "assets/navi/navi-artifact-collapse-icon.svg";
    closeIcon.alt = "";
    closeIcon.width = 16;
    closeIcon.height = 16;
    closeBtn.appendChild(closeIcon);
    actions.appendChild(closeBtn);
    head.appendChild(actions);
    artifactMainEl.appendChild(head);

    if (artifact.kind === "chart" && (artifact.data || []).length) {
      artifactMainEl.appendChild(buildBarChart(artifact.data, "navi-artifact-main-chart"));
    } else if (artifact.content) {
      var content = document.createElement("div");
      content.className = "navi-artifact-main-content";
      artifact.content.split(/\n\s*\n/).forEach(function (paragraph) {
        var p = document.createElement("p");
        p.textContent = paragraph.trim();
        content.appendChild(p);
      });
      artifactMainEl.appendChild(content);
    } else {
      var empty = document.createElement("p");
      empty.className = "navi-artifact-main-empty";
      empty.textContent = "No full content for this artifact in this prototype.";
      artifactMainEl.appendChild(empty);
    }
  }

  function openArtifactViewer(index) {
    var artifact = naviArtifacts[index];
    if (!artifact) return;
    renderArtifactRail(index);
    renderArtifactMain(artifact);
    artifactViewerEl.classList.add("navi-artifact-viewer--open");
    naviArtifactViewerOpen = true;
    // The viewer is a full-screen overlay over the host page's content area —
    // nothing behind it should be able to scroll while it's open (wheeling
    // over the overlay's own non-scrollable background was bubbling straight
    // through to the host page's scroll underneath it). navi-styles.css's
    // `html.navi-body-scroll-locked` rule does the actual locking.
    document.documentElement.classList.add("navi-body-scroll-locked");
  }

  function closeArtifactViewer() {
    artifactViewerEl.classList.remove("navi-artifact-viewer--open");
    naviArtifactViewerOpen = false;
    document.documentElement.classList.remove("navi-body-scroll-locked");
  }

  // ---------- Supplier card / carousel ----------
  // Real "Supplier Card" component (221 Navi UI Kit), Internal/External variants —
  // see SKILL.md for the exact node IDs. A single supplier renders one static card;
  // 2+ renders a carousel (counter, dot pager, prev/next), matching the real
  // multi-supplier pattern. The chevron (internal) and CTA button (external) are
  // decorative, same treatment as every other non-wired button in this prototype.

  function buildSupplierCard(supplier) {
    var variant = supplier.variant === "external" ? "external" : "internal";
    var el = document.createElement("article");
    el.className = "navi-supplier-card navi-supplier-card--" + variant;

    var head = document.createElement("div");
    head.className = "navi-supplier-card-head";
    var name = document.createElement("span");
    name.className = "navi-supplier-card-name";
    name.textContent = supplier.name;
    head.appendChild(name);
    el.appendChild(head);

    var chipsRow = document.createElement("div");
    chipsRow.className = "navi-supplier-card-chips";
    var chip = document.createElement("span");
    chip.className = "navi-supplier-chip navi-supplier-chip--" + variant;
    var chipLabel = document.createElement("span");
    chipLabel.textContent = variant === "external" ? "External" : "Internal";
    chip.appendChild(chipLabel);
    chipsRow.appendChild(chip);
    if (variant === "internal") {
      [
        ["assets/navi/supplier-card-new-badge.svg", "New"],
        ["assets/navi/supplier-card-diversity-icon.svg", "Diversity"],
        ["assets/navi/supplier-card-trusted-icon.svg", "Trusted supplier"],
      ].forEach(function (badge) {
        var img = document.createElement("img");
        img.className = "navi-supplier-badge";
        img.src = badge[0];
        img.alt = badge[1];
        img.width = 24;
        img.height = 24;
        chipsRow.appendChild(img);
      });
    }
    el.appendChild(chipsRow);

    var bodyRow = document.createElement("div");
    bodyRow.className = "navi-supplier-card-body";

    var content = document.createElement("div");
    content.className = "navi-supplier-card-content";

    var website = document.createElement("div");
    website.className = "navi-supplier-website";
    website.textContent = supplier.website;
    content.appendChild(website);

    var categories = document.createElement("div");
    categories.className = "navi-supplier-categories";
    categories.textContent = supplier.categories;
    content.appendChild(categories);

    var location = document.createElement("div");
    location.className = "navi-supplier-location";
    location.textContent = supplier.location;
    content.appendChild(location);

    content.appendChild(buildSupplierSection("Overview", supplier.overview));
    if (variant === "internal" && supplier.certifications) {
      content.appendChild(buildSupplierSection("Certificates & Diversity", supplier.certifications, true));
    }

    var highlight = document.createElement("div");
    highlight.className = "navi-supplier-highlight";
    var highlightLabel = document.createElement("span");
    highlightLabel.className = "navi-supplier-highlight-label";
    highlightLabel.textContent = "Highlight: ";
    var highlightText = document.createElement("span");
    highlightText.textContent = supplier.highlight;
    highlight.appendChild(highlightLabel);
    highlight.appendChild(highlightText);
    content.appendChild(highlight);

    bodyRow.appendChild(content);

    if (variant === "internal") {
      var chevronBtn = document.createElement("button");
      chevronBtn.className = "navi-supplier-chevron";
      chevronBtn.setAttribute("aria-label", "View " + supplier.name + " details");
      var chevronIcon = document.createElement("img");
      chevronIcon.src = "assets/navi/supplier-card-chevron-icon.svg";
      chevronIcon.alt = "";
      chevronIcon.width = 16;
      chevronIcon.height = 16;
      chevronBtn.appendChild(chevronIcon);
      bodyRow.appendChild(chevronBtn);
    }

    el.appendChild(bodyRow);

    if (variant === "external") {
      var ctaRow = document.createElement("div");
      ctaRow.className = "navi-supplier-cta-row";
      var cta = document.createElement("button");
      cta.className = "navi-supplier-cta";
      cta.textContent = supplier.cta || "Onboard Supplier";
      ctaRow.appendChild(cta);
      el.appendChild(ctaRow);
    }

    return el;
  }

  function buildSupplierSection(label, text, valueIsPrimary) {
    var section = document.createElement("div");
    section.className = "navi-supplier-section";
    var labelEl = document.createElement("span");
    labelEl.className = "navi-supplier-section-label";
    labelEl.textContent = label;
    var textEl = document.createElement("p");
    textEl.className = "navi-supplier-section-text" + (valueIsPrimary ? " navi-supplier-section-text--primary" : "");
    textEl.textContent = text;
    section.appendChild(labelEl);
    section.appendChild(textEl);
    return section;
  }

  function appendSupplierCard(node, speaker) {
    var suppliers = node.suppliers || [];
    var wrap = document.createElement("div");
    wrap.className = "navi-supplier-wrap";

    if (suppliers.length <= 1) {
      if (suppliers[0]) {
        wrap.appendChild(buildSupplierCard(suppliers[0]));
      }
    } else {
      wrap.classList.add("navi-supplier-wrap--carousel");
      var current = 0;

      var headEl = document.createElement("div");
      headEl.className = "navi-supplier-carousel-head";
      var titleEl = document.createElement("span");
      titleEl.textContent = (node.title || "Recommended Suppliers") + " ";
      var counterEl = document.createElement("span");
      counterEl.className = "navi-supplier-carousel-counter";
      headEl.appendChild(titleEl);
      headEl.appendChild(counterEl);
      wrap.appendChild(headEl);

      var viewport = document.createElement("div");
      viewport.className = "navi-supplier-carousel-viewport";
      var track = document.createElement("div");
      track.className = "navi-supplier-carousel-track";
      suppliers.forEach(function (supplier) {
        var slide = document.createElement("div");
        slide.className = "navi-supplier-carousel-slide";
        slide.appendChild(buildSupplierCard(supplier));
        track.appendChild(slide);
      });
      viewport.appendChild(track);
      wrap.appendChild(viewport);

      var controls = document.createElement("div");
      controls.className = "navi-supplier-carousel-controls";

      var prevBtn = document.createElement("button");
      prevBtn.className = "navi-supplier-carousel-arrow";
      prevBtn.setAttribute("aria-label", "Previous supplier");
      var prevIcon = document.createElement("img");
      prevIcon.src = "assets/navi/supplier-card-carousel-prev.svg";
      prevIcon.alt = "";
      prevIcon.width = 16;
      prevIcon.height = 16;
      prevBtn.appendChild(prevIcon);
      controls.appendChild(prevBtn);

      var dots = suppliers.map(function () {
        var dot = document.createElement("button");
        dot.className = "navi-supplier-carousel-dot";
        var dotIcon = document.createElement("img");
        dotIcon.width = 10;
        dotIcon.height = 10;
        dotIcon.alt = "";
        dot.appendChild(dotIcon);
        controls.appendChild(dot);
        return dot;
      });

      var nextBtn = document.createElement("button");
      nextBtn.className = "navi-supplier-carousel-arrow";
      nextBtn.setAttribute("aria-label", "Next supplier");
      var nextIcon = document.createElement("img");
      nextIcon.src = "assets/navi/supplier-card-carousel-next.svg";
      nextIcon.alt = "";
      nextIcon.width = 16;
      nextIcon.height = 16;
      nextBtn.appendChild(nextIcon);
      controls.appendChild(nextBtn);

      wrap.appendChild(controls);

      function goTo(index) {
        current = Math.max(0, Math.min(suppliers.length - 1, index));
        track.style.transform = "translateX(" + (-100 * current) + "%)";
        counterEl.textContent = "(" + (current + 1) + "/" + suppliers.length + ")";
        prevBtn.disabled = current === 0;
        nextBtn.disabled = current === suppliers.length - 1;
        dots.forEach(function (dot, i) {
          dot.classList.toggle("is-active", i === current);
          dot.querySelector("img").src = i === current
            ? "assets/navi/supplier-card-carousel-dot-active.svg"
            : "assets/navi/supplier-card-carousel-dot-inactive.svg";
        });
      }

      prevBtn.addEventListener("click", function () {
        goTo(current - 1);
      });
      nextBtn.addEventListener("click", function () {
        goTo(current + 1);
      });
      dots.forEach(function (dot, i) {
        dot.addEventListener("click", function () {
          goTo(i);
        });
      });

      goTo(0);
    }

    transcript.appendChild(wrap);
    if (speaker === "navi") {
      appendFeedback(transcript);
    }
    scrollToBottom();
  }

  function appendForm(node) {
    var form = node.form;
    var el = document.createElement("div");
    el.className = "navi-card";

    if (form.title) {
      var title = document.createElement("div");
      title.className = "navi-form-title";
      title.textContent = form.title;
      el.appendChild(title);
    }

    var inputs = [];
    (form.fields || []).slice(0, 4).forEach(function (field) {
      var fieldEl = document.createElement("div");
      fieldEl.className = "navi-form-field";

      var label = document.createElement("label");
      label.className = "navi-form-field-label";
      label.textContent = field.label;
      fieldEl.appendChild(label);

      var input;
      if (field.kind === "select") {
        input = document.createElement("select");
        input.className = "navi-form-select";
        (field.options || []).forEach(function (opt) {
          var optionEl = document.createElement("option");
          optionEl.value = opt;
          optionEl.textContent = opt;
          input.appendChild(optionEl);
        });
      } else {
        input = document.createElement("input");
        input.className = "navi-form-input";
        input.type = field.kind === "date" ? "date" : "text";
      }
      fieldEl.appendChild(input);
      el.appendChild(fieldEl);
      inputs.push({ label: field.label, input: input });
    });

    var actions = document.createElement("div");
    actions.className = "navi-form-actions";
    var submit = document.createElement("button");
    submit.className = "navi-form-submit";
    submit.textContent = form.submitLabel || "Submit";
    submit.addEventListener("click", function () {
      var summary = inputs
        .map(function (f) {
          return f.label + ": " + (f.input.value || "—");
        })
        .join(" · ");
      appendMessage("user", summary);
      setPanelState("active");
      renderNode(node.next);
    });
    actions.appendChild(submit);
    el.appendChild(actions);

    transcript.appendChild(el);
    appendFeedback(transcript);
    scrollToBottom();
  }

  // ---------- Timeline (type: timeline) ----------
  // extracted: MaXc9HUQGFiYdkYLzBN1fx node 128:35493 (all steps collapsed) +
  // node 982:108069 (the "Supplier" step's accordion open) — see SKILL.md.
  // A step with a `details` list becomes a clickable accordion (collapsed:
  // plain row + chevron-right button; open: bordered box, chevron-down, a
  // divider, then a bullet list); a step with no `details` is never
  // clickable. Each accordion toggles independently — nothing in the source
  // implies only one may be open at a time.

  function buildTimelineStepText(text) {
    var frag = document.createDocumentFragment();
    String(text || "")
      .split(/\n\s*\n/)
      .forEach(function (paragraph) {
        var p = document.createElement("p");
        p.className = "navi-timeline-step-text";
        paragraph.split("\n").forEach(function (line, idx) {
          if (idx > 0) p.appendChild(document.createElement("br"));
          p.appendChild(document.createTextNode(line));
        });
        frag.appendChild(p);
      });
    return frag;
  }

  function buildTimelineStepRow(step) {
    var row = document.createElement("div");
    row.className = "navi-timeline-step-row";

    var icon = document.createElement("img");
    icon.className = "navi-timeline-step-icon";
    icon.src = step.status === "active"
      ? "assets/navi/navi-timeline-step-active-icon.svg"
      : "assets/navi/navi-timeline-step-done-icon.svg";
    icon.alt = "";
    row.appendChild(icon);

    var content = document.createElement("div");
    content.className = "navi-timeline-step-content";
    var title = document.createElement("p");
    title.className = "navi-timeline-step-title";
    title.textContent = step.title;
    content.appendChild(title);
    content.appendChild(buildTimelineStepText(step.text));
    row.appendChild(content);

    return row;
  }

  function appendTimeline(timeline, speaker) {
    var el = document.createElement("div");
    el.className = "navi-timeline";

    (timeline.steps || []).forEach(function (step) {
      var stepEl = document.createElement("div");
      stepEl.className = "navi-timeline-step";
      var hasDetails = Array.isArray(step.details) && step.details.length > 0;
      var isOpen = false;

      function render() {
        stepEl.innerHTML = "";

        if (!hasDetails) {
          stepEl.appendChild(buildTimelineStepRow(step));
        } else {
          var wrap = document.createElement("div");
          wrap.className = isOpen ? "navi-timeline-accordion--open" : "";

          var toggle = document.createElement("button");
          toggle.type = "button";
          toggle.className = "navi-timeline-accordion-toggle";
          toggle.appendChild(buildTimelineStepRow(step));

          var chevronWrap = document.createElement("span");
          chevronWrap.className = "navi-timeline-accordion-chevron-wrap";
          var chevron = document.createElement("img");
          chevron.className = "navi-timeline-accordion-chevron";
          chevron.src = isOpen
            ? "assets/navi/navi-chevron-down-icon.svg"
            : "assets/navi/navi-chevron-right-icon.svg";
          chevron.alt = "";
          chevronWrap.appendChild(chevron);
          toggle.appendChild(chevronWrap);

          toggle.addEventListener("click", function () {
            isOpen = !isOpen;
            render();
          });
          wrap.appendChild(toggle);

          if (isOpen) {
            var panel = document.createElement("div");
            panel.className = "navi-timeline-accordion-panel";
            var list = document.createElement("ul");
            list.className = "navi-timeline-accordion-list";
            step.details.forEach(function (line) {
              var li = document.createElement("li");
              li.textContent = line;
              list.appendChild(li);
            });
            panel.appendChild(list);
            wrap.appendChild(panel);
          }

          stepEl.appendChild(wrap);
        }

        var connector = document.createElement("div");
        connector.className = "navi-timeline-step-connector";
        var line = document.createElement("img");
        line.src = "assets/navi/navi-timeline-step-line.svg";
        line.alt = "";
        connector.appendChild(line);
        stepEl.appendChild(connector);
      }

      render();
      el.appendChild(stepEl);
    });

    transcript.appendChild(el);
    if (speaker === "navi") {
      appendFeedback(transcript);
    }
    scrollToBottom();
  }

  // ---------- Questionnaire (type: questionnaire) ----------
  // extracted: MaXc9HUQGFiYdkYLzBN1fx node 1202:94803 (default view) +
  // 1202:94942 (one category added, open) + 1202:95081 (all added, one
  // open — confirms "added" and "open" are independent per-category toggles,
  // not tied together). Clicking a category's row toggles open/closed;
  // clicking its Add/Remove button toggles added (green border + check
  // badge) without affecting open/closed, same "independent toggle" pattern
  // used for the timeline's accordion steps.

  function buildQuestionnaireCategory(category) {
    var wrap = document.createElement("div");
    var isOpen = !!category.open;
    var isAdded = !!category.added;

    function render() {
      wrap.innerHTML = "";
      wrap.className = "navi-questionnaire-category" + (isAdded ? " navi-questionnaire-category--added" : "");

      if (isAdded) {
        var badge = document.createElement("div");
        badge.className = "navi-questionnaire-badge";
        var badgeIcon = document.createElement("img");
        badgeIcon.src = "assets/navi/navi-questionnaire-badge-check-icon.svg";
        badgeIcon.alt = "";
        badge.appendChild(badgeIcon);
        wrap.appendChild(badge);
      }

      var header = document.createElement("div");
      header.className = "navi-questionnaire-header" + (isOpen ? " navi-questionnaire-header--open" : "");
      header.tabIndex = 0;
      header.setAttribute("role", "button");
      header.setAttribute("aria-label", (isOpen ? "Collapse " : "Expand ") + category.title);
      header.addEventListener("click", function () {
        isOpen = !isOpen;
        render();
      });

      var content = document.createElement("div");
      content.className = "navi-questionnaire-content";

      var titleEl = document.createElement("p");
      titleEl.className = "navi-questionnaire-title";
      titleEl.appendChild(document.createTextNode(category.title));
      if (category.weight != null) {
        var weightEl = document.createElement("span");
        weightEl.className = "navi-questionnaire-weight";
        weightEl.textContent = " (" + category.weight + "%)";
        titleEl.appendChild(weightEl);
      }
      content.appendChild(titleEl);

      var chipsRow = document.createElement("div");
      chipsRow.className = "navi-questionnaire-chips";
      if (category.tag) {
        var tagChip = document.createElement("span");
        tagChip.className = "navi-questionnaire-tag-chip";
        tagChip.textContent = category.tag;
        chipsRow.appendChild(tagChip);
      }
      if (category.ai) {
        var aiChip = document.createElement("span");
        aiChip.className = "navi-questionnaire-ai-chip";
        var aiIcon = document.createElement("img");
        aiIcon.src = "assets/navi/navi-questionnaire-ai-icon.svg";
        aiIcon.alt = "";
        aiChip.appendChild(aiIcon);
        chipsRow.appendChild(aiChip);
      }
      content.appendChild(chipsRow);
      header.appendChild(content);

      var actions = document.createElement("span");
      actions.className = "navi-questionnaire-actions";

      var addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "navi-questionnaire-add-btn";
      addBtn.setAttribute("aria-label", (isAdded ? "Remove " : "Add ") + category.title);
      var addIcon = document.createElement("img");
      addIcon.src = isAdded
        ? "assets/navi/navi-questionnaire-remove-icon.svg"
        : "assets/navi/navi-questionnaire-add-icon.svg";
      addIcon.alt = "";
      addBtn.appendChild(addIcon);
      addBtn.appendChild(document.createTextNode(isAdded ? "Remove" : "Add"));
      addBtn.addEventListener("click", function (event) {
        event.stopPropagation();
        isAdded = !isAdded;
        render();
      });
      actions.appendChild(addBtn);

      var chevronBtn = document.createElement("button");
      chevronBtn.type = "button";
      chevronBtn.className = "navi-questionnaire-chevron-btn";
      chevronBtn.setAttribute("aria-label", (isOpen ? "Collapse " : "Expand ") + category.title);
      var chevronIcon = document.createElement("img");
      chevronIcon.src = isOpen
        ? "assets/navi/navi-questionnaire-chevron-up-icon.svg"
        : "assets/navi/navi-questionnaire-chevron-down-icon.svg";
      chevronIcon.alt = "";
      chevronBtn.appendChild(chevronIcon);
      chevronBtn.addEventListener("click", function (event) {
        event.stopPropagation();
        isOpen = !isOpen;
        render();
      });
      actions.appendChild(chevronBtn);

      header.appendChild(actions);
      wrap.appendChild(header);

      if (isOpen) {
        var panel = document.createElement("div");
        panel.className = "navi-questionnaire-panel";
        var list = document.createElement("ul");
        list.className = "navi-questionnaire-question-list";
        (category.questions || []).forEach(function (question) {
          var li = document.createElement("li");
          var text = document.createElement("span");
          text.className = "navi-questionnaire-question-text";
          text.textContent = question.text;
          li.appendChild(text);
          if (question.hint) {
            var hint = document.createElement("span");
            hint.className = "navi-questionnaire-question-hint";
            hint.textContent = question.hint;
            li.appendChild(hint);
          }
          list.appendChild(li);
        });
        panel.appendChild(list);
        wrap.appendChild(panel);
      }
    }

    render();
    return wrap;
  }

  function appendQuestionnaire(questionnaire, speaker) {
    var el = document.createElement("div");
    el.className = "navi-questionnaire";

    (questionnaire.categories || []).forEach(function (category) {
      el.appendChild(buildQuestionnaireCategory(category));
    });

    transcript.appendChild(el);
    if (speaker === "navi") {
      appendFeedback(transcript);
    }
    scrollToBottom();
  }

  // ---------- Event status card (type: eventStatus) ----------
  // extracted: MaXc9HUQGFiYdkYLzBN1fx node 573:70677 (draft) + 519:112102
  // (published) — same card, only the status chip's color/label differs.
  // The chevron is decorative (see schema.md) — a flow adds a `next` to the
  // node's own `chips` if it needs to branch after showing this card.

  function appendEventStatus(eventStatus, speaker) {
    var isPublished = eventStatus.status === "published";

    var el = document.createElement("div");
    el.className = "navi-card navi-event-card";

    var header = document.createElement("div");
    header.className = "navi-event-card-header";

    var chip = document.createElement("span");
    chip.className = "navi-event-status-chip " + (isPublished ? "navi-event-status-chip--published" : "navi-event-status-chip--draft");
    chip.textContent = isPublished ? "Published" : "Draft";
    header.appendChild(chip);

    var title = document.createElement("p");
    title.className = "navi-event-title";
    title.textContent = eventStatus.title;
    header.appendChild(title);
    el.appendChild(header);

    var content = document.createElement("div");
    content.className = "navi-event-card-content";

    var icon = document.createElement("img");
    icon.className = "navi-event-card-icon";
    icon.src = "assets/navi/navi-file-icon.svg";
    icon.alt = "";
    content.appendChild(icon);

    var info = document.createElement("div");
    info.className = "navi-event-card-info";
    var idEl = document.createElement("p");
    idEl.className = "navi-event-card-id";
    idEl.textContent = "Event ID #" + eventStatus.eventId;
    info.appendChild(idEl);
    var createdEl = document.createElement("p");
    createdEl.className = "navi-event-card-created";
    createdEl.textContent = "Created: " + eventStatus.created;
    info.appendChild(createdEl);
    content.appendChild(info);

    var chevronBtn = document.createElement("button");
    chevronBtn.type = "button";
    chevronBtn.className = "navi-event-card-chevron";
    chevronBtn.setAttribute("aria-label", "Open " + eventStatus.title);
    var chevronIcon = document.createElement("img");
    chevronIcon.src = "assets/navi/navi-chevron-right-icon.svg";
    chevronIcon.alt = "";
    chevronBtn.appendChild(chevronIcon);
    content.appendChild(chevronBtn);
    el.appendChild(content);

    transcript.appendChild(el);
    if (speaker === "navi") {
      appendFeedback(transcript);
    }
    scrollToBottom();
  }

  function appendPromptLibrary(library) {
    var el = document.createElement("div");
    el.className = "navi-card";

    var title = document.createElement("div");
    title.className = "navi-library-title";
    title.textContent = library.title || "Prompt Library";
    el.appendChild(title);

    var tabs = document.createElement("div");
    tabs.className = "navi-library-tabs";
    var cardsWrap = document.createElement("div");
    cardsWrap.className = "navi-library-cards";

    function renderTab(category) {
      cardsWrap.innerHTML = "";
      if (!category.prompts || !category.prompts.length) {
        var empty = document.createElement("div");
        empty.className = "navi-library-empty";
        empty.textContent = "No " + category.name + " prompts yet.";
        cardsWrap.appendChild(empty);
        return;
      }
      category.prompts.forEach(function (prompt) {
        var card = document.createElement("button");
        card.className = "navi-library-card";
        var cardTitle = document.createElement("div");
        cardTitle.className = "navi-library-card-title";
        cardTitle.textContent = prompt.label;
        card.appendChild(cardTitle);
        card.addEventListener("click", function () {
          appendMessage("user", prompt.label);
          setPanelState("active");
          renderNode(prompt.next);
        });
        cardsWrap.appendChild(card);
      });
    }

    (library.categories || []).forEach(function (category, i) {
      var tabBtn = document.createElement("button");
      tabBtn.className = "navi-library-tab" + (i === 0 ? " is-active" : "");
      tabBtn.textContent = category.name;
      tabBtn.addEventListener("click", function () {
        tabs.querySelectorAll(".navi-library-tab").forEach(function (t) {
          t.classList.remove("is-active");
        });
        tabBtn.classList.add("is-active");
        renderTab(category);
      });
      tabs.appendChild(tabBtn);
      if (i === 0) {
        renderTab(category);
      }
    });

    el.appendChild(tabs);
    el.appendChild(cardsWrap);
    transcript.appendChild(el);
    appendFeedback(transcript);
    scrollToBottom();
  }

  // ---------- Page banner (host-page chrome, not panel chrome) ----------

  function renderPageBanner(banner) {
    var el = document.createElement("div");
    el.className = "navi-page-banner" + (banner.variant === "filled" ? " navi-page-banner--filled" : "");

    var icon = document.createElement("img");
    icon.className = "navi-page-banner-icon";
    icon.src = "assets/navi/navi-welcome-icon.svg";
    icon.alt = "";
    el.appendChild(icon);

    var body = document.createElement("div");
    body.className = "navi-page-banner-body";
    var title = document.createElement("div");
    title.className = "navi-page-banner-title";
    title.textContent = banner.title;
    body.appendChild(title);
    if (banner.text) {
      var text = document.createElement("div");
      text.className = "navi-page-banner-text";
      text.textContent = banner.text;
      body.appendChild(text);
    }
    el.appendChild(body);

    if (banner.cta_label) {
      var cta = document.createElement("button");
      cta.className = "navi-page-banner-cta";
      cta.textContent = banner.cta_label;
      cta.addEventListener("click", openPanel);
      el.appendChild(cta);
    }

    if (banner.dismissible !== false) {
      var close = document.createElement("button");
      close.className = "navi-page-banner-close";
      close.setAttribute("aria-label", "Dismiss");
      var closeIcon = document.createElement("img");
      closeIcon.src = "assets/navi/navi-close-icon.svg";
      closeIcon.alt = "";
      close.appendChild(closeIcon);
      close.addEventListener("click", function () {
        el.remove();
      });
      el.appendChild(close);
    }

    document.body.insertBefore(el, document.body.firstChild);
  }

  // ---------- Node graph ----------

  function renderNode(nodeId) {
    var node = script.nodes[nodeId];
    if (!node) {
      appendMessage("navi", "⚠ Script error: no node named \"" + nodeId + "\".");
      renderChips([]);
      return;
    }

    var speaker = node.speaker || "navi";
    var feedbackOptions = { feedback: speaker === "navi", feedbackCfg: node.feedback, markdown: !!node.markdown };

    if (node.type === "card") {
      appendCard(node.card, speaker);
    } else if (node.type === "attachment") {
      appendAttachment(node.attachment, speaker);
    } else if (node.type === "artifact") {
      appendArtifact(node.artifact);
    } else if (node.type === "form") {
      appendForm(node);
    } else if (node.type === "promptLibrary") {
      appendPromptLibrary(node.library);
    } else if (node.type === "supplier") {
      appendSupplierCard(node, speaker);
    } else if (node.type === "timeline") {
      appendTimeline(node.timeline, speaker);
    } else if (node.type === "questionnaire") {
      appendQuestionnaire(node.questionnaire, speaker);
    } else if (node.type === "eventStatus") {
      appendEventStatus(node.eventStatus, speaker);
    } else {
      // "message" and "error" both render as a plain bubble.
      appendMessage(speaker, node.text || "", feedbackOptions);
    }

    if (node.feedback_form) {
      appendFeedbackForm(node.feedback_form);
    }

    // `auto_next` chains straight into another node with no chip/click in
    // between — e.g. a "✅ created" message flowing directly into the
    // artifact it just created. This node's own `chips` are never shown in
    // that case; the chain's final node supplies the chips the user sees.
    if (node.auto_next) {
      renderNode(node.auto_next);
      return;
    }

    renderChips(node.chips || []);
  }

  // ---------- Chips (always chip-driven: entry chips and follow-ups) ----------

  // The "Attach" chip is always-on — appended to every chip list regardless
  // of which node rendered it, same as the real "File Upload" page's chip
  // (node I3188:91173;23:148228;5:330742 — see navi-styles.css). It opens
  // the native file picker instead of advancing to a `next` node.
  var ATTACH_CHIP = { id: "attach", label: "Attach", icon: "attach", action: "attach" };

  function renderChips(chips) {
    chipsContainer.innerHTML = "";

    var list = chips.length ? chips.slice() : [{ id: "restart", label: "Start over", next: "__restart__" }];
    list.push(ATTACH_CHIP);

    var chipIcons = { library: "assets/navi/navi-library-icon.svg", attach: "assets/navi/navi-attach-icon.svg" };

    list.forEach(function (chip) {
      var iconKey = chip.icon;
      var btn = document.createElement("button");
      btn.className = "navi-chip"
        + (iconKey ? " navi-chip--icon" : "")
        + (chip.variant === "filled" ? " navi-chip--filled" : "");

      if (iconKey && chipIcons[iconKey]) {
        var iconWrap = document.createElement("span");
        iconWrap.className = "navi-chip-icon";
        var icon = document.createElement("img");
        icon.src = chipIcons[iconKey];
        icon.width = 16;
        icon.height = 16;
        icon.alt = "";
        iconWrap.appendChild(icon);
        btn.appendChild(iconWrap);
      }
      btn.appendChild(document.createTextNode(chip.label));

      btn.addEventListener("click", function () {
        if (chip.action === "attach") {
          fileInput.click();
          return;
        }
        if (chip.next === "__restart__") {
          transcript.innerHTML = "";
          naviArtifacts.length = 0;
          closeArtifactViewer();
          setPanelState("welcome");
          renderChips(script.entry_chips || []);
          return;
        }
        appendMessage("user", chip.label);
        setPanelState("active");
        renderNode(chip.next);
      });
      chipsContainer.appendChild(btn);
    });

    // Chips render after their node's own content (and that content's own
    // scrollToBottom() call already fired), so re-scroll now that the chip
    // row itself may have added height below the fold.
    scrollToBottom();
  }

  // ---------- Free-text intent matching ----------
  // Scores a typed prompt against each intent's sample `patterns` so a
  // paraphrase or a typo still resolves — word-level fuzzy containment, not
  // real NLU. See schema.md's `intents` section for the YAML shape.

  var INTENT_STOPWORDS = {
    the: 1, a: 1, an: 1, to: 1, and: 1, or: 1, for: 1, of: 1, in: 1, on: 1,
    i: 1, we: 1, our: 1, us: 1, please: 1, can: 1, you: 1, me: 1, my: 1,
    is: 1, are: 1, be: 1, this: 1, that: 1, with: 1, at: 1, by: 1, from: 1,
    into: 1, it: 1, its: 1, as: 1, if: 1, so: 1, do: 1, does: 1, did: 1,
    have: 1, has: 1, had: 1, will: 1, would: 1, should: 1, could: 1,
    set: 1, up: 1, see: 1, show: 1, create: 1, make: 1, sure: 1, like: 1,
    want: 1, would: 1, look: 1, also: 1, just: 1, some: 1, what: 1
  };

  function intentNormalize(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/-/g, "") // fuse hyphenated compounds ("as-is" -> "asis") so the
                          // hyphen doesn't fall out as two separate stopwords
      .replace(/[^a-z0-9%/\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function intentTokenize(s) {
    return intentNormalize(s).split(" ").filter(Boolean);
  }

  function intentMeaningfulTokens(tokens) {
    return tokens.filter(function (t) {
      return t.length > 2 && !INTENT_STOPWORDS[t];
    });
  }

  function levenshteinDistance(a, b) {
    if (a === b) return 0;
    var al = a.length,
      bl = b.length;
    if (al === 0) return bl;
    if (bl === 0) return al;
    var prev = [];
    for (var j = 0; j <= bl; j++) prev[j] = j;
    for (var i = 1; i <= al; i++) {
      var cur = [i];
      for (var k = 1; k <= bl; k++) {
        var cost = a[i - 1] === b[k - 1] ? 0 : 1;
        cur[k] = Math.min(prev[k] + 1, cur[k - 1] + 1, prev[k - 1] + cost);
      }
      prev = cur;
    }
    return prev[bl];
  }

  function wordsFuzzyMatch(w1, w2) {
    if (w1 === w2) return true;
    if (w1.length < 4 || w2.length < 4) return false;
    var tolerance = Math.max(1, Math.floor(Math.max(w1.length, w2.length) * 0.3));
    return levenshteinDistance(w1, w2) <= tolerance;
  }

  // Words like "scenario" or "suppliers" show up in nearly every intent's
  // sample patterns, so an exact hit on them alone is close to meaningless;
  // a word that appears in only one intent (e.g. "asis", "dualsource",
  // "esg") is a much stronger signal. This builds a per-token weight —
  // 1 / (number of distinct intents whose patterns contain that token) —
  // so generic shared vocabulary can't out-vote a rare, distinguishing word.
  function buildIntentTokenWeights(intents) {
    var intentCountByToken = {};
    intents.forEach(function (intent) {
      var seenInThisIntent = {};
      (intent.patterns || []).forEach(function (phrase) {
        intentMeaningfulTokens(intentTokenize(phrase)).forEach(function (t) {
          seenInThisIntent[t] = true;
        });
      });
      Object.keys(seenInThisIntent).forEach(function (t) {
        intentCountByToken[t] = (intentCountByToken[t] || 0) + 1;
      });
    });
    var weights = {};
    Object.keys(intentCountByToken).forEach(function (t) {
      weights[t] = 1 / intentCountByToken[t];
    });
    return weights;
  }

  // How much of a sample phrase's vocabulary shows up (exactly or via a
  // typo-tolerant fuzzy match) in the user's typed prompt, weighted so rare/
  // distinguishing words count far more than words shared across intents.
  function intentPhraseScore(inputTokens, phrase, tokenWeights) {
    var phraseTokens = intentMeaningfulTokens(intentTokenize(phrase));
    if (!phraseTokens.length) return { ratio: 0, matchedWeight: 0 };
    var totalWeight = 0;
    var matchedWeight = 0;
    phraseTokens.forEach(function (pt) {
      var w = tokenWeights[pt] || 1;
      totalWeight += w;
      if (
        inputTokens.some(function (it) {
          return wordsFuzzyMatch(it, pt);
        })
      ) {
        matchedWeight += w;
      }
    });
    return { ratio: totalWeight ? matchedWeight / totalWeight : 0, matchedWeight: matchedWeight };
  }

  function matchIntent(input, intents) {
    if (!intents || !intents.length) return null;
    var normalizedInput = intentNormalize(input);
    var inputTokens = intentMeaningfulTokens(intentTokenize(input));
    if (!inputTokens.length) return null;

    var tokenWeights = buildIntentTokenWeights(intents);
    var best = null;
    var bestScore = 0;

    intents.forEach(function (intent) {
      (intent.patterns || []).forEach(function (phrase) {
        var normalizedPhrase = intentNormalize(phrase);
        var score = intentPhraseScore(inputTokens, phrase, tokenWeights);

        // An exact substring hit (the typed prompt contains the sample
        // phrase near-verbatim) is the strongest possible signal — trust it
        // outright. Otherwise require both a decent overlap ratio AND that
        // the matched tokens carry real distinguishing weight (>= 0.5 — one
        // intent-unique word, or several moderately-shared ones) — a phrase
        // that only matched on words shared across many intents (low
        // individual weight) can't clear this even at ratio 1.0.
        var qualifies =
          (normalizedPhrase && normalizedInput.indexOf(normalizedPhrase) !== -1) ||
          (score.ratio >= 0.55 && score.matchedWeight >= 0.5);

        if (qualifies && score.ratio > bestScore) {
          bestScore = score.ratio;
          best = intent;
        }
      });
    });

    return best;
  }

  // Matches an attached filename against the script's `document_types` (see
  // schema.md) — a plain case-insensitive substring check against each
  // entry's `match` keywords, first entry to match wins. This never reads
  // real file content, only the filename the browser reports.
  function matchDocumentType(filename, documentTypes) {
    if (!documentTypes || !documentTypes.length) return null;
    var normalized = String(filename || "").toLowerCase();

    for (var i = 0; i < documentTypes.length; i++) {
      var docType = documentTypes[i];
      var matched = (docType.match || []).some(function (keyword) {
        return normalized.indexOf(String(keyword).toLowerCase()) !== -1;
      });
      if (matched) return docType;
    }
    return null;
  }

  // ---------- Composer: free text + real file attachment ----------

  // Matches the dropzone's own "Maximum file size is 25MB" copy — platform
  // enforcement, not something a script configures (see schema.md).
  var MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

  function formatFileSize(bytes) {
    var mb = bytes / (1024 * 1024);
    return mb.toFixed(mb >= 10 ? 0 : 1) + "MB";
  }

  function rejectOversizedFile(file) {
    setPanelState("active");
    appendMessage(
      "navi",
      "⚠ " + file.name + " is " + formatFileSize(file.size) + " — that's over the 25MB limit per file. Try compressing it or attaching a smaller file instead."
    );
    renderChips([]);
  }

  // Attaching a file (picker or drop) sends it immediately — no separate
  // "pending, waiting for Send" staging step. It shows as an uploading
  // attachment bubble right in the transcript, flips to "Uploaded just
  // now" a moment later, and then immediately resolves `document_types`
  // for contextual follow-up chips (or the generic fallback) — the same
  // routing `submitPrompt` does for typed text, just triggered by the
  // attach itself instead of a Send click.
  function handleAttachedFile(file) {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      rejectOversizedFile(file);
      return;
    }

    setPanelState("active");
    var el = appendAttachment({ filename: file.name, meta: ["Uploading..."] }, "user");
    var statusLine = el.querySelector(".navi-attachment-info-line--primary");

    window.setTimeout(function () {
      if (statusLine) {
        statusLine.textContent = "Uploaded just now";
      }

      var matchedDocType = matchDocumentType(file.name, script.document_types);
      if (matchedDocType) {
        renderNode(matchedDocType.next);
        return;
      }

      appendMessage(
        "navi",
        "Thanks — let me look into that. (This prototype only recognizes a specific set of scripted prompts/chips, not open-ended free text or real file content.)"
      );
      renderChips([]);
    }, 600);
  }

  fileInput.addEventListener("change", function () {
    Array.prototype.forEach.call(fileInput.files || [], handleAttachedFile);
    fileInput.value = "";
  });

  // ---------- Drag-and-drop (dropping a file anywhere on the panel) ----------
  // Same destination as the file picker — both just call handleAttachedFile()
  // per file, so a dropped file behaves identically to one picked via "Attach".
  // dragDepth counts nested dragenter/dragleave pairs (every descendant the
  // pointer crosses fires its own pair) so the drag-over overlay doesn't
  // flicker off when the pointer passes over a child element mid-drag.

  var dragDepth = 0;

  function isFileDrag(event) {
    var types = (event.dataTransfer && event.dataTransfer.types) || [];
    return Array.prototype.indexOf.call(types, "Files") !== -1;
  }

  panel.addEventListener("dragenter", function (event) {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    dragDepth++;
    panel.classList.add("navi-panel--drag-over");
  });

  panel.addEventListener("dragover", function (event) {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  });

  panel.addEventListener("dragleave", function (event) {
    if (!isFileDrag(event)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) {
      panel.classList.remove("navi-panel--drag-over");
    }
  });

  panel.addEventListener("drop", function (event) {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    dragDepth = 0;
    panel.classList.remove("navi-panel--drag-over");
    Array.prototype.forEach.call((event.dataTransfer && event.dataTransfer.files) || [], handleAttachedFile);
  });

  function submitPrompt() {
    var value = inputField.value.trim();
    if (!value) {
      return;
    }

    inputField.value = "";
    setPanelState("active");
    appendMessage("user", value);

    var matchedIntent = matchIntent(value, script.intents);
    if (matchedIntent) {
      renderNode(matchedIntent.next);
      return;
    }

    appendMessage(
      "navi",
      "Thanks — let me look into that. (This prototype only recognizes a specific set of scripted prompts/chips, not open-ended free text or real file content.)"
    );
    renderChips([]);
  }

  launcher.addEventListener("click", function () {
    if (panel.classList.contains("navi-panel--open")) {
      closePanel();
    } else {
      openPanel();
    }
  });
  closeBtn.addEventListener("click", closePanel);
  minimizeBtn.addEventListener("click", closePanel);
  inputSendBtn.addEventListener("click", submitPrompt);
  inputField.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      submitPrompt();
    }
  });

  if (script.page_banner) {
    renderPageBanner(script.page_banner);
  }

  syncHeaderOffset();
  window.addEventListener("resize", syncHeaderOffset);
})();
