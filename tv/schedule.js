// tv/schedule.js — pure simulated-live scheduling math.
(function () {
  "use strict";
  function currentProgram(sched, epoch, nowSeconds) {
    if (!sched || !sched.items || !sched.items.length || !sched.total) return null;
    const total = sched.total;
    let elapsed = ((nowSeconds - epoch) % total + total) % total; // always [0,total)
    let acc = 0;
    for (let i = 0; i < sched.items.length; i++) {
      const it = sched.items[i];
      if (elapsed < acc + it.duration) {
        return { videoId: it.videoId, title: it.title || "", index: i, offset: Math.floor(elapsed - acc) };
      }
      acc += it.duration;
    }
    const last = sched.items[sched.items.length - 1];
    return { videoId: last.videoId, title: last.title || "", index: sched.items.length - 1, offset: 0 };
  }
  // Project a channel's loop onto [now, now+window]: ordered program blocks
  // with absolute start/end times. The first block is the live one.
  function programsInWindow(sched, epoch, nowSeconds, windowSeconds) {
    if (!sched || !sched.items || !sched.items.length || !sched.total) return [];
    const items = sched.items, total = sched.total;
    const elapsed = ((nowSeconds - epoch) % total + total) % total;
    let acc = 0, idx = 0;
    for (let i = 0; i < items.length; i++) {
      if (elapsed < acc + items[i].duration) { idx = i; break; }
      acc += items[i].duration;
    }
    const offset = elapsed - acc;          // seconds into the current item
    let start = nowSeconds - offset;        // absolute start of the live program
    let i = idx;
    const limit = nowSeconds + windowSeconds;
    const out = [];
    while (start < limit && out.length < 1000) {
      const it = items[i];
      out.push({ videoId: it.videoId, title: it.title || "", index: i, start, end: start + it.duration, live: out.length === 0 });
      start += it.duration;
      i = (i + 1) % items.length;
    }
    return out;
  }

  const api = { currentProgram, programsInWindow };
  if (typeof globalThis !== "undefined") globalThis.ScheduleLib = api;
})();
