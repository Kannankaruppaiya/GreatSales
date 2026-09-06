import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ApiErrorBody, ErrorCode } from '@greatsales/shared';
import { reportError } from '../observability';

/**
 * Normalizes every thrown error into the shared ApiErrorBody envelope so
 * clients have exactly one error shape to handle. Unknown (non-HTTP) errors
 * are logged with a stack and reported as a generic 500 in production (no
 * internal detail leaks).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let statusCode = 500;
    let error = 'InternalServerError';
    let message = 'Internal server error';
    let details: unknown;
    // Stable machine-readable cause. Deliberately left undefined for anything
    // that is not a deliberate, documented failure — an unexpected 500 has no
    // business meaning, and inventing a code would invite clients to handle a
    // bug as though it were a rule.
    let code: ErrorCode | undefined;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const response = exception.getResponse();
      if (typeof response === 'string') {
        message = response;
        error = exception.name;
      } else if (response && typeof response === 'object') {
        const body = response as Record<string, unknown>;
        message = Array.isArray(body.message)
          ? body.message.join(', ')
          : ((body.message as string) ?? exception.message);
        error = (body.error as string) ?? exception.name;
        code = body.code as ErrorCode | undefined;
        details = body.details;
      }
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
      // Only the unknown branch reports: an HttpException is a decision the
      // code made (a 404, a 403), not a defect, and paging on those would
      // bury the ones that matter.
      reportError(exception, {
        method: req.method,
        path: req.url,
        tenantId: (req as { user?: { tenantId?: string } }).user?.tenantId,
      });
      if (process.env.NODE_ENV !== 'production') message = exception.message;
    }

    const payload: ApiErrorBody = {
      statusCode,
      error,
      code,
      message,
      details,
      path: req.url,
      timestamp: new Date().toISOString(),
    };
    res.status(statusCode).json(payload);
  }
}
