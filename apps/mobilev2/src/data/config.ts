/**
 * What the backend can and cannot do, for the screens that have to say so.
 *
 * `globalSearch`: there is no search controller. Every list endpoint takes its
 * own `search` parameter, so flow 10 fans out across those endpoints on the
 * client. It is not server-side search and does not rank across modules.
 */
export { API_BASE_URL } from "./http";

export const BACKEND_CAPABILITIES = {
  globalSearch: false,
} as const;
