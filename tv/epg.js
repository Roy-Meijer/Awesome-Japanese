// tv/epg.js — EPG / 番組表: vertical time, channels as columns (region-grouped).
(function () {
  "use strict";
  const PPM = 10;                 // pixels per minute (vertical)
  const PXS = PPM / 60;           // pixels per second
  const WINDOW_SEC = 2 * 3600;    // 2-hour window (NOW at top)
  const COL_W = 150;              // channel column width
  const HEAD_H = 52;              // column header height
  const GUTTER_W = 48;            // time gutter width
  const MIN_BLOCK = 18;
  const BOARD = WINDOW_SEC * PXS;

  function el(cls) { const d = document.createElement("div"); d.className = cls; return d; }
  function hhmm(sec) { const d = new Date(sec * 1000); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }

  let lastContainer = null;

  // Channels grouped by region order, unknown -> "Other".
  function grouped(sched, order, ja) {
    const groups = {};
    for (const id of order) {
      const g = sched.channels[id].group;
      const key = (window.TVApp.GROUP_ORDER.includes(g)) ? g : "Other";
      (groups[key] ||= []).push(id);
    }
    const keys = [...window.TVApp.GROUP_ORDER.filter((g) => groups[g]), ...(groups["Other"] ? ["Other"] : [])];
    return keys.map((k) => [k + (ja[k] ? " " + ja[k] : ""), groups[k]]);
  }

  function colHead(id, ch, app) {
    const head = el("epg-colhead");
    const no = el("epg-chno"); no.textContent = app.chNo[id] || ""; head.appendChild(no);
    if (ch.icon) {
      const img = document.createElement("img"); img.className = "epg-chicon"; img.src = ch.icon; img.alt = ""; img.loading = "lazy";
      img.addEventListener("error", () => { const i = initialsIcon(ch.name); img.replaceWith(i); });
      head.appendChild(img);
    } else { head.appendChild(initialsIcon(ch.name)); }
    const nm = el("epg-colname"); nm.textContent = ch.name; head.appendChild(nm);
    const gn = el("epg-colgenre"); gn.textContent = ch.group || ""; head.appendChild(gn);
    // The whole channel header is a tune target (plays what's live now).
    head.setAttribute("role", "button"); head.tabIndex = 0; head.title = "Tune to " + ch.name;
    head.addEventListener("click", () => app.tune(id, true));
    head.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); app.tune(id, true); } });
    head.addEventListener("mouseenter", () => app.updateInfo(id));
    head.addEventListener("mouseleave", () => app.updateInfo(app.getActive()));
    return head;
  }
  function initialsIcon(name) {
    const d = el("epg-chicon initials");
    d.style.setProperty("--hue", globalThis.IconLib.hueFromString(name));
    d.textContent = globalThis.IconLib.initials(name);
    return d;
  }

  function render(container) {
    const app = window.TVApp;
    const sched = app && app.getSchedule();
    if (!sched || !sched.channels) return;
    lastContainer = container;
    const Sched = globalThis.ScheduleLib;
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now;               // NOW at the top
    const cc = app.getCountry();
    const hideRegion = window.Settings.store.read().hideRegion;

    container.replaceChildren();
    container.style.setProperty("--half", (30 * PPM) + "px"); // 30-min gridline
    const inner = el("epg-inner");

    // time gutter (sticky left): corner + vertical time labels
    const gutter = el("epg-gutter"); gutter.style.width = GUTTER_W + "px";
    const corner = el("epg-corner"); corner.style.height = HEAD_H + "px";
    const dot = document.createElement("div"); dot.textContent = "● NOW"; corner.appendChild(dot);
    const ct = document.createElement("div"); ct.textContent = hhmm(now); corner.appendChild(ct);
    const times = el("epg-times"); times.style.height = BOARD + "px";
    for (let t = Math.ceil(windowStart / 1800) * 1800; t < windowStart + WINDOW_SEC; t += 1800) {
      const lab = el("epg-time"); lab.style.top = ((t - windowStart) * PXS) + "px"; lab.textContent = hhmm(t);
      times.appendChild(lab);
    }
    gutter.append(corner, times); inner.appendChild(gutter);

    // region-grouped channel columns
    for (const [label, ids] of grouped(sched, app.order, app.GROUP_LABELS_JA)) {
      const sep = el("epg-region-sep"); const s = document.createElement("span"); s.textContent = label; sep.appendChild(s);
      inner.appendChild(sep);
      for (const id of ids) {
        const ch = sched.channels[id];
        const col = el("epg-col"); col.style.width = COL_W + "px"; col.dataset.id = id; col.dataset.name = (ch.name || "").toLowerCase();

        // region filter: hide column if current program not viewable
        if (hideRegion && cc) {
          const cur = Sched.currentProgram(ch, sched.epoch, now);
          const item = cur && ch.items[cur.index];
          if (item && !Sched.viewableInCountry(item, cc)) col.classList.add("region-off");
        }

        col.appendChild(colHead(id, ch, app));
        const track = el("epg-track"); track.style.height = BOARD + "px";
        const progs = Sched.programsInWindow(ch, sched.epoch, windowStart, WINDOW_SEC);
        for (const p of progs) {
          const b = document.createElement("button");
          b.className = "epg-prog" + (p.start <= now && now < p.end ? " live" : "");
          b.type = "button"; b.title = p.title; b.dataset.title = (p.title || "").toLowerCase();
          const top = Math.max(0, (p.start - windowStart) * PXS);
          const bottom = Math.min(BOARD, (p.end - windowStart) * PXS);
          b.style.top = top + "px"; b.style.height = Math.max(MIN_BLOCK, bottom - top) + "px";
          const tt = el("epg-progtitle"); tt.textContent = p.title; b.appendChild(tt);
          b.addEventListener("click", () => app.tune(id, true));
          b.addEventListener("mouseenter", () => app.updateInfo(id));
          b.addEventListener("mouseleave", () => app.updateInfo(app.getActive()));
          track.appendChild(b);
        }
        col.appendChild(track);
        inner.appendChild(col);
      }
    }

    // NOW line: horizontal, across the columns at the top of the tracks
    const nowLine = el("epg-now");
    nowLine.style.top = HEAD_H + "px"; nowLine.style.left = GUTTER_W + "px"; nowLine.style.right = "0";
    inner.appendChild(nowLine);

    container.appendChild(inner);
    applySearch(app.getQuery ? app.getQuery() : "");
    markActive(app.getActive ? app.getActive() : null);
  }

  function applySearch(query) {
    const lib = globalThis.IconLib;
    if (!lastContainer) return;
    lastContainer.querySelectorAll(".epg-col").forEach((col) => {
      let match = lib.matches(query, col.dataset.name);
      col.querySelectorAll(".epg-prog").forEach((b) => {
        const hit = !!query && lib.matches(query, b.dataset.title);
        b.classList.toggle("match", hit);
        if (hit) match = true;
      });
      col.classList.toggle("search-off", !!query && !match);
    });
  }

  function markActive(id) {
    if (!lastContainer) return;
    lastContainer.querySelectorAll(".epg-col.on").forEach((c) => c.classList.remove("on"));
    if (id) { const col = lastContainer.querySelector('.epg-col[data-id="' + id + '"]'); if (col) col.classList.add("on"); }
  }

  function refilter() { if (lastContainer) render(lastContainer); }

  if (typeof window !== "undefined") window.EPG = { render, filter: applySearch, refilter, markActive };
})();
