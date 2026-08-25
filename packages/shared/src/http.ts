/**
 * Canonical API error envelope. Every non-2xx response the API emits follows
 * this shape so clients have one branch to handle. `details` carries Zod issues
 * on validation failures.
 */
import type { ErrorCode } from "./errors";

export interface ApiErrorBody {
  statusCode: number;
  error: string;
  /**
   * Stable machine-readable cause. Present on every error the API raises
   * deliberately; absent on unexpected 500s, which have no business meaning to
   * convey. Clients branch on this, never on `message`.
   */
  code?: ErrorCode;
  message: string;
  details?: unknown;
  path?: string;
  timestamp?: string;
}
