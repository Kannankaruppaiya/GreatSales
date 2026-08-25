import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { ErrorCode } from '@greatsales/shared';

/**
 * Throw helpers that guarantee every DELIBERATE failure carries a stable
 * machine-readable `code`.
 *
 * Clients branch on the code; the message is for humans and may be reworded
 * freely without breaking anything. An unexpected 500 deliberately carries no
 * code — it has no business meaning to convey, and inventing one would invite
 * a client to handle a bug as if it were a rule.
 *
 * Nest's exception `response` object is what {@link AllExceptionsFilter} reads,
 * so `code` must live there rather than on the exception instance.
 */
export const codedBadRequest = (code: ErrorCode, message: string) =>
  new BadRequestException({ error: 'ValidationError', code, message });

export const codedConflict = (code: ErrorCode, message: string) =>
  new ConflictException({ error: 'Conflict', code, message });

export const codedNotFound = (code: ErrorCode, message: string) =>
  new NotFoundException({ error: 'NotFound', code, message });

export const codedForbidden = (code: ErrorCode, message: string) =>
  new ForbiddenException({ error: 'Forbidden', code, message });
