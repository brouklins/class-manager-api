export const nowIso = (): string => new Date().toISOString();

export const normalizeName = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

export const startOfCurrentMonthUtc = (): string => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)).toISOString();
};

export const endOfCurrentMonthUtc = (): string => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999)).toISOString();
};

export const subtractDays = (isoDate: string, days: number): string => {
  const value = new Date(isoDate);
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString();
};

export const addDays = (isoDate: string, days: number): string => {
  const value = new Date(isoDate);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString();
};

export const isFutureOrNow = (isoDate: string, reference = new Date()): boolean =>
  new Date(isoDate).getTime() >= reference.getTime();

export const relationshipDays = (startedAt: string, reference = new Date()): number => {
  const diff = reference.getTime() - new Date(startedAt).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
};

export const hasOverlap = (
  leftStart: string,
  leftEnd: string,
  rightStart: string,
  rightEnd: string
): boolean => new Date(leftStart).getTime() < new Date(rightEnd).getTime() && new Date(rightStart).getTime() < new Date(leftEnd).getTime();
