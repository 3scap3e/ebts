import type { ScheduleItem, ScheduleStatus, Task, Zone } from "@/types/event";
import { toMinutes } from "@/hooks/time";
import { taskId } from "@/hooks/production";

export const SCHEDULE_STATUSES: ScheduleStatus[] = [
  "feed-up",
  "linked",
  "scheduled",
  "open",
  "food-service",
  "installed",
  "on-floor",
  "interstitial",
  "load-in",
  "crew",
  "strike",
  "screening",
  "workshop",
  "room-change",
];

export const idPrefix = (zoneId: string): string => {
  const parts = zoneId.split("-").filter(Boolean);
  const letters = (parts.find((p) => /[a-z]/i.test(p)) ?? "ITM")
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 3)
    .toUpperCase();
  const digits = parts.find((p) => /^\d+$/.test(p));
  return digits ? `${letters}-${digits.padStart(2, "0")}` : letters;
};

const suffix = (n: number): string => {
  let out = "";
  let i = n;
  do {
    out = String.fromCharCode(65 + (i % 26)) + out;
    i = Math.floor(i / 26) - 1;
  } while (i >= 0);
  return out;
};

export const nextScheduleId = (zone: Zone): string => {
  const taken = new Set(zone.schedule.map((i) => i.id));
  const prefix = idPrefix(zone.id);
  let n = zone.schedule.length;
  while (taken.has(`${prefix}-${suffix(n)}`)) n += 1;
  return `${prefix}-${suffix(n)}`;
};

export const newScheduleItem = (zone: Zone, open: string, close: string): ScheduleItem => ({
  id: nextScheduleId(zone),
  title: "",
  kind: "Open block",
  description: "",
  start: zone.open ?? open,
  end: zone.close ?? close,
  who: zone.who,
  channel: "",
  status: "scheduled",
  link: null,
  production: "idea",
  tasks: [],
});

const copyTasks = (tasks: Task[]): Task[] => {
  const taken: string[] = [];
  return tasks.map((task) => {
    const id = taskId(task.label, taken);
    taken.push(id);
    return { ...task, id };
  });
};

export const duplicateScheduleItem = (zone: Zone, item: ScheduleItem): ScheduleItem => ({
  ...item,
  id: nextScheduleId(zone),
  link: item.link ? { ...item.link } : null,
  production: "idea",
  tasks: copyTasks(item.tasks),
});

export const sortByStart = (items: ScheduleItem[]): ScheduleItem[] =>
  [...items].sort((a, b) => toMinutes(a.start) - toMinutes(b.start) || toMinutes(a.end) - toMinutes(b.end));
