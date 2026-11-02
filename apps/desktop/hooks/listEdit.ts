export const moveItem = <T>(list: T[], from: number, to: number): T[] => {
  if (to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

export const removeAt = <T>(list: T[], index: number): T[] => list.filter((_, i) => i !== index);

export const replaceAt = <T>(list: T[], index: number, value: T): T[] =>
  list.map((item, i) => (i === index ? value : item));

export const insertAfter = <T>(list: T[], index: number, value: T): T[] => [
  ...list.slice(0, index + 1),
  value,
  ...list.slice(index + 1),
];
