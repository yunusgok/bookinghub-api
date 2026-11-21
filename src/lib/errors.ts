export class ApiError extends Error {
  constructor(
    public status: 400 | 401 | 404 | 409 | 413 | 422 | 429,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function databaseError(error: unknown): never {
  const message = error instanceof Error ? error.message : '';
  if (error instanceof Error && error.cause instanceof Error)
    databaseError(error.cause);
  if (message.includes('booking_overlap'))
    throw new ApiError(
      409,
      'booking_conflict',
      'The time slot is unavailable.',
    );
  if (message.includes('inactive_reference'))
    throw new ApiError(
      409,
      'inactive_reference',
      'Customer or service is inactive.',
    );
  if (message.includes('UNIQUE constraint failed'))
    throw new ApiError(409, 'duplicate', 'The resource already exists.');
  if (message.includes('FOREIGN KEY constraint failed'))
    throw new ApiError(404, 'not_found', 'Related resource not found.');
  throw error;
}
