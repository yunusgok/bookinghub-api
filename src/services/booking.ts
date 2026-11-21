import { ApiError } from '../lib/errors';
export function endTimestamp(startAt: string, durationMinutes: number): string {
  const end = new Date(
    new Date(startAt).getTime() + durationMinutes * 60_000,
  ).toISOString();
  if (end.length !== 24)
    throw new ApiError(
      422,
      'invalid_interval',
      'Booking end must fit a four-digit UTC year.',
    );
  return end;
}
export function overlaps(
  start: string,
  end: string,
  existingStart: string,
  existingEnd: string,
): boolean {
  return start < existingEnd && end > existingStart;
}
