import type { Point } from "@/types/event";

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

export const round2 = (value: number): number => Math.round(value * 100) / 100;

export const pointsAttr = (polygon: Point[]): string =>
  polygon.map((p) => `${round2(p.x)},${round2(p.y)}`).join(" ");

export const clipPathFor = (polygon: Point[], width: number, height: number): string =>
  `polygon(${polygon
    .map((p) => `${(p.x / width) * 100}% ${(p.y / height) * 100}%`)
    .join(", ")})`;

export const centroid = (points: Point[]): Point => {
  if (points.length === 0) return { x: 0, y: 0 };
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
};

export const scalePolygon = (polygon: Point[], sx: number, sy: number): Point[] =>
  polygon.map((p) => ({ x: round2(p.x * sx), y: round2(p.y * sy) }));

export const clampPoint = (point: Point, width: number, height: number): Point => ({
  x: round2(clamp(point.x, 0, width)),
  y: round2(clamp(point.y, 0, height)),
});

export const svgPoint = (svg: SVGSVGElement, clientX: number, clientY: number): Point | null => {
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
  return { x: pt.x, y: pt.y };
};

export const isDrawn = (polygon: Point[]): boolean => polygon.length >= 3;

export const AREA_PREFIX = "area:";

export const isArea = (target: string): boolean => target.startsWith(AREA_PREFIX);

export const midpoint = (a: Point, b: Point): Point => ({ x: round2((a.x + b.x) / 2), y: round2((a.y + b.y) / 2) });

export const edgeMidpoints = (polygon: Point[]): Point[] =>
  polygon.map((p, i) => midpoint(p, polygon[(i + 1) % polygon.length]));

export const samePoint = (a: Point, b: Point, eps = 0.5): boolean =>
  Math.abs(a.x - b.x) <= eps && Math.abs(a.y - b.y) <= eps;

export const wrapLabel = (label: string, max: number): string[] => {
  const lines: string[] = [];
  let current = "";
  for (const word of label.split(" ")) {
    const next = current ? `${current} ${word}` : word;
    if (current && next.length > max) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
};

export const extOf = (path: string, fallback: string): string => {
  const match = /\.([a-z0-9]+)$/i.exec(path);
  return match ? match[1].toLowerCase() : fallback;
};
