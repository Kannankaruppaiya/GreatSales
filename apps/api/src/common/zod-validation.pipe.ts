import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import type { ZodSchema } from 'zod';

/**
 * Validates a request payload against a Zod schema and returns the parsed
 * (and coerced) value. On failure, raises 400 with the Zod issues under
 * `details`, matching the shared ApiErrorBody contract.
 *
 * Usage: `@Body(new ZodValidationPipe(LoginSchema)) body: LoginInput`
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        error: 'ValidationError',
        message: 'Request validation failed',
        details: result.error.issues,
      });
    }
    return result.data;
  }
}
