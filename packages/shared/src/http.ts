/**
 * Canonical API error envelope. Every non-2xx response the API emits follows
 * this shape so clients have one branch to handle. `details` carries Zod issues
 * on validation failures.
 */
export interface ApiErrorBody {
  statusCode: number;
  error: string;
  message: string;
  details?: unknown;
  path?: string;
  timestamp?: string;
}
