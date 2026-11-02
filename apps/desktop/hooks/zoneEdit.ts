import type { Rhythm, Zone, ZoneFormat, ZoneTemplate } from "@/types/event";

export const ZONE_FORMATS: ZoneFormat[] = [
  "salon",
  "demo-station",
  "performance-zone",
  "screening-room",
  "mingle-space",
  "tinker-space",
  "video-wall",
  "spatial-installation",
  "telepresence-zone",
  "refractory",
  "back-of-house",
  "custom",
];

export const RHYTHMS: Rhythm[] = ["continuous", "scheduled", "open-plus-scheduled", "loops", "crew-only"];

export const customTemplate = (label: string): ZoneTemplate => ({
  format: "custom",
  label,
  id_prefix: "ZON",
  who: "Mixed collaborators",
  what: "",
  rhythm: "scheduled",
  description: "",
  prompt_subject: label,
});

export const zoneHours = (zone: Zone, open: string, close: string): string =>
  `${zone.open ?? open} – ${zone.close ?? close}`;

export const humanize = (value: string): string => value.replace(/-/g, " ");
