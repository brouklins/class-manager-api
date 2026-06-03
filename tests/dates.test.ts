import { describe, expect, it } from 'vitest';

import { hasOverlap, relationshipDays } from '../src/lib/dates';

describe('date helpers', () => {
  it('detects overlapping intervals', () => {
    expect(
      hasOverlap(
        '2026-06-02T10:00:00.000Z',
        '2026-06-02T11:00:00.000Z',
        '2026-06-02T10:30:00.000Z',
        '2026-06-02T11:30:00.000Z'
      )
    ).toBe(true);
  });

  it('calculates relationship days', () => {
    const days = relationshipDays('2026-06-01T00:00:00.000Z', new Date('2026-06-03T00:00:00.000Z'));
    expect(days).toBe(2);
  });
});

