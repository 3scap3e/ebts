export interface SiteUtcSpan {
  site: string;
  label: string;
  openUtc: number;
  closeUtc: number;
}

export interface UtcOverlap {
  start: number;
  end: number;
  minutes: number;
}
