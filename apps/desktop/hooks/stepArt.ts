import type { EventSpec } from "@/types/event";
import { assetUrl } from "@/hooks/api";

export const stepArtSrc = (event: EventSpec | null, root: string | null): string | null => {
  if (!event) return null;
  if (event.map.poster) return assetUrl(root, event.map.poster);
  const site = event.sites.find((s) => s.map.poster);
  return site ? assetUrl(root, site.map.poster) : null;
};
