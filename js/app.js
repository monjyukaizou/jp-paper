(function () {
  "use strict";

  // ---- Dial geometry (270° arc, gap at bottom, 0° = top, clockwise) ----
  const CX = 120, CY = 120, R = 100;
  const START_ANGLE = -135;
  const END_ANGLE = 135;

  let MIN_THICK = 40;
  let MAX_THICK = 300;

  const state = {
    papers: [],
    dialValue: null,       // current thickness_um target, null = no filter
    tolerance: 15,
    categories: new Set(), // active category filters
    makers: new Set(),     // active maker filters
    sort: "usage",         // "usage" | "thickness"
    search: "",
    expanded: new Set(),   // expanded paper ids
    popularIds: new Set(),
  };

  function polarToCartesian(cx, cy, r, angleDeg) {
    const rad = (angleDeg - 90) * Math.PI / 180; // shift so 0deg = top
    // custom convention: angle measured clockwise from top
    const trueRad = (angleDeg) * Math.PI / 180;
    return {
      x: cx + r * Math.sin(trueRad),
      y: cy - r * Math.cos(trueRad),
    };
  }

  function describeArc(cx, cy, r, startAngle, endAngle) {
    const start = polarToCartesian(cx, cy, r, endAngle);
    const end = polarToCartesian(cx, cy, r, startAngle);
    const largeArcFlag = (endAngle - startAngle) <= 180 ? "0" : "1";
    return [
      "M", start.x, start.y,
      "A", r, r, 0, largeArcFlag, 0, end.x, end.y
    ].join(" ");
  }

  function valueToAngle(v) {
    const clamped = Math.max(MIN_THICK, Math.min(MAX_THICK, v));
    return START_ANGLE + (clamped - MIN_THICK) / (MAX_THICK - MIN_THICK) * (END_ANGLE - START_ANGLE);
  }

  function angleToValue(angle) {
    const clamped = Math.max(START_ANGLE, Math.min(END_ANGLE, angle));
    return MIN_THICK + (clamped - START_ANGLE) / (END_ANGLE - START_ANGLE) * (MAX_THICK - MIN_THICK);
  }

  // ---- DOM refs ----
  const dialTrack = document.getElementById("dialTrack");
  const dialFill = document.getElementById("dialFill");
  const dialHandle = document.getElementById("dialHandle");
  const dialSvg = document.getElementById("dialSvg");
  const dialValueEl = document.getElementById("dialValue");
  const dialSubEl = document.getElementById("dialSub");
  const dialReset = document.getElementById("dialReset");
  const toleranceSeg = document.getElementById("toleranceSeg");
  const sortSeg = document.getElementById("sortSeg");
  const categoryChipsEl = document.getElementById("categoryChips");
  const makerChipsEl = document.getElementById("makerChips");
  const resultListEl = document.getElementById("resultList");
  const resultCountEl = document.getElementById("resultCount");
  const searchToggle = document.getElementById("searchToggle");
  const searchBar = document.getElementById("searchBar");
  const searchInput = document.getElementById("searchInput");
  const filterToggle = document.getElementById("filterToggle");
  const filterBody = document.getElementById("filterBody");
  const filterChevron = document.getElementById("filterChevron");
  const filterSummary = document.getElementById("filterSummary");

  function renderDialTrack() {
    dialTrack.setAttribute("d", describeArc(CX, CY, R, START_ANGLE, END_ANGLE));
  }

  function updateDialVisual() {
    if (state.dialValue === null) {
      dialFill.setAttribute("d", "");
      const p = polarToCartesian(CX, CY, R, START_ANGLE);
      dialHandle.setAttribute("cx", p.x);
      dialHandle.setAttribute("cy", p.y);
      dialHandle.style.opacity = "0.35";
      dialValueEl.textContent = "--";
      dialSubEl.textContent = "紙厚をダイヤルで選択";
      return;
    }
    dialHandle.style.opacity = "1";
    const angle = valueToAngle(state.dialValue);
    dialFill.setAttribute("d", describeArc(CX, CY, R, START_ANGLE, angle));
    const p = polarToCartesian(CX, CY, R, angle);
    dialHandle.setAttribute("cx", p.x);
    dialHandle.setAttribute("cy", p.y);
    dialValueEl.textContent = Math.round(state.dialValue);
    dialSubEl.textContent = (state.dialValue / 1000).toFixed(3) + " mm 相当";
  }

  function angleFromPointerEvent(evt) {
    const rect = dialSvg.getBoundingClientRect();
    const scale = 240 / rect.width; // svg viewBox is 240x240
    const px = (evt.clientX - rect.left) * scale;
    const py = (evt.clientY - rect.top) * scale;
    const dx = px - CX;
    const dy = py - CY;
    let angle = Math.atan2(dx, -dy) * 180 / Math.PI; // 0 = top, clockwise positive
    return angle;
  }

  let dragging = false;

  function setValueFromEvent(evt) {
    const angle = angleFromPointerEvent(evt);
    const clamped = Math.max(START_ANGLE, Math.min(END_ANGLE, angle));
    state.dialValue = Math.round(angleToValue(clamped));
    updateDialVisual();
    renderResults();
  }

  function onPointerDown(evt) {
    dragging = true;
    dialSvg.setPointerCapture && evt.pointerId != null && dialSvg.setPointerCapture(evt.pointerId);
    setValueFromEvent(evt);
    evt.preventDefault();
  }
  function onPointerMove(evt) {
    if (!dragging) return;
    setValueFromEvent(evt);
    evt.preventDefault();
  }
  function onPointerUp() {
    dragging = false;
  }

  dialSvg.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);

  dialReset.addEventListener("click", () => {
    state.dialValue = null;
    updateDialVisual();
    renderResults();
  });

  toleranceSeg.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-tol]");
    if (!btn) return;
    [...toleranceSeg.children].forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    state.tolerance = Number(btn.dataset.tol);
    renderResults();
  });

  sortSeg.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-sort]");
    if (!btn) return;
    [...sortSeg.children].forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    state.sort = btn.dataset.sort;
    renderResults();
  });

  searchToggle.addEventListener("click", () => {
    searchBar.classList.toggle("hidden");
    if (!searchBar.classList.contains("hidden")) searchInput.focus();
  });
  searchInput.addEventListener("input", () => {
    state.search = searchInput.value.trim();
    renderResults();
  });

  filterToggle.addEventListener("click", () => {
    filterBody.classList.toggle("hidden");
    filterChevron.classList.toggle("open");
  });

  function buildChipRow(container, values, activeSet) {
    container.innerHTML = "";
    values.forEach(v => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.textContent = v;
      if (activeSet.has(v)) chip.classList.add("active");
      chip.addEventListener("click", () => {
        if (activeSet.has(v)) activeSet.delete(v);
        else activeSet.add(v);
        chip.classList.toggle("active");
        updateFilterSummary();
        renderResults();
      });
      container.appendChild(chip);
    });
  }

  function updateFilterSummary() {
    const parts = [];
    if (state.categories.size) parts.push([...state.categories].join("・"));
    if (state.makers.size) parts.push([...state.makers].join("・"));
    filterSummary.textContent = parts.join(" / ");
  }

  function closestSpec(paper, target) {
    let best = null, bestDiff = Infinity;
    for (const spec of paper.specs || []) {
      const diff = Math.abs(spec.thickness_um - target);
      if (diff < bestDiff) { bestDiff = diff; best = spec; }
    }
    return { spec: best, diff: bestDiff };
  }

  function formatSizesInline(sizes) {
    const entries = Object.entries(sizes || {});
    return entries.slice(0, 3).map(([name, info]) =>
      `${name} ${info.renryo_kg}kg`
    ).join(" / ") + (entries.length > 3 ? " ほか" : "");
  }

  function matchesFilters(paper) {
    if (state.categories.size && !state.categories.has(paper.category)) return false;
    if (state.makers.size && !state.makers.has(paper.maker)) return false;
    if (state.search) {
      const q = state.search.toLowerCase();
      const hay = (paper.name + " " + paper.maker + " " + paper.category).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }

  function renderResults() {
    let list = state.papers.filter(matchesFilters);

    let withMatch = list.map(p => {
      if (state.dialValue !== null) {
        const { spec, diff } = closestSpec(p, state.dialValue);
        return { paper: p, spec, diff };
      }
      return { paper: p, spec: (p.specs && p.specs[0]) || null, diff: null };
    });

    if (state.dialValue !== null) {
      withMatch = withMatch.filter(item => item.diff <= state.tolerance);
    }

    const sortMode = state.dialValue !== null ? state.sort : "usage";
    if (sortMode === "thickness" && state.dialValue !== null) {
      withMatch.sort((a, b) => a.diff - b.diff);
    } else {
      withMatch.sort((a, b) => (b.paper.usageCount || 0) - (a.paper.usageCount || 0));
    }

    resultCountEl.textContent = withMatch.length + "件";

    resultListEl.innerHTML = "";

    if (withMatch.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "条件に合う用紙がありません。許容幅を広げるか、絞り込みを解除してください。";
      resultListEl.appendChild(empty);
      return;
    }

    withMatch.forEach(item => resultListEl.appendChild(renderCard(item)));
  }

  function renderCard(item) {
    const { paper, spec, diff } = item;
    const card = document.createElement("div");
    card.className = "paper-card";

    const isPopular = state.popularIds.has(paper.id);
    const isExpanded = state.expanded.has(paper.id);

    const head = document.createElement("div");
    head.className = "paper-card-head";

    const left = document.createElement("div");
    left.innerHTML = `
      <div class="paper-name">${escapeHtml(paper.name)}</div>
      <div class="paper-maker">${escapeHtml(paper.maker)}</div>
    `;

    const badges = document.createElement("div");
    badges.className = "paper-badges";
    badges.innerHTML = `
      <span class="badge category">${escapeHtml(paper.category)}</span>
      ${isPopular ? '<span class="badge popular">よく使われる</span>' : ""}
    `;

    head.appendChild(left);
    head.appendChild(badges);
    card.appendChild(head);

    if (spec) {
      const match = document.createElement("div");
      match.className = "paper-match";
      const diffLabel = (diff !== null) ? `<span>(目標との差 ${Math.round(diff)}μm)</span>` : "";
      match.innerHTML = `
        <span class="num">${spec.thickness_um}μm</span>
        <span>/ 坪量 <span class="num">${spec.basisWeight_g_m2}g/㎡</span></span>
        ${diffLabel}
      `;
      card.appendChild(match);

      const sizeLine = document.createElement("div");
      sizeLine.className = "paper-match";
      sizeLine.textContent = formatSizesInline(spec.sizes);
      card.appendChild(sizeLine);
    }

    if (paper.specialNote) {
      const warn = document.createElement("div");
      warn.className = "special-note";
      warn.textContent = "⚠ " + paper.specialNote;
      card.appendChild(warn);
    }

    const hint = document.createElement("div");
    hint.className = "expand-hint";
    hint.textContent = isExpanded ? "タップして閉じる ▲" : "タップして全仕様を見る ▼";
    card.appendChild(hint);

    const detail = document.createElement("div");
    detail.className = "paper-detail" + (isExpanded ? "" : " hidden");
    detail.appendChild(buildDetailTable(paper, spec));

    if (paper.note) {
      const note = document.createElement("div");
      note.className = "paper-note";
      note.textContent = paper.note;
      detail.appendChild(note);
    }

    card.appendChild(detail);

    card.addEventListener("click", () => {
      if (state.expanded.has(paper.id)) state.expanded.delete(paper.id);
      else state.expanded.add(paper.id);
      renderResults();
    });

    return card;
  }

  function buildDetailTable(paper, highlightSpec) {
    const wrap = document.createElement("div");
    wrap.className = "spec-table-wrap";
    const table = document.createElement("table");
    table.className = "spec-table";
    table.innerHTML = `
      <thead>
        <tr><th>厚さ</th><th>坪量</th><th>サイズ / 連量 / 目</th></tr>
      </thead>
    `;
    const tbody = document.createElement("tbody");
    (paper.specs || []).forEach(spec => {
      const tr = document.createElement("tr");
      if (highlightSpec && spec === highlightSpec) tr.classList.add("highlight");
      const sizeText = Object.entries(spec.sizes || {}).map(([name, info]) =>
        `${name} ${info.renryo_kg}kg(${info.grain || "-"})`
      ).join(", ");
      tr.innerHTML = `
        <td>${spec.thickness_um}μm</td>
        <td>${spec.basisWeight_g_m2}g/㎡</td>
        <td>${escapeHtml(sizeText)}</td>
      `;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
  }

  function computePopular(papers) {
    const sorted = [...papers].sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
    sorted.slice(0, 5).forEach(p => state.popularIds.add(p.id));
  }

  function init(papers) {
    state.papers = papers;

    let min = Infinity, max = -Infinity;
    papers.forEach(p => (p.specs || []).forEach(s => {
      if (typeof s.thickness_um === "number") {
        min = Math.min(min, s.thickness_um);
        max = Math.max(max, s.thickness_um);
      }
    }));
    if (isFinite(min) && isFinite(max)) {
      MIN_THICK = Math.max(10, Math.floor(min / 10) * 10 - 10);
      MAX_THICK = Math.ceil(max / 10) * 10 + 10;
    }

    computePopular(papers);

    const categories = [...new Set(papers.map(p => p.category))].sort();
    const makers = [...new Set(papers.map(p => p.maker))].sort();
    buildChipRow(categoryChipsEl, categories, state.categories);
    buildChipRow(makerChipsEl, makers, state.makers);

    renderDialTrack();
    updateDialVisual();
    renderResults();
  }

  fetch("data/papers.json")
    .then(r => r.json())
    .then(init)
    .catch(err => {
      resultListEl.innerHTML = `<div class="empty-state">データの読み込みに失敗しました: ${escapeHtml(err.message)}</div>`;
    });
})();
