import assert from "node:assert/strict";
import test from "node:test";
import {
  calendarPostingDueDate,
  getPostingFrequency,
  packageMonthOfCycle,
  postingPeriodCount,
  totalPostingCopies,
} from "../lib/posting-cycle";
import { groupTasksByCycle } from "../lib/posting-task-cycles";
import type { Task } from "../components/task-distribution/distribution-types";

const day = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const anchor = new Date(2026, 10, 24);

test("missing overrides inherit defaults and explicit zero disables posting", () => {
  assert.equal(getPostingFrequency({ required: null, defaultFreq: 3 }), 3);
  assert.equal(getPostingFrequency({ defaultFreq: 3 }), 3);
  assert.equal(getPostingFrequency({ required: 0, defaultFreq: 3 }), 0);
  assert.equal(getPostingFrequency({ required: 2, defaultFreq: 3 }), 2);
  assert.equal(getPostingFrequency({}), 0);
});

test("package totals use active periods", () => {
  assert.equal(totalPostingCopies(3, 12), 36);
  assert.equal(totalPostingCopies(3, 12, { interval: 2, offset: 0 }), 18);
  assert.equal(totalPostingCopies(3, 12, { interval: 2, offset: 1 }), 18);
  assert.equal(totalPostingCopies(3, 12, { interval: 3, offset: 0 }), 12);
  assert.equal(totalPostingCopies(0, 12), 0);
  assert.equal(totalPostingCopies(3, 1, { interval: 2, offset: 1 }), 0);
});

test("Nov 24 example uses 30-day periods and moves Jan 23 to Monday", () => {
  assert.deepEqual(Array.from({ length: 7 }, (_, i) => day(calendarPostingDueDate(anchor, i + 1, 3))),
    ["2026-11-24", "2026-12-04", "2026-12-14", "2026-12-24", "2027-01-04", "2027-01-13", "2027-01-25"]);
  assert.equal(day(calendarPostingDueDate(anchor, 4, 3, { interval: 2, offset: 0 })), "2027-01-25");
  assert.equal(day(calendarPostingDueDate(anchor, 1, 3, { interval: 2, offset: 1 })), "2026-12-24");
});

test("weekends adjust even at the anchor and stay within their original period", () => {
  assert.equal(day(calendarPostingDueDate(new Date(2026, 10, 28), 1, 3)), "2026-11-30");
  assert.equal(day(calendarPostingDueDate(new Date(2026, 9, 30), 30, 30)), "2026-11-27");
  for (const freq of [1, 3, 4, 30, 60]) {
    for (const cycle of [{ interval: 1, offset: 0 }, { interval: 2, offset: 1 }, { interval: 3, offset: 0 }]) {
      const counts = new Map<number, number>();
      for (let n = 1; n <= totalPostingCopies(freq, 12, cycle); n++) {
        const date = calendarPostingDueDate(anchor, n, freq, cycle);
        const days = (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(2026, 10, 24)) / 86400000;
        const period = Math.floor(days / 30);
        assert.equal(period, packageMonthOfCycle(n, freq, cycle));
        assert.ok(date.getDay() !== 0 && date.getDay() !== 6);
        counts.set(period, (counts.get(period) ?? 0) + 1);
      }
      for (const count of counts.values()) assert.equal(count, freq);
    }
  }
});

test("legacy date ranges count 30-day periods instead of calendar month boundaries", () => {
  assert.equal(postingPeriodCount(new Date(2026, 10, 24), new Date(2026, 11, 24)), 1);
  assert.equal(postingPeriodCount(new Date(2026, 10, 24), new Date(2027, 0, 23)), 2);
});

test("distribution groups by date, even when a site's tasks share a due day", () => {
  const tasks = [
    { id: "1", name: "Medium Task -7", dueDate: "2027-01-25" },
    { id: "2", name: "Tumblr Task -4", dueDate: "2027-01-25" },
    { id: "3", name: "Medium Task -8", dueDate: "2027-01-25" },
    { id: "4", name: "Medium Task -1", dueDate: "2026-11-24" },
  ] as Task[];
  const groups = groupTasksByCycle(tasks);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map((g) => g.cycle), [1, 2]);
  assert.deepEqual(groups[1].tasks.map((t) => t.id).sort(), ["1", "2", "3"]);
});
