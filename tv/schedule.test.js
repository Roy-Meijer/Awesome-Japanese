import { test } from "node:test";
import assert from "node:assert";
import "./schedule.js"; // sets globalThis.ScheduleLib
const { currentProgram } = globalThis.ScheduleLib;

const sched = { total: 180, items: [
  { videoId: "v1", title: "One", duration: 60 },
  { videoId: "v2", title: "Two", duration: 120 },
] };
const EPOCH = 1000;

test("start of loop -> first item, offset 0", () => {
  assert.deepStrictEqual(currentProgram(sched, EPOCH, 1000), { videoId: "v1", title: "One", index: 0, offset: 0 });
});
test("inside first item", () => {
  assert.strictEqual(currentProgram(sched, EPOCH, 1030).offset, 30);
});
test("exact boundary -> next item offset 0", () => {
  assert.deepStrictEqual(currentProgram(sched, EPOCH, 1060), { videoId: "v2", title: "Two", index: 1, offset: 0 });
});
test("loop wrap", () => {
  const p = currentProgram(sched, EPOCH, 1000 + 180 + 5); // one full loop + 5s
  assert.deepStrictEqual(p, { videoId: "v1", title: "One", index: 0, offset: 5 });
});
test("now before epoch handled (no negative offset)", () => {
  const p = currentProgram(sched, EPOCH, 1000 - 10); // 10s before epoch -> 170 into loop
  assert.ok(p.offset >= 0 && p.videoId);
});
test("empty schedule -> null", () => {
  assert.strictEqual(currentProgram({ total: 0, items: [] }, EPOCH, 1234), null);
});

const { programsInWindow } = globalThis.ScheduleLib;

const sched3 = { total: 180, items: [
  { videoId: "v1", title: "One", duration: 60 },
  { videoId: "v2", title: "Two", duration: 120 },
] };

test("programsInWindow: first block is the live program, starts at now-offset", () => {
  const ps = programsInWindow(sched3, 1000, 1030, 300);
  assert.strictEqual(ps[0].videoId, "v1");
  assert.strictEqual(ps[0].start, 1000);
  assert.strictEqual(ps[0].end, 1060);
  assert.strictEqual(ps[0].live, true);
  assert.strictEqual(ps[0].index, 0);
});
test("programsInWindow: blocks are contiguous and cover the window", () => {
  const ps = programsInWindow(sched3, 1000, 1030, 300); // window ends 1330
  for (let i = 1; i < ps.length; i++) assert.strictEqual(ps[i].start, ps[i - 1].end);
  assert.ok(ps[ps.length - 1].end >= 1330);
  assert.ok(ps.slice(1).every((p) => p.live === false));
});
test("programsInWindow: loops a single-item schedule to fill the window", () => {
  const one = { total: 60, items: [{ videoId: "a", title: "A", duration: 60 }] };
  const ps = programsInWindow(one, 0, 0, 300);
  assert.ok(ps.length >= 5);
  assert.ok(ps.every((p) => p.videoId === "a"));
});
test("programsInWindow: empty schedule -> []", () => {
  assert.deepStrictEqual(programsInWindow({ total: 0, items: [] }, 0, 0, 300), []);
});
