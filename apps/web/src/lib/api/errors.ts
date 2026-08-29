/**
 * One error type for the whole client so UI branches on `kind` rather than
 * sniffing strings. `network`/`timeout` are recoverable (offer Retry); `auth`
 * means the session is gone; `http` carries the server's message.
 */
import type { ApiErrorBody } from "./types";

export type ApiErrorKind = "network" | "timeout" | "auth" | "http";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly body?: ApiErrorBody;

  constructor(kind: ApiErrorKind, message: string, status?: number, body?: ApiErrorBody) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
    this.body = body;
  }

  get userMessage(): string {
    switch (this.kind) {
      case "network":
        return "Can’t reach the server. Check your connection and try again.";
      case "timeout":
        return "This is taking longer than usual. Please try again.";
      case "auth":
        return "Your session has expired. Please sign in again.";
      case "http":
        return this.body?.message || this.message || "Something went wrong. Please try again.";
    }
  }
}
