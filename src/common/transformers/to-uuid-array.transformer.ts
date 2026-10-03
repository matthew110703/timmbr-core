import { Transform } from 'class-transformer';

export function ToUuidArray() {
  return Transform(({ value }) => {
    if (!value) return undefined;
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      const items = value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      return items.length > 0 ? items : undefined;
    }
    return value;
  });
}
