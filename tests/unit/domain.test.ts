import { describe, it, expect } from 'vitest';
import {
  customerInput,
  serviceInput,
  bookingInput,
  nonEmpty,
  utcTimestamp,
} from '../../src/schemas/input';
import { endTimestamp, overlaps } from '../../src/services/booking';
import { generateKey, hashKey } from '../../src/lib/keys';
describe('domain validation', () => {
  it.each([0, -1, 1.5, 1441])('rejects duration %s', (durationMinutes) =>
    expect(
      serviceInput.safeParse({ name: 'Class', durationMinutes }).success,
    ).toBe(false),
  );
  it.each([
    '2027-02-29T10:00:00.000Z',
    '2027-01-01',
    '2027-01-01T10:00:00+01:00',
    'nonsense',
    '2027-01-01T10:00:00Z',
  ])('rejects noncanonical timestamp %s', (s) =>
    expect(utcTimestamp.safeParse(s).success).toBe(false),
  );
  it('normalizes email and rejects tenant injection / empty updates', () => {
    expect(
      customerInput.parse({ name: ' Demo ', email: 'TEST@example.com' }).email,
    ).toBe('test@example.com');
    expect(
      customerInput.safeParse({
        name: 'Demo',
        email: 'demo@example.com',
        tenantId: crypto.randomUUID(),
      }).success,
    ).toBe(false);
    expect(nonEmpty(serviceInput).safeParse({}).success).toBe(false);
    expect(
      bookingInput.safeParse({
        customerId: 'bad',
        serviceId: 'bad',
        startAt: 'bad',
      }).success,
    ).toBe(false);
  });
  it('calculates end time across midnight', () =>
    expect(endTimestamp('2027-01-01T23:45:00.000Z', 30)).toBe(
      '2027-01-02T00:15:00.000Z',
    ));
  it.each([
    ['10', '20', '15', '25', true],
    ['10', '20', '05', '15', true],
    ['10', '20', '11', '19', true],
    ['10', '20', '10', '20', true],
    ['10', '20', '20', '30', false],
    ['10', '20', '00', '10', false],
  ])('overlap [%s,%s) and [%s,%s)', (a, b, c, d, expected) =>
    expect(overlaps(a, b, c, d)).toBe(expected),
  );
  it('creates 256-bit random keys and stable hashes', async () => {
    const key = generateKey();
    expect(key).toMatch(/^bh_[a-f0-9]{64}$/);
    expect(generateKey()).not.toBe(key);
    expect(await hashKey(key)).toHaveLength(64);
    expect(await hashKey(key)).toBe(await hashKey(key));
  });
});
it('rejects end times outside canonical four-digit UTC years', () => {
  expect(() => endTimestamp('9999-12-31T23:59:00.000Z', 30)).toThrow(
    'four-digit',
  );
});
