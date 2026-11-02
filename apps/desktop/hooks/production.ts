import type { Contact, EventSpec, Person, PersonStatus, Production, ScheduleItem } from "@/types/event";
import type { PersonSlot, WhoEntry } from "@/types/ui";
import { green, orange, red } from "@/hooks/theme";
import { slugify, uniqueId, updateZone } from "@/hooks/eventEdit";

export const PRODUCTION_STATES: Production[] = ["idea", "in-progress", "confirmed", "cancelled"];

const productionLabels: Record<Production, string> = {
  idea: "Idea",
  "in-progress": "In progress",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
};

const productionColors: Record<Production, string> = {
  idea: "#ffffff99",
  "in-progress": orange,
  confirmed: green,
  cancelled: red,
};

export const productionLabel = (state: Production): string => productionLabels[state];

export const productionColor = (state: Production): string => productionColors[state];

export const PERSON_STATES: PersonStatus[] = ["not-contacted", "contacted", "confirmed", "declined"];

const personLabels: Record<PersonStatus, string> = {
  "not-contacted": "Not contacted",
  contacted: "Contacted",
  confirmed: "Confirmed",
  declined: "Declined",
};

const personColors: Record<PersonStatus, string> = {
  "not-contacted": "#ffffff99",
  contacted: orange,
  confirmed: green,
  declined: red,
};

export const personStatusLabel = (status: PersonStatus): string => personLabels[status];

export const personStatusColor = (status: PersonStatus): string => personColors[status];

export const CONTACT_CHANNELS = [
  { value: "email", label: "Email" },
  { value: "dm", label: "DM" },
  { value: "call", label: "Call" },
  { value: "in-person", label: "In person" },
  { value: "other", label: "Other" },
];

export const contactChannelLabel = (channel: string): string =>
  CONTACT_CHANNELS.find((c) => c.value === channel)?.label ?? channel;

export const today = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const whoNames = (who: string): string[] =>
  who
    .split(/[,+&]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

export const personKey = (name: string): string => name.split(/\s+/).join(" ").toLowerCase();

export const taskId = (label: string, taken: string[]): string =>
  uniqueId(label.trim() ? slugify(label) : "task", taken);

export const setProduction = (
  event: EventSpec,
  siteId: string,
  zoneId: string,
  itemId: string,
  state: Production,
): EventSpec =>
  updateZone(event, siteId, zoneId, (zone) => ({
    ...zone,
    schedule: zone.schedule.map((row) => (row.id === itemId ? { ...row, production: state } : row)),
  }));

export const allRows = (event: EventSpec): ScheduleItem[] =>
  event.sites.flatMap((site) => site.zones.flatMap((zone) => zone.schedule));

export const productionCounts = (event: EventSpec): Record<Production, number> => {
  const counts: Record<Production, number> = { idea: 0, "in-progress": 0, confirmed: 0, cancelled: 0 };
  for (const row of allRows(event)) counts[row.production] += 1;
  return counts;
};

export const personFor = (event: EventSpec, name: string): Person | null => {
  const key = personKey(name);
  return event.people.find((p) => personKey(p.name) === key) ?? null;
};

export const peopleFromWho = (event: EventSpec): WhoEntry[] => {
  const entries = new Map<string, WhoEntry>();
  for (const site of event.sites) {
    for (const zone of site.zones) {
      for (const row of zone.schedule) {
        const slot: PersonSlot = {
          site: site.id,
          zone: zone.id,
          item: row.id,
          label: row.title || row.id,
          time: `${row.start}–${row.end}`,
          where: `${site.label} / ${zone.label}`,
          production: row.production,
        };
        for (const name of whoNames(row.who)) {
          const key = personKey(name);
          const existing = entries.get(key);
          if (existing) {
            existing.slots.push(slot);
          } else {
            const person = personFor(event, name);
            entries.set(key, { key, name: person?.name ?? name, person, status: person?.status ?? "not-contacted", slots: [slot] });
          }
        }
      }
    }
  }
  return [...entries.values()].sort((a, b) => a.name.localeCompare(b.name));
};

export const whoCounts = (entries: WhoEntry[]): Record<PersonStatus, number> => {
  const counts: Record<PersonStatus, number> = { "not-contacted": 0, contacted: 0, confirmed: 0, declined: 0 };
  for (const entry of entries) counts[entry.status] += 1;
  return counts;
};

const ensurePerson = (event: EventSpec, name: string): EventSpec => {
  if (personFor(event, name)) return event;
  const person: Person = {
    id: uniqueId(slugify(name) || "person", event.people.map((p) => p.id)),
    name,
    role: "",
    contact: "",
    status: "not-contacted",
    notes: "",
    log: [],
  };
  return { ...event, people: [...event.people, person] };
};

const mapPerson = (event: EventSpec, name: string, patch: (person: Person) => Person): EventSpec => {
  const next = ensurePerson(event, name);
  const key = personKey(name);
  return { ...next, people: next.people.map((p) => (personKey(p.name) === key ? patch(p) : p)) };
};

export const patchWho = (event: EventSpec, name: string, patch: Partial<Person>): EventSpec =>
  mapPerson(event, name, (p) => ({ ...p, ...patch }));

export const addContactTo = (event: EventSpec, name: string, contact: Contact): EventSpec =>
  mapPerson(event, name, (p) => ({
    ...p,
    log: [...p.log, contact],
    status: p.status === "not-contacted" ? "contacted" : p.status,
  }));

export const removeContactFrom = (event: EventSpec, name: string, index: number): EventSpec =>
  mapPerson(event, name, (p) => ({ ...p, log: p.log.filter((_, i) => i !== index) }));

export const lastContact = (person: Person | null): Contact | null =>
  person ? person.log.reduce<Contact | null>((best, entry) => (!best || entry.date > best.date ? entry : best), null) : null;
