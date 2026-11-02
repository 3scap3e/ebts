export const toMinutes = (hm: string): number => {
  const [h, m] = hm.split(":").map((v) => Number.parseInt(v, 10));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
};

export const toHm = (minutes: number): string => {
  const total = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

export const pretty = (hm: string): string => {
  const total = toMinutes(hm);
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
};

export const utcLabel = (iso: string): string => {
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`;
};

export const addMinutesIso = (iso: string, minutes: number): string =>
  new Date(new Date(iso).getTime() + minutes * 60000).toISOString();

export const minutesBetween = (a: string, b: string): number =>
  Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);

export const secondsLabel = (seconds: number): string => {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const m = Math.floor(safe / 60);
  const s = safe - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
};
